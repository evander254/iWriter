begin;

-- Enforce the writer expertise limit at the trusted database boundary too.
create or replace function public.set_writer_subjects(p_subject_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_valid integer;
  v_unique integer;
begin
  if v_uid is null then raise exception 'Not authenticated.' using errcode = '28000'; end if;
  select role into v_role from public.profiles where id = v_uid for update;
  if v_role is distinct from 'writer' or not public.is_active_user() then
    raise exception 'Only active writers can update expertise.' using errcode = '42501';
  end if;
  select count(distinct x.subject_id)::integer into v_unique
    from unnest(coalesce(p_subject_ids, array[]::uuid[])) as x(subject_id);
  if v_unique > 7 then raise exception 'Choose no more than 7 expertise subjects.' using errcode = '22023'; end if;
  select count(distinct s.id)::integer into v_valid
    from public.subjects s where s.id = any(coalesce(p_subject_ids, array[]::uuid[]));
  if v_valid <> v_unique then raise exception 'One or more selected subjects are unavailable.' using errcode = '22023'; end if;
  delete from public.writer_subjects where writer_id = v_uid;
  insert into public.writer_subjects (writer_id, subject_id)
  select v_uid, x.subject_id
    from unnest(coalesce(p_subject_ids, array[]::uuid[])) as x(subject_id)
  on conflict do nothing;
end;
$$;
grant execute on function public.set_writer_subjects(uuid[]) to authenticated;

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  writer_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint support_messages_body_or_files check (length(trim(body)) > 0 or jsonb_array_length(attachments) > 0)
);

create index if not exists support_messages_conversation_created_idx
  on public.support_messages (conversation_id, created_at);
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists support_conversations_read on public.support_conversations;
create policy support_conversations_read on public.support_conversations
  for select to authenticated using (writer_id = auth.uid() or public.is_admin());
drop policy if exists support_conversations_create on public.support_conversations;
create policy support_conversations_create on public.support_conversations
  for insert to authenticated with check (
    writer_id = auth.uid() and exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'writer' and p.status = 'active'
    )
  );

drop policy if exists support_messages_read on public.support_messages;
create policy support_messages_read on public.support_messages
  for select to authenticated using (
    public.is_admin() or exists (
      select 1 from public.support_conversations c
      where c.id = conversation_id and c.writer_id = auth.uid()
    )
  );
drop policy if exists support_messages_send on public.support_messages;
create policy support_messages_send on public.support_messages
  for insert to authenticated with check (
    sender_id = auth.uid() and (
      public.is_admin() or exists (
        select 1 from public.support_conversations c
        where c.id = conversation_id and c.writer_id = auth.uid()
      )
    )
  );

create or replace function public.touch_support_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.support_conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;
drop trigger if exists support_messages_touch_conversation on public.support_messages;
create trigger support_messages_touch_conversation after insert on public.support_messages
  for each row execute function public.touch_support_conversation();

insert into storage.buckets (id, name, public, file_size_limit)
values ('support-attachments', 'support-attachments', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
drop policy if exists support_attachments_read on storage.objects;
create policy support_attachments_read on storage.objects
  for select to authenticated using (
    bucket_id = 'support-attachments'
    and split_part(name, '/', 1) = 'support'
    and exists (
      select 1 from public.support_conversations c
      where c.id::text = split_part(name, '/', 2)
        and (c.writer_id = auth.uid() or public.is_admin())
    )
  );
drop policy if exists support_attachments_insert on storage.objects;
create policy support_attachments_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'support-attachments'
    and split_part(name, '/', 1) = 'support'
    and exists (
      select 1 from public.support_conversations c
      where c.id::text = split_part(name, '/', 2)
        and (c.writer_id = auth.uid() or public.is_admin())
    )
  );

do $$
begin
  alter publication supabase_realtime add table public.support_messages;
exception when duplicate_object then null;
when undefined_object then null;
end $$;

grant select, insert on public.support_conversations to authenticated;
grant select, insert on public.support_messages to authenticated;
notify pgrst, 'reload schema';
commit;
