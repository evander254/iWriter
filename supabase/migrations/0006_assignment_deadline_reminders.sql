-- Send a single reminder when an active assignment is within 30 minutes of
-- its deadline. Runs in the database so it works even when writers are away.
begin;

create extension if not exists pg_cron with schema pg_catalog;

create unique index if not exists notifications_assignment_deadline_once
  on public.notifications (user_id, assignment_id, type)
  where type = 'assignment_deadline_30' and assignment_id is not null;

create or replace function public.send_assignment_deadline_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  insert into public.notifications (user_id, title, message, type, assignment_id)
  select c.writer_id,
         '30 minutes left to submit',
         'You have 30 minutes left to submit "' || a.title || '".',
         'assignment_deadline_30',
         a.id
    from public.assignment_claims c
    join public.assignments a on a.id = c.assignment_id
   where c.status in ('claimed', 'revision')
     and a.deadline > now()
     and a.deadline <= now() + interval '30 minutes'
     and c.writer_id is not null
  on conflict (user_id, assignment_id, type)
    where type = 'assignment_deadline_30' and assignment_id is not null
  do nothing;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- Replace a prior version of this named job, making this migration repeatable.
do $$
declare
  v_job_id bigint;
begin
  for v_job_id in select jobid from cron.job where jobname = 'assignment-deadline-reminders' loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'assignment-deadline-reminders',
    '* * * * *',
    'select public.send_assignment_deadline_reminders();'
  );
end $$;

commit;
