-- ============================================================================
-- iWriter — Core security & transactional layer
-- ----------------------------------------------------------------------------
-- ADDITIVE + IDEMPOTENT. Safe to run on the existing iWriter project.
--   * Creates NO tables and drops NO data.
--   * Adds helper functions, a signup trigger, indexes, RLS policies and
--     SECURITY DEFINER RPCs used by the React client.
--   * Policies added here are PERMISSIVE, so they only ever widen access
--     relative to the current state (Postgres ORs permissive policies).
--
-- Why this is required:
--   The client must never compute money or enforce claim limits itself.
--   Everything sensitive (claiming, submitting, reviewing, earnings,
--   withdrawals) happens inside these atomic, server-side functions.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions (idempotent)
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status <> 'suspended'
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'active'
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_user() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Auto-create a profile row when a user signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    'writer',           -- never allow self-assigned admin
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. Data-integrity guards
-- ---------------------------------------------------------------------------

-- A writer may hold at most one claim per assignment.
create unique index if not exists assignment_claims_unique_writer
  on public.assignment_claims (assignment_id, writer_id);

-- An approved submission may generate exactly one earning transaction.
create unique index if not exists transactions_earning_unique
  on public.transactions (reference)
  where transaction_type = 'earning';

-- Withdrawals must be positive.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'withdrawal_requests_amount_positive'
  ) then
    alter table public.withdrawal_requests
      add constraint withdrawal_requests_amount_positive check (amount > 0);
  end if;
end $$;

-- Keep updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists assignments_touch on public.assignments;
create trigger assignments_touch before update on public.assignments
  for each row execute function public.touch_updated_at();

drop trigger if exists submissions_touch on public.submissions;
create trigger submissions_touch before update on public.submissions
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Useful indexes
create index if not exists assignments_status_idx on public.assignments (status);
create index if not exists assignments_deadline_idx on public.assignments (deadline);
create index if not exists assignment_claims_writer_idx on public.assignment_claims (writer_id);
create index if not exists assignment_claims_status_idx on public.assignment_claims (status);
create index if not exists submissions_claim_idx on public.submissions (claim_id);
create index if not exists notifications_user_idx on public.notifications (user_id, is_read);
create index if not exists transactions_user_idx on public.transactions (user_id);
create index if not exists withdrawal_requests_status_idx on public.withdrawal_requests (status);
create index if not exists activity_logs_user_idx on public.activity_logs (user_id);

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.subjects              enable row level security;
alter table public.categories            enable row level security;
alter table public.assignments           enable row level security;
alter table public.assignment_attachments enable row level security;
alter table public.assignment_claims     enable row level security;
alter table public.submissions           enable row level security;
alter table public.submission_files      enable row level security;
alter table public.revision_requests     enable row level security;
alter table public.transactions          enable row level security;
alter table public.withdrawal_requests   enable row level security;
alter table public.notifications         enable row level security;
alter table public.announcements         enable row level security;
alter table public.assignment_history    enable row level security;
alter table public.settings              enable row level security;
alter table public.activity_logs         enable row level security;

-- ---------- profiles ----------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  for select to authenticated using (public.is_admin());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Column-level guard: a writer can only ever edit their own descriptive fields.
-- role / status / balances are NOT granted, so they cannot be changed from the
-- client. Admin changes go through SECURITY DEFINER RPCs below.
revoke update on public.profiles from authenticated, anon;
grant  update (full_name, avatar_url, phone, country, bio) on public.profiles to authenticated;

-- ---------- reference data ----------
drop policy if exists subjects_select on public.subjects;
create policy subjects_select on public.subjects for select to authenticated using (true);
drop policy if exists subjects_write on public.subjects;
create policy subjects_write on public.subjects for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select to authenticated using (true);
drop policy if exists categories_write on public.categories;
create policy categories_write on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- assignments ----------
-- Writers may browse assignments that are publicly visible (any status so they
-- can see their own completed work through claims); admins see everything.
drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments
  for select to authenticated
  using (
    public.is_admin()
    or (visibility = 'public' and status <> 'draft')
    or exists (
      select 1 from public.assignment_claims c
      where c.assignment_id = assignments.id and c.writer_id = auth.uid()
    )
  );

drop policy if exists assignments_insert on public.assignments;
create policy assignments_insert on public.assignments
  for insert to authenticated with check (public.is_admin());

drop policy if exists assignments_update on public.assignments;
create policy assignments_update on public.assignments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists assignments_delete on public.assignments;
create policy assignments_delete on public.assignments
  for delete to authenticated using (public.is_admin());

-- ---------- assignment attachments ----------
drop policy if exists assignment_attachments_select on public.assignment_attachments;
create policy assignment_attachments_select on public.assignment_attachments
  for select to authenticated using (true);
drop policy if exists assignment_attachments_write on public.assignment_attachments;
create policy assignment_attachments_write on public.assignment_attachments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- claims ----------
drop policy if exists assignment_claims_select on public.assignment_claims;
create policy assignment_claims_select on public.assignment_claims
  for select to authenticated
  using (public.is_admin() or writer_id = auth.uid());

drop policy if exists assignment_claims_admin_write on public.assignment_claims;
create policy assignment_claims_admin_write on public.assignment_claims
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Writers claim only through public.claim_assignment().

-- ---------- submissions ----------
drop policy if exists submissions_select on public.submissions;
create policy submissions_select on public.submissions
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.assignment_claims c
      where c.id = submissions.claim_id and c.writer_id = auth.uid()
    )
  );

-- ---------- submission files ----------
drop policy if exists submission_files_select on public.submission_files;
create policy submission_files_select on public.submission_files
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.submissions s
      join public.assignment_claims c on c.id = s.claim_id
      where s.id = submission_files.submission_id and c.writer_id = auth.uid()
    )
  );

-- ---------- revision requests ----------
drop policy if exists revision_requests_select on public.revision_requests;
create policy revision_requests_select on public.revision_requests
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.submissions s
      join public.assignment_claims c on c.id = s.claim_id
      where s.id = revision_requests.submission_id and c.writer_id = auth.uid()
    )
  );

-- ---------- transactions ----------
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions
  for select to authenticated
  using (public.is_admin() or user_id = auth.uid());
-- No insert/update policies: money moves only inside SECURITY DEFINER RPCs.

-- ---------- withdrawals ----------
drop policy if exists withdrawal_requests_select on public.withdrawal_requests;
create policy withdrawal_requests_select on public.withdrawal_requests
  for select to authenticated
  using (public.is_admin() or user_id = auth.uid());
-- Writers request via public.request_withdrawal(); admins process via RPC.

-- ---------- notifications ----------
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated using (public.is_admin() or user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_admin_write on public.notifications;
create policy notifications_admin_write on public.notifications
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- announcements ----------
drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
  for select to authenticated using (public.is_admin() or is_active = true);

drop policy if exists announcements_write on public.announcements;
create policy announcements_write on public.announcements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- assignment history ----------
drop policy if exists assignment_history_select on public.assignment_history;
create policy assignment_history_select on public.assignment_history
  for select to authenticated using (public.is_admin() or user_id = auth.uid());

-- ---------- settings ----------
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select to authenticated using (true);
drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- activity logs ----------
drop policy if exists activity_logs_select on public.activity_logs;
create policy activity_logs_select on public.activity_logs
  for select to authenticated using (public.is_admin() or user_id = auth.uid());

drop policy if exists activity_logs_insert on public.activity_logs;
create policy activity_logs_insert on public.activity_logs
  for insert to authenticated with check (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Storage (attachments bucket) — private, signed-URL access
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from storage.buckets where id = 'attachments') then
    if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='iwriter_attachments_read') then
      create policy iwriter_attachments_read on storage.objects
        for select to authenticated
        using (bucket_id = 'attachments');
    end if;
    if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='iwriter_attachments_insert') then
      create policy iwriter_attachments_insert on storage.objects
        for insert to authenticated
        with check (bucket_id = 'attachments');
    end if;
    if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='iwriter_attachments_delete') then
      create policy iwriter_attachments_delete on storage.objects
        for delete to authenticated
        using (bucket_id = 'attachments' and (owner = auth.uid() or public.is_admin()));
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Transactional RPCs
-- ---------------------------------------------------------------------------

-- 6.1 Claim an assignment (atomic, respects max_claims + duplicate prevention)
create or replace function public.claim_assignment(p_assignment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_assignment public.assignments%rowtype;
  v_existing  uuid;
  v_count     integer;
  v_claim_id  uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not public.is_active_user() then
    raise exception 'Your account is not active and cannot claim assignments.' using errcode = '42501';
  end if;

  -- Lock the assignment row so two writers cannot over-claim simultaneously.
  select * into v_assignment
  from public.assignments
  where id = p_assignment_id
  for update;

  if not found then
    raise exception 'Assignment not found.' using errcode = 'P0002';
  end if;

  if v_assignment.status not in ('available', 'claimed') then
    raise exception 'This assignment is no longer available.' using errcode = 'P0001';
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

  select count(*) into v_count
  from public.assignment_claims
  where assignment_id = p_assignment_id and status <> 'rejected';

  if v_count >= coalesce(v_assignment.max_claims, 1) then
    raise exception 'The maximum number of claims for this assignment has been reached.' using errcode = 'P0001';
  end if;

  insert into public.assignment_claims (assignment_id, writer_id, status)
  values (p_assignment_id, v_uid, 'claimed')
  returning id into v_claim_id;

  -- Mark the assignment claimed once capacity is reached.
  if (v_count + 1) >= coalesce(v_assignment.max_claims, 1) then
    update public.assignments set status = 'claimed' where id = p_assignment_id;
  end if;

  insert into public.assignment_history (assignment_id, user_id, old_status, new_status, remarks)
  values (p_assignment_id, v_uid, v_assignment.status, 'claimed', 'Assignment claimed by writer');

  insert into public.activity_logs (user_id, activity)
  values (v_uid, 'Claimed assignment ' || coalesce(v_assignment.assignment_code, v_assignment.title));

  -- Notify administrators.
  insert into public.notifications (user_id, title, message, type)
  select p.id, 'New assignment claim',
         'A writer claimed "' || v_assignment.title || '".', 'claim'
  from public.profiles p where p.role = 'admin' and p.status <> 'suspended';

  return v_claim_id;
end;
$$;

-- 6.2 Submit work for a claim
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

  select * into v_claim from public.assignment_claims where id = p_claim_id for update;
  if not found then
    raise exception 'Claim not found.' using errcode = 'P0002';
  end if;

  if v_claim.writer_id <> v_uid then
    raise exception 'You can only submit work for your own claims.' using errcode = '42501';
  end if;

  if v_claim.status not in ('claimed', 'revision') then
    raise exception 'This claim is not open for submission.' using errcode = 'P0001';
  end if;

  select * into v_assignment from public.assignments where id = v_claim.assignment_id;
  if v_assignment.deadline is not null and v_assignment.deadline < now() then
    raise exception 'The deadline for this assignment has passed.' using errcode = 'P0001';
  end if;

  -- Keep revision requests as an audit trail, but close the open request(s)
  -- for this claim when a revised version is submitted.
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

  update public.assignments set status = 'pending_review' where id = v_claim.assignment_id;

  insert into public.assignment_history (assignment_id, user_id, old_status, new_status, remarks)
  values (v_claim.assignment_id, v_uid, v_assignment.status, 'pending_review', 'Work submitted for review');

  insert into public.activity_logs (user_id, activity)
  values (v_uid, 'Submitted work for ' || coalesce(v_assignment.assignment_code, v_assignment.title));

  insert into public.notifications (user_id, title, message, type)
  select p.id, 'New submission to review',
         'A submission was received for "' || v_assignment.title || '".', 'submission'
  from public.profiles p where p.role = 'admin' and p.status <> 'suspended';

  return v_submission;
end;
$$;

-- 6.3 Review a submission (approve / reject / request revision)
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

  select * into v_submission from public.submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Submission not found.' using errcode = 'P0002';
  end if;
  if v_submission.status <> 'pending' then
    raise exception 'This submission has already been reviewed.' using errcode = 'P0001';
  end if;

  select * into v_claim from public.assignment_claims where id = v_submission.claim_id for update;
  if not found then
    raise exception 'Related claim not found.' using errcode = 'P0002';
  end if;

  select * into v_assignment from public.assignments where id = v_claim.assignment_id;

  update public.submissions
     set status = p_decision,
         feedback = coalesce(p_feedback, feedback),
         updated_at = now()
   where id = p_submission_id;

  update public.assignment_claims
     set status = p_decision, reviewed_at = now()
   where id = v_claim.id;

  if p_decision = 'approved' then
    update public.assignments set status = 'approved' where id = v_claim.assignment_id;

    -- An approved assignment has no open revision requests. Keep the rows as
    -- history, but resolve any outstanding requests under this assignment.
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
      where reference = p_submission_id::text and transaction_type = 'earning'
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
             total_earnings    = coalesce(total_earnings, 0)    + coalesce(v_assignment.reward, 0)
       where id = v_claim.writer_id;
    end if;

    insert into public.notifications (user_id, title, message, type)
    values (v_claim.writer_id, 'Submission approved',
            'Your submission for "' || v_assignment.title || '" was approved. Earnings have been credited.',
            'approved');

  elsif p_decision = 'rejected' then
    update public.assignments set status = 'cancelled' where id = v_claim.assignment_id;

    insert into public.notifications (user_id, title, message, type)
    values (v_claim.writer_id, 'Submission rejected',
            coalesce(p_feedback, 'Your submission was rejected.'),
            'rejected');

  else -- revision
    update public.assignments set status = 'revision' where id = v_claim.assignment_id;

    insert into public.revision_requests (submission_id, feedback, status)
    values (p_submission_id, coalesce(p_feedback, 'Please revise and resubmit.'), 'pending');

    insert into public.notifications (user_id, title, message, type)
    values (v_claim.writer_id, 'Revision requested',
            coalesce(p_feedback, 'A revision was requested for your submission.'),
            'revision');
  end if;

  insert into public.assignment_history (assignment_id, user_id, old_status, new_status, remarks)
  values (v_claim.assignment_id, v_uid, v_assignment.status, p_decision,
          'Admin review: ' || p_decision);

  insert into public.activity_logs (user_id, activity)
  values (v_uid, 'Reviewed submission ' || p_submission_id::text || ' as ' || p_decision);
end;
$$;

-- 6.4 Request a withdrawal (validated against the server-side balance)
create or replace function public.request_withdrawal(
  p_amount         numeric,
  p_method         text,
  p_account_number text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_balance    numeric;
  v_request_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not public.is_active_user() then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter a valid withdrawal amount.' using errcode = '22023';
  end if;

  if p_method is null or length(trim(p_method)) = 0 then
    raise exception 'Choose a withdrawal method.' using errcode = '22023';
  end if;

  -- Atomically reserve the funds.
  update public.profiles
     set available_balance = available_balance - p_amount
   where id = v_uid and coalesce(available_balance, 0) >= p_amount
   returning available_balance into v_balance;

  if v_balance is null then
    raise exception 'Insufficient available balance.' using errcode = 'P0001';
  end if;

  insert into public.withdrawal_requests (user_id, amount, method, account_number, status)
  values (v_uid, p_amount, p_method, p_account_number, 'pending')
  returning id into v_request_id;

  insert into public.transactions (user_id, amount, transaction_type, description, reference)
  values (v_uid, -p_amount, 'withdrawal', 'Withdrawal request', v_request_id::text);

  insert into public.activity_logs (user_id, activity)
  values (v_uid, 'Requested a withdrawal of ' || p_amount::text);

  insert into public.notifications (user_id, title, message, type)
  select p.id, 'New withdrawal request',
         'A withdrawal request of ' || p_amount::text || ' was submitted.', 'withdrawal'
  from public.profiles p where p.role = 'admin' and p.status <> 'suspended';

  return v_request_id;
end;
$$;

-- 6.5 Process a withdrawal (atomic; refuses double processing)
create or replace function public.process_withdrawal(
  p_request_id  uuid,
  p_action      text,
  p_admin_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_request public.withdrawal_requests%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can process withdrawals.' using errcode = '42501';
  end if;

  if p_action not in ('approved', 'rejected', 'paid') then
    raise exception 'Invalid action: %', p_action using errcode = '22023';
  end if;

  select * into v_request from public.withdrawal_requests where id = p_request_id for update;
  if not found then
    raise exception 'Withdrawal request not found.' using errcode = 'P0002';
  end if;

  -- Idempotency / no double processing.
  if v_request.status = 'paid' then
    raise exception 'This withdrawal has already been paid.' using errcode = 'P0001';
  end if;
  if v_request.status = 'rejected' then
    raise exception 'This withdrawal has already been rejected.' using errcode = 'P0001';
  end if;

  if p_action = 'rejected' then
    -- Refund the reserved funds exactly once.
    if v_request.status <> 'rejected' then
      update public.profiles
         set available_balance = coalesce(available_balance, 0) + v_request.amount
       where id = v_request.user_id;
    end if;

    insert into public.transactions (user_id, amount, transaction_type, description, reference)
    values (v_request.user_id, v_request.amount, 'adjustment',
            'Withdrawal rejected — funds returned', p_request_id::text || ':refund');
  end if;

  update public.withdrawal_requests
     set status = p_action,
         admin_notes = coalesce(p_admin_notes, admin_notes),
         processed_at = now()
   where id = p_request_id;

  insert into public.notifications (user_id, title, message, type)
  values (v_request.user_id,
          'Withdrawal ' || p_action,
          coalesce(p_admin_notes, 'Your withdrawal request was ' || p_action || '.'),
          'withdrawal');

  insert into public.activity_logs (user_id, activity)
  values (v_uid, 'Withdrawal ' || p_request_id::text || ' marked ' || p_action);
end;
$$;

-- 6.6 Admin: change a writer's account status (suspend / reactivate)
create or replace function public.admin_set_writer_status(
  p_user_id uuid,
  p_status  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can change account status.' using errcode = '42501';
  end if;

  if p_status not in ('active', 'suspended', 'inactive') then
    raise exception 'Invalid status: %', p_status using errcode = '22023';
  end if;

  update public.profiles set status = p_status where id = p_user_id;

  insert into public.activity_logs (user_id, activity)
  values (auth.uid(), 'Set writer ' || p_user_id::text || ' status to ' || p_status);

  insert into public.notifications (user_id, title, message, type)
  values (p_user_id,
          'Account ' || p_status,
          'Your account status was changed to ' || p_status || '.',
          'account');
end;
$$;

-- 6.7 Admin: manual balance adjustment (bonus / penalty / correction)
create or replace function public.admin_adjust_balance(
  p_user_id uuid,
  p_amount  numeric,
  p_reason  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can adjust balances.' using errcode = '42501';
  end if;

  if p_amount = 0 then
    raise exception 'Adjustment cannot be zero.' using errcode = '22023';
  end if;

  update public.profiles
     set available_balance = coalesce(available_balance, 0) + p_amount,
         total_earnings    = case when p_amount > 0 then coalesce(total_earnings, 0) + p_amount else total_earnings end
   where id = p_user_id;

  insert into public.transactions (user_id, amount, transaction_type, description, reference)
  values (p_user_id, p_amount,
          case when p_amount > 0 then 'bonus' else 'penalty' end,
          coalesce(p_reason, 'Manual adjustment'),
          'adjust:' || gen_random_uuid()::text);

  insert into public.activity_logs (user_id, activity)
  values (auth.uid(), 'Adjusted balance for ' || p_user_id::text || ' by ' || p_amount::text);

  insert into public.notifications (user_id, title, message, type)
  values (p_user_id, 'Balance updated', coalesce(p_reason, 'Your balance was adjusted.'), 'wallet');
end;
$$;

-- 6.8 Mark all of the caller's notifications as read
create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications set is_read = true
   where user_id = auth.uid() and is_read = false;
end;
$$;

grant execute on function public.claim_assignment(uuid) to authenticated;
grant execute on function public.submit_work(uuid, text, jsonb) to authenticated;
grant execute on function public.review_submission(uuid, text, text) to authenticated;
grant execute on function public.request_withdrawal(numeric, text, text) to authenticated;
grant execute on function public.process_withdrawal(uuid, text, text) to authenticated;
grant execute on function public.admin_set_writer_status(uuid, text) to authenticated;
grant execute on function public.admin_adjust_balance(uuid, numeric, text) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- ============================================================================
-- End of migration.
-- ============================================================================
