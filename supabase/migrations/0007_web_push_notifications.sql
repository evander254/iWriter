-- Per-device Web Push subscriptions and a database-triggered sender request.
-- The sender URL and shared dispatch token are stored in Supabase Vault.
begin;

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.push_subscriptions to authenticated;

create or replace function public.dispatch_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_project_url text;
  v_dispatch_secret text;
begin
  select decrypted_secret into v_project_url
    from vault.decrypted_secrets
   where name = 'supabase_project_url'
   limit 1;
  select decrypted_secret into v_dispatch_secret
    from vault.decrypted_secrets
   where name = 'push_dispatch_secret'
   limit 1;

  -- Push is optional until deployment secrets are configured; notification
  -- creation itself must never be blocked by delivery infrastructure.
  if coalesce(v_project_url, '') = '' or coalesce(v_dispatch_secret, '') = '' then
    raise warning 'Web Push secrets missing from Supabase Vault; notification % was not dispatched', new.id;
    return new;
  end if;

  perform net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-dispatch-secret', v_dispatch_secret
    ),
    body := jsonb_build_object('notification_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists notifications_dispatch_push on public.notifications;
create trigger notifications_dispatch_push
  after insert on public.notifications
  for each row execute function public.dispatch_notification_push();

commit;
