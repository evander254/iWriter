begin;

-- Create/read a writer's single support conversation without relying on a
-- client-side INSERT policy check. The function is bound to auth.uid(), not
-- to a writer id supplied by the browser.
create or replace function public.get_or_create_support_conversation()
returns public.support_conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_status text;
  v_conversation public.support_conversations;
begin
  if v_uid is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  select p.role, p.status into v_role, v_status
    from public.profiles p where p.id = v_uid;
  if v_role is distinct from 'writer' or v_status is distinct from 'active' then
    raise exception 'Only active writers can open support chat.' using errcode = '42501';
  end if;

  insert into public.support_conversations (writer_id)
  values (v_uid)
  on conflict (writer_id) do update
    set writer_id = excluded.writer_id
  returning * into v_conversation;

  return v_conversation;
end;
$$;

revoke all on function public.get_or_create_support_conversation() from public, anon;
grant execute on function public.get_or_create_support_conversation() to authenticated;
notify pgrst, 'reload schema';
commit;
