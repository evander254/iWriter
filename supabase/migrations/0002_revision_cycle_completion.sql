-- iWriter: close revision requests on resubmission and approval.
-- Additive/idempotent: replaces two RPC definitions without changing tables,
-- statuses, or historical submission/revision rows.

begin;

-- Revision state is changed only inside the trusted submission/review RPCs.
-- Remove the earlier broad client-side admin write policy if it exists.
drop policy if exists revision_requests_admin_write on public.revision_requests;

create or replace function public.submit_work(
  p_claim_id uuid,
  p_notes    text,
  p_files    jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_claim      public.assignment_claims%rowtype;
  v_assignment public.assignments%rowtype;
  v_submission uuid;
  v_file       jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not public.is_active_user() then
    raise exception 'Your account is not active and cannot submit work.' using errcode = '42501';
  end if;

  select * into v_claim
    from public.assignment_claims
   where id = p_claim_id
   for update;
  if not found then
    raise exception 'Claim not found.' using errcode = 'P0002';
  end if;
  if v_claim.writer_id <> v_uid then
    raise exception 'You can only submit work for your own claims.' using errcode = '42501';
  end if;
  if v_claim.status not in ('claimed', 'revision') then
    raise exception 'This claim is not open for submission.' using errcode = 'P0001';
  end if;

  select * into v_assignment
    from public.assignments
   where id = v_claim.assignment_id;
  if v_assignment.deadline is not null and v_assignment.deadline < now() then
    raise exception 'The deadline for this assignment has passed.' using errcode = 'P0001';
  end if;

  -- Resolve only the open requests belonging to this claim. Historical
  -- revision_requests and prior submission statuses remain intact for audit.
  update public.revision_requests rr
     set status = 'resolved'
   where rr.status = 'pending'
     and exists (
       select 1
         from public.submissions prior
        where prior.id = rr.submission_id
          and prior.claim_id = p_claim_id
     );

  insert into public.submissions (claim_id, notes, status)
  values (p_claim_id, p_notes, 'pending')
  returning id into v_submission;

  if p_files is not null and jsonb_typeof(p_files) = 'array' then
    for v_file in select * from jsonb_array_elements(p_files) loop
      insert into public.submission_files (submission_id, file_name, file_url)
      values (
        v_submission,
        coalesce(v_file ->> 'file_name', 'attachment'),
        v_file ->> 'file_url'
      );
    end loop;
  end if;

  update public.assignment_claims
     set status = 'submitted', submitted_at = now()
   where id = p_claim_id;

  update public.assignments
     set status = 'pending_review'
   where id = v_claim.assignment_id;

  insert into public.assignment_history (assignment_id, user_id, old_status, new_status, remarks)
  values (v_claim.assignment_id, v_uid, v_assignment.status, 'pending_review', 'Revised work resubmitted for review');

  insert into public.activity_logs (user_id, activity)
  values (v_uid, 'Submitted work for ' || coalesce(v_assignment.assignment_code, v_assignment.title));

  insert into public.notifications (user_id, title, message, type)
  select p.id, 'New submission to review',
         'A submission was received for "' || v_assignment.title || '".', 'submission'
    from public.profiles p
   where p.role = 'admin' and p.status <> 'suspended';

  return v_submission;
end;
$$;

create or replace function public.review_submission(
  p_submission_id uuid,
  p_decision      text,
  p_feedback      text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_submission public.submissions%rowtype;
  v_claim      public.assignment_claims%rowtype;
  v_assignment public.assignments%rowtype;
  v_already    boolean;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can review submissions.' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected', 'revision') then
    raise exception 'Invalid decision: %', p_decision using errcode = '22023';
  end if;

  select * into v_submission
    from public.submissions
   where id = p_submission_id
   for update;
  if not found then
    raise exception 'Submission not found.' using errcode = 'P0002';
  end if;
  if v_submission.status <> 'pending' then
    raise exception 'This submission has already been reviewed.' using errcode = 'P0001';
  end if;

  select * into v_claim
    from public.assignment_claims
   where id = v_submission.claim_id
   for update;
  if not found then
    raise exception 'Related claim not found.' using errcode = 'P0002';
  end if;
  select * into v_assignment
    from public.assignments
   where id = v_claim.assignment_id;

  update public.submissions
     set status = p_decision,
         feedback = coalesce(p_feedback, feedback),
         updated_at = now()
   where id = p_submission_id;

  update public.assignment_claims
     set status = p_decision, reviewed_at = now()
   where id = v_claim.id;

  if p_decision = 'approved' then
    update public.assignments
       set status = 'approved'
     where id = v_claim.assignment_id;

    -- Approval closes every outstanding revision for this assignment while
    -- retaining all revision rows as the permanent audit trail.
    update public.revision_requests rr
       set status = 'resolved'
     where rr.status = 'pending'
       and exists (
         select 1
           from public.submissions s
           join public.assignment_claims c on c.id = s.claim_id
          where s.id = rr.submission_id
            and c.assignment_id = v_claim.assignment_id
       );

    -- Credit earnings exactly once (guarded by transactions_earning_unique).
    select exists (
      select 1 from public.transactions
       where reference = p_submission_id::text
         and transaction_type = 'earning'
    ) into v_already;

    if not v_already then
      insert into public.transactions (user_id, amount, transaction_type, description, reference)
      values (
        v_claim.writer_id,
        coalesce(v_assignment.reward, 0),
        'earning',
        'Earnings for ' || coalesce(v_assignment.assignment_code, v_assignment.title),
        p_submission_id::text
      );
      update public.profiles
         set available_balance = coalesce(available_balance, 0) + coalesce(v_assignment.reward, 0),
             total_earnings = coalesce(total_earnings, 0) + coalesce(v_assignment.reward, 0)
       where id = v_claim.writer_id;
    end if;

    insert into public.notifications (user_id, title, message, type)
    values (v_claim.writer_id, 'Submission approved',
            'Your submission for "' || v_assignment.title || '" was approved. Earnings have been credited.',
            'approved');

  elsif p_decision = 'rejected' then
    update public.assignments
       set status = 'cancelled'
     where id = v_claim.assignment_id;
    insert into public.notifications (user_id, title, message, type)
    values (v_claim.writer_id, 'Submission rejected',
            coalesce(p_feedback, 'Your submission was rejected.'), 'rejected');

  else
    update public.assignments
       set status = 'revision'
     where id = v_claim.assignment_id;
    insert into public.revision_requests (submission_id, feedback, status)
    values (p_submission_id, coalesce(p_feedback, 'Please revise and resubmit.'), 'pending');
    insert into public.notifications (user_id, title, message, type)
    values (v_claim.writer_id, 'Revision requested',
            coalesce(p_feedback, 'A revision was requested for your submission.'), 'revision');
  end if;

  insert into public.assignment_history (assignment_id, user_id, old_status, new_status, remarks)
  values (v_claim.assignment_id, v_uid, v_assignment.status, p_decision,
          'Admin review: ' || p_decision);
  insert into public.activity_logs (user_id, activity)
  values (v_uid, 'Reviewed submission ' || p_submission_id::text || ' as ' || p_decision);
end;
$$;

grant execute on function public.submit_work(uuid, text, jsonb) to authenticated;
grant execute on function public.review_submission(uuid, text, text) to authenticated;

commit;
