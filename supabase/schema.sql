create table if not exists public.warehouse_state (
  id integer primary key check (id = 1),
  revision bigint not null default 0,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.pickup_signature_requests (
  id uuid primary key,
  revision bigint not null default 0,
  data jsonb not null,
  delete_token uuid,
  updated_at timestamptz not null default now()
);

alter table public.pickup_signature_requests
  add column if not exists delete_token uuid;

alter table public.pickup_signature_requests enable row level security;
revoke all on table public.pickup_signature_requests from public, anon, authenticated;

create or replace function public.get_pickup_signature_requests(p_request_ids uuid[])
returns table(data jsonb, revision bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select request.data, request.revision
  from public.pickup_signature_requests as request
  where request.id = any(p_request_ids)
$$;

revoke all on function public.get_pickup_signature_requests(uuid[]) from public;
grant execute on function public.get_pickup_signature_requests(uuid[]) to anon, authenticated;

create or replace function public.list_pickup_signature_requests()
returns table(data jsonb, revision bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select request.data, request.revision
  from public.pickup_signature_requests as request
  order by request.updated_at desc
$$;

revoke all on function public.list_pickup_signature_requests() from public;
grant execute on function public.list_pickup_signature_requests() to anon, authenticated;

drop function if exists public.create_pickup_signature_request(uuid, jsonb);

create or replace function public.create_pickup_signature_request(
  p_request_id uuid,
  p_request_data jsonb,
  p_delete_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  if p_request_id is null
    or p_delete_token is null
    or jsonb_typeof(p_request_data) is distinct from 'object'
    or p_request_data ->> 'id' is distinct from p_request_id::text
    or p_request_data ? 'productionSignature'
    or p_request_data ? 'logisticsSignature' then
    raise exception 'Invalid pickup signature request';
  end if;

  insert into public.pickup_signature_requests (id, data, delete_token)
  values (p_request_id, p_request_data, p_delete_token)
  on conflict (id) do nothing;

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke all on function public.create_pickup_signature_request(uuid, jsonb, uuid) from public;
grant execute on function public.create_pickup_signature_request(uuid, jsonb, uuid) to anon, authenticated;

create or replace function public.delete_pickup_signature_request(
  p_request_id uuid,
  p_delete_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  if p_request_id is null or p_delete_token is null then
    raise exception 'Invalid pickup signature deletion';
  end if;

  delete from public.pickup_signature_requests
  where id = p_request_id
    and delete_token = p_delete_token;

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke all on function public.delete_pickup_signature_request(uuid, uuid) from public;
grant execute on function public.delete_pickup_signature_request(uuid, uuid) to anon, authenticated;

create or replace function public.save_pickup_signature_request(
  p_request_id uuid,
  p_expected_revision bigint,
  p_role text,
  p_signature jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_revision bigint;
begin
  if p_request_id is null
    or p_expected_revision is null
    or p_role is distinct from 'production'
    or jsonb_typeof(p_signature) is distinct from 'object'
    or nullif(btrim(p_signature ->> 'name'), '') is null
    or coalesce(p_signature ->> 'image' like 'data:image/png;base64,%', false) = false
    or nullif(btrim(p_signature ->> 'signedAt'), '') is null then
    raise exception 'Invalid pickup signature';
  end if;

  update public.pickup_signature_requests
  set data = jsonb_set(data, '{productionSignature}', p_signature, true),
      revision = revision + 1,
      updated_at = now()
  where id = p_request_id
    and revision = p_expected_revision
    and coalesce(data -> 'productionSignature', 'null'::jsonb) = 'null'::jsonb
  returning revision into next_revision;

  return next_revision;
end;
$$;

revoke all on function public.save_pickup_signature_request(uuid, bigint, text, jsonb) from public;
grant execute on function public.save_pickup_signature_request(uuid, bigint, text, jsonb) to anon, authenticated;

alter table public.warehouse_state enable row level security;

drop policy if exists "Public can read shared warehouse state" on public.warehouse_state;
create policy "Public can read shared warehouse state"
  on public.warehouse_state for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can create shared warehouse state" on public.warehouse_state;
create policy "Public can create shared warehouse state"
  on public.warehouse_state for insert
  to anon, authenticated
  with check (id = 1);

drop policy if exists "Public can update shared warehouse state" on public.warehouse_state;
create policy "Public can update shared warehouse state"
  on public.warehouse_state for update
  to anon, authenticated
  using (id = 1)
  with check (id = 1);

grant select, insert, update on public.warehouse_state to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.warehouse_state;
exception
  when duplicate_object then null;
end
$$;
