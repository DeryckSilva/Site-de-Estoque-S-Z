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

drop policy if exists "Public can delete production separations" on public.production_separations;
create policy "Public can delete production separations"
  on public.production_separations for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on public.production_separations to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.production_separations;
exception
  when duplicate_object then null;
end
$$;
