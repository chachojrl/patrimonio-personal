-- "Te deben": dinero que has prestado o adelantado y está pendiente de devolver.
-- No pertenece a ningún mes ni entra en los cálculos del presupuesto.
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez sin problema.

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  persona text not null default '',
  concepto text not null default '',
  importe numeric(12,2) not null default 0 check (importe >= 0),
  fecha date not null default current_date,
  devuelto_en date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists debts_user_idx on public.debts(user_id);

-- Misma seguridad que el resto de tablas: solo el propietario (app_owner) ve sus filas
alter table public.debts enable row level security;
alter table public.debts force row level security;
drop policy if exists propietario on public.debts;
create policy propietario on public.debts for all to authenticated
  using (public.es_propietario(user_id)) with check (public.es_propietario(user_id));
revoke all on public.debts from anon, public;
grant select, insert, update, delete on public.debts to authenticated;

drop trigger if exists updated_at on public.debts;
create trigger updated_at before update on public.debts
  for each row execute function public.tg_updated_at();
