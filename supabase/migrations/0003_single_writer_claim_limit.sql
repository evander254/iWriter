-- One writer per assignment and no more than five active claims per writer.
-- Row locks serialize simultaneous claim attempts (including across different
-- assignments for the same writer).
begin;

create or replace function public.claim_assignment(p_assignment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_assignment public.assignments%rowtype;
  v_existing uuid;
  v_active_count integer;
  v_claim_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if not public.is_active_user() then
    raise exception 'Your account is not active and cannot claim assignments.' using errcode = '42501';
  end if;

  -- Serialize this writer's claims on any assignments, preventing concurrent
  -- claims from exceeding the five-assignment limit.
  perform 1 from public.profiles where id = v_uid for update;

  -- The assignment row is the arbitration point: the first transaction to
  -- acquire it wins; later callers see the committed claimed status.
  select * into v_assignment
    from public.assignments
   where id = p_assignment_id
   for update;
  if not found then
    raise exception 'Assignment not found.' using errcode = 'P0002';
  end if;
  if v_assignment.status <> 'available' then
    raise exception 'Sorry, this assignment has been claimed.' using errcode = 'P0001';
  end if;
  if v_assignment.visibility is distinct from 'public' then
    raise exception 'This assignment is not open to claims.' using errcode = 'P0001';
  end if;
  if v_assignment.deadline is not null and v_assignment.deadline < now() then
    raise exception 'This assignment has expired.' using errcode = 'P0001';
  end if;

  select id into v_existing
    from public.assignment_claims
   where assignment_id = p_assignment_id and writer_id = v_uid;
  if v_existing is not null then
    raise exception 'You have already claimed this assignment.' using errcode = 'P0001';
  end if;

  select count(*) into v_active_count
    from public.assignment_claims
   where writer_id = v_uid and status in ('claimed', 'submitted', 'revision');
  if v_active_count >= 5 then
    raise exception 'You already have five active assignments. Complete one before claiming another.' using errcode = 'P0001';
  end if;

  insert into public.assignment_claims (assignment_id, writer_id, status)
  values (p_assignment_id, v_uid, 'claimed')
  returning id into v_claim_id;

  update public.assignments set status = 'claimed' where id = p_assignment_id;

  insert into public.assignment_history (assignment_id, user_id, old_status, new_status, remarks)
  values (p_assignment_id, v_uid, v_assignment.status, 'claimed', 'Assignment claimed by writer');
  insert into public.activity_logs (user_id, activity)
  values (v_uid, 'Claimed assignment ' || coalesce(v_assignment.assignment_code, v_assignment.title));
  insert into public.notifications (user_id, title, message, type)
  select p.id, 'New assignment claim', 'A writer claimed "' || v_assignment.title || '".', 'claim'
    from public.profiles p where p.role = 'admin' and p.status <> 'suspended';

  return v_claim_id;
end;
$$;

grant execute on function public.claim_assignment(uuid) to authenticated;
commit;
