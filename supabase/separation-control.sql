create table if not exists public.production_separations (
  id uuid primary key,
  revision bigint not null default 0,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint production_separations_data_id_matches
    check (data ? 'id' and data ->> 'id' = id::text)
);

alter table public.production_separations enable row level security;

drop policy if exists "Public can read production separations" on public.production_separations;
create policy "Public can read production separations"
  on public.production_separations for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can create production separations" on public.production_separations;
create policy "Public can create production separations"
  on public.production_separations for insert
  to anon, authenticated
  with check (revision = 0 and data ? 'id' and data ->> 'id' = id::text);

drop policy if exists "Public can update production separations" on public.production_separations;
create policy "Public can update production separations"
  on public.production_separations for update
  to anon, authenticated
  using (true)
  with check (data ? 'id' and data ->> 'id' = id::text);

grant select, insert, update on public.production_separations to anon, authenticated;
drop policy if exists "Public can delete production separations" on public.production_separations;
revoke delete on public.production_separations from anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.production_separations;
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.production_separation_history (
  id uuid primary key default gen_random_uuid(),
  order_number text not null check (btrim(order_number) <> ''),
  client_name text not null default '',
  finalized_at timestamptz not null default now(),
  data jsonb not null,
  constraint production_separation_history_order_matches
    check (data ? 'orderNumber' and data ->> 'orderNumber' = order_number)
);

alter table public.production_separation_history enable row level security;

drop policy if exists "Public can read separation history" on public.production_separation_history;
create policy "Public can read separation history"
  on public.production_separation_history for select
  to anon, authenticated
  using (true);

grant select on public.production_separation_history to anon, authenticated;
revoke insert, update, delete on public.production_separation_history from anon, authenticated;

create or replace function public.finalize_production_separation(
  p_id uuid,
  p_revision bigint
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  active_row public.production_separations%rowtype;
  history_id uuid;
begin
  if p_id <> '00000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'Identificador da sequência ativa inválido.';
  end if;

  select * into active_row
  from public.production_separations
  where id = p_id and revision = p_revision
  for update;

  if not found then
    raise exception 'A sequência foi alterada ou já foi finalizada. Atualize a tela.';
  end if;

  insert into public.production_separation_history (order_number, client_name, data)
  values (
    active_row.data ->> 'orderNumber',
    coalesce(active_row.data ->> 'clientName', ''),
    active_row.data
  )
  returning id into history_id;

  delete from public.production_separations
  where id = p_id and revision = p_revision;

  if not found then
    raise exception 'Não foi possível limpar a sequência ativa; nada foi arquivado.';
  end if;

  return history_id;
end;
$$;

revoke all on function public.finalize_production_separation(uuid, bigint) from public;
grant execute on function public.finalize_production_separation(uuid, bigint) to anon, authenticated;

create table if not exists public.production_equipment_swaps (
  id uuid primary key default gen_random_uuid(),
  order_number text not null check (btrim(order_number) <> ''),
  client_name text not null default '',
  equipment_type text not null default '',
  component text not null check (component in ('serial', 'ccid')),
  previous_value text not null check (btrim(previous_value) <> ''),
  new_value text not null check (btrim(new_value) <> ''),
  responsible text not null default '',
  swapped_on date not null default current_date,
  constraint production_equipment_swaps_values_differ
    check (previous_value <> new_value)
);

alter table public.production_equipment_swaps enable row level security;

drop policy if exists "Public can read equipment swap history" on public.production_equipment_swaps;
create policy "Public can read equipment swap history"
  on public.production_equipment_swaps for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can add equipment swaps" on public.production_equipment_swaps;
create policy "Public can add equipment swaps"
  on public.production_equipment_swaps for insert
  to anon, authenticated
  with check (true);

grant select, insert on public.production_equipment_swaps to anon, authenticated;
revoke update, delete on public.production_equipment_swaps from anon, authenticated;
