-- Enable Supabase Realtime for platform data used by live dashboards and alerts.
-- Safe to apply when a table is already part of the publication.
do $$
declare
  v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication is not available; skipping realtime table registration';
    return;
  end if;

  foreach v_table in array array[
    'assignments', 'assignment_claims', 'submissions', 'notifications',
    'profiles', 'transactions', 'withdrawal_requests', 'revision_requests',
    'announcements', 'assignment_history'
  ] loop
    if to_regclass('public.' || v_table) is not null and not exists (
      select 1
        from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end $$;
