-- Writer expertise preferences drive marketplace eligibility, claim guards,
-- and new-assignment notifications.
begin;

create table if not exists public.writer_subjects (
  writer_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (writer_id, subject_id)
);

alter table public.writer_subjects enable row level security;
drop policy if exists writer_subjects_select_own on public.writer_subjects;
create policy writer_subjects_select_own on public.writer_subjects
  for select to authenticated using (writer_id = auth.uid());
revoke insert, update, delete on public.writer_subjects from authenticated, anon;
grant select on public.writer_subjects to authenticated;

create or replace function public.set_writer_subjects(p_subject_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_requested integer;
  v_valid integer;
  v_unique integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;
  select role into v_role from public.profiles where id = v_uid for update;
  if v_role is distinct from 'writer' then
    raise exception 'Only writers can update their expertise.' using errcode = '42501';
  end if;
  if not public.is_active_user() then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;

  v_requested := coalesce(cardinality(p_subject_ids), 0);
  if v_requested > 30 then
    raise exception 'Choose no more than 30 expertise subjects.' using errcode = '22023';
  end if;
  select count(distinct s.id)::integer into v_valid
    from public.subjects s
   where s.id = any(coalesce(p_subject_ids, array[]::uuid[]));
  select count(distinct requested.subject_id)::integer into v_unique
    from unnest(coalesce(p_subject_ids, array[]::uuid[])) as requested(subject_id);
  if v_valid <> v_unique then
    raise exception 'One or more selected subjects are unavailable.' using errcode = '22023';
  end if;

  delete from public.writer_subjects where writer_id = v_uid;
  insert into public.writer_subjects (writer_id, subject_id)
  select v_uid, subject_id
    from unnest(coalesce(p_subject_ids, array[]::uuid[])) as selected(subject_id)
  on conflict do nothing;
end;
$$;

grant execute on function public.set_writer_subjects(uuid[]) to authenticated;

-- Prevent a writer from claiming a subject outside their selected expertise,
-- even if they call the claim RPC directly with an assignment id.
create or replace function public.enforce_writer_assignment_subject()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject_id uuid;
begin
  select subject_id into v_subject_id
    from public.assignments
   where id = new.assignment_id;
  if v_subject_id is null or not exists (
    select 1 from public.writer_subjects
     where writer_id = new.writer_id and subject_id = v_subject_id
  ) then
    raise exception 'This assignment is outside your selected skills and subjects.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists assignment_claims_subject_guard on public.assignment_claims;
create trigger assignment_claims_subject_guard
  before insert on public.assignment_claims
  for each row execute function public.enforce_writer_assignment_subject();

-- Deliver new assignment alerts only to writers who selected its subject.
create or replace function public.notify_writers_of_new_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'available' and new.visibility = 'public'
     and new.subject_id is not null
     and (
       tg_op = 'INSERT'
       or old.status is distinct from 'available'
       or old.visibility is distinct from 'public'
     ) then
    insert into public.notifications (user_id, title, message, type, assignment_id)
    select ws.writer_id,
           'New assignment available',
           'A new assignment, "' || new.title || '", in ' || s.name || ' is ready to claim.',
           'assignment',
           new.id
      from public.writer_subjects ws
      join public.profiles p on p.id = ws.writer_id and p.role = 'writer'
      join public.subjects s on s.id = ws.subject_id
     where ws.subject_id = new.subject_id;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
commit;
