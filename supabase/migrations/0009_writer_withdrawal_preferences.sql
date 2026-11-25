-- Writers save one default payout method; it can be changed once per month.
-- Requests are permitted only on the 1st and 15th, with a $5 minimum.
begin;

create table if not exists public.writer_withdrawal_methods (
  writer_id uuid primary key references public.profiles(id) on delete cascade,
  method text not null,
  account_number text not null,
  last_changed_at timestamptz not null default now(),
  constraint writer_withdrawal_method_length check (char_length(trim(method)) >= 2),
  constraint writer_withdrawal_account_length check (char_length(trim(account_number)) between 4 and 120)
);

alter table public.writer_withdrawal_methods enable row level security;
drop policy if exists writer_withdrawal_methods_select_own on public.writer_withdrawal_methods;
create policy writer_withdrawal_methods_select_own on public.writer_withdrawal_methods
  for select to authenticated using (writer_id = auth.uid());
revoke insert, update, delete on public.writer_withdrawal_methods from authenticated, anon;
grant select on public.writer_withdrawal_methods to authenticated;

create or replace function public.set_writer_withdrawal_method(
  p_method text,
  p_account_number text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_last_changed timestamptz;
begin
  if v_uid is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;
  select role into v_role from public.profiles where id = v_uid for update;
  if v_role is distinct from 'writer' then
    raise exception 'Only writers can set a withdrawal method.' using errcode = '42501';
  end if;
  if not public.is_active_user() then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;
  if p_method is null or char_length(trim(p_method)) < 2 then
    raise exception 'Choose a valid withdrawal method.' using errcode = '22023';
  end if;
  if p_account_number is null or char_length(trim(p_account_number)) not between 4 and 120 then
    raise exception 'Enter valid account or wallet details.' using errcode = '22023';
  end if;

  select last_changed_at into v_last_changed
    from public.writer_withdrawal_methods
   where writer_id = v_uid
   for update;
  if found then
    if date_trunc('month', v_last_changed at time zone 'UTC') = date_trunc('month', now() at time zone 'UTC') then
      raise exception 'Your withdrawal method can only be changed once per calendar month.' using errcode = 'P0001';
    end if;
    update public.writer_withdrawal_methods
       set method = trim(p_method), account_number = trim(p_account_number), last_changed_at = now()
     where writer_id = v_uid;
  else
    insert into public.writer_withdrawal_methods (writer_id, method, account_number, last_changed_at)
    values (v_uid, trim(p_method), trim(p_account_number), now());
  end if;
end;
$$;

-- Remove the old RPC which accepted arbitrary payout details per request.
drop function if exists public.request_withdrawal(numeric, text, text);

create or replace function public.request_withdrawal(p_amount numeric)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_balance numeric;
  v_role text;
  v_method public.writer_withdrawal_methods%rowtype;
  v_request_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;
  select role into v_role from public.profiles where id = v_uid for update;
  if v_role is distinct from 'writer' then
    raise exception 'Only writers can request withdrawals.' using errcode = '42501';
  end if;
  if not public.is_active_user() then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 5 then
    raise exception 'The minimum withdrawal is $5.' using errcode = 'P0001';
  end if;
  if extract(day from (now() at time zone 'UTC'))::integer not in (1, 15) then
    raise exception 'Withdrawals are only available on the 1st and 15th of each month (UTC).' using errcode = 'P0001';
  end if;

  select * into v_method
    from public.writer_withdrawal_methods
   where writer_id = v_uid;
  if not found then
    raise exception 'Set up your default withdrawal method before requesting a payout.' using errcode = 'P0001';
  end if;

  update public.profiles
     set available_balance = coalesce(available_balance, 0) - p_amount
   where id = v_uid and coalesce(available_balance, 0) >= p_amount
   returning available_balance into v_balance;
  if v_balance is null then
    raise exception 'Insufficient available balance.' using errcode = 'P0001';
  end if;

  insert into public.withdrawal_requests (user_id, amount, method, account_number, status)
  values (v_uid, p_amount, v_method.method, v_method.account_number, 'pending')
  returning id into v_request_id;

  insert into public.transactions (user_id, amount, transaction_type, description, reference)
  values (v_uid, -p_amount, 'withdrawal', 'Withdrawal request', v_request_id::text);
  insert into public.activity_logs (user_id, activity)
  values (v_uid, 'Requested a withdrawal of ' || p_amount::text);
  insert into public.notifications (user_id, title, message, type)
  select p.id, 'New withdrawal request', 'A withdrawal request of ' || p_amount::text || ' was submitted.', 'withdrawal'
    from public.profiles p where p.role = 'admin' and p.status <> 'suspended';

  return v_request_id;
end;
$$;

grant execute on function public.set_writer_withdrawal_method(text, text) to authenticated;
grant execute on function public.request_withdrawal(numeric) to authenticated;

commit;
