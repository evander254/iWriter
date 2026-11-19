-- Link assignment notifications to their assignment and notify writers when
-- an assignment first becomes publicly claimable.
begin;

alter table public.notifications
  add column if not exists assignment_id uuid;

create index if not exists notifications_assignment_idx
  on public.notifications (assignment_id)
  where assignment_id is not null;

create or replace function public.notify_writers_of_new_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'available' and new.visibility = 'public'
     and (
       tg_op = 'INSERT'
       or old.status is distinct from 'available'
       or old.visibility is distinct from 'public'
     ) then
    insert into public.notifications (user_id, title, message, type, assignment_id)
    select p.id,
           'New assignment available',
           'A new assignment, "' || new.title || '", has been added and is ready to claim.',
           'assignment',
           new.id
      from public.profiles p
     where p.role = 'writer';
  end if;
  return new;
end;
$$;

drop trigger if exists assignments_notify_writers on public.assignments;
create trigger assignments_notify_writers
  after insert or update of status, visibility on public.assignments
  for each row execute function public.notify_writers_of_new_assignment();

commit;
