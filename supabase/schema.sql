create table if not exists public.warehouse_state (
  id integer primary key check (id = 1),
  revision bigint not null default 0,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

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
