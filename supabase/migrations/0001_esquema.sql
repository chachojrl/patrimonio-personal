-- =====================================================================
-- Presupuesto personal — esquema, seguridad (RLS) y reglas de negocio
-- Ejecutar entero en Supabase → SQL Editor (o con `supabase db push`).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Propietario de la app: SOLO los emails de esta tabla pueden ver datos.
-- La tabla no es accesible desde la API (RLS activado y sin políticas).
-- Después de ejecutar este script:
--   insert into public.app_owner (email) values ('tu-email@ejemplo.com');
-- ---------------------------------------------------------------------
create table if not exists public.app_owner (
  email text primary key,
  requiere_mfa boolean not null default false
);
alter table public.app_owner enable row level security;

create or replace function public.es_propietario(fila_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select fila_user = auth.uid()
     and exists (
       select 1 from public.app_owner o
       where lower(o.email) = lower(auth.jwt() ->> 'email')
         and (not o.requiere_mfa or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2')
     );
$$;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------
create table if not exists public.config (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  mes_inicio date not null default '2026-10-01' check (extract(day from mes_inicio) = 1),
  ajuste_cuenta_gastos_inicial numeric(12,2) not null default -327.96,
  inversiones_iniciales numeric(12,2) not null default 9336.00,
  aportado_inicial_inversiones numeric(12,2) not null default 11570.00,
  cuenta_remunerada_inicial numeric(12,2) not null default 18488.75,
  plantilla_ingresos text[] not null default array['Nomina','Fuente de ingresos 2','Fuente de ingresos 3','Fuente de ingresos 4','Otros'],
  plantilla_gastos text[] not null default array['Alquiler/hipoteca','Electricidad','Gas','Teléfono móvil/WiFi','Supermercado','Pago del coche','Gastos del automóvil/Gasolina','Seguro del automóvil','Restaurantes','Entretenimiento','Comida oficina','Regalos','Ropa','Otros'],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha date not null check (extract(day from fecha) = 1),
  titulo text not null default 'Presupuesto personal',
  estado text not null default 'Abierto' check (estado in ('Abierto','Cerrado')),
  ultimo_cambio timestamptz,
  saldo_real_cuenta numeric(12,2),
  valor_real_inversiones numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fecha)
);

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month_id uuid not null references public.months(id) on delete cascade,
  concepto text not null default '',
  importe numeric(12,2) not null default 0 check (importe >= 0),
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month_id uuid not null references public.months(id) on delete cascade,
  concepto text not null default '',
  fecha_vencimiento date,
  importe numeric(12,2) not null default 0 check (importe >= 0),
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  importe numeric(12,2) not null check (importe > 0),
  creado_en timestamptz not null default now(),
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.savings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month_id uuid not null references public.months(id) on delete cascade,
  fecha date,
  importe numeric(12,2) not null default 0 check (importe >= 0),
  tipo text not null default 'Inversiones' check (tipo in ('Inversiones','Cuenta remunerada')),
  origen text not null default 'Ingresos mensuales' check (origen in ('Ingresos mensuales','Cuenta remunerada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ahorro_combinacion_valida check (not (tipo = 'Cuenta remunerada' and origen = 'Cuenta remunerada'))
);

create index if not exists incomes_month_idx on public.incomes(month_id);
create index if not exists expenses_month_idx on public.expenses(month_id);
create index if not exists entries_expense_idx on public.expense_entries(expense_id);
create index if not exists savings_month_idx on public.savings(month_id);

-- ---------------------------------------------------------------------
-- Row Level Security: cada fila solo es visible/modificable por su dueño
-- (y además ese dueño tiene que estar en app_owner).
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['config','months','incomes','expenses','expense_entries','savings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists propietario on public.%I', t);
    execute format(
      'create policy propietario on public.%I for all to authenticated using (public.es_propietario(user_id)) with check (public.es_propietario(user_id))', t);
    execute format('revoke all on public.%I from anon, public', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

revoke all on public.app_owner from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.tg_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['config','months','incomes','expenses','expense_entries','savings'] loop
    execute format('drop trigger if exists updated_at on public.%I', t);
    execute format('create trigger updated_at before update on public.%I for each row execute function public.tg_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Mes cerrado = solo lectura  +  "Último cambio" (macro MarcarUltimoCambio)
-- ---------------------------------------------------------------------
create or replace function public.tg_hijos_mes() returns trigger
language plpgsql
set search_path = public
as $$
declare
  mid uuid;
  est text;
begin
  if tg_table_name = 'expense_entries' then
    select e.month_id into mid from expenses e
     where e.id = case when tg_op = 'DELETE' then old.expense_id else new.expense_id end;
  elsif tg_op = 'DELETE' then
    mid := old.month_id;
  else
    mid := new.month_id;
  end if;

  select m.estado into est from months m where m.id = mid;
  if est = 'Cerrado' then
    raise exception 'El mes está cerrado: reábrelo para modificarlo.' using errcode = 'P0001';
  end if;

  update months set ultimo_cambio = now() where id = mid;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['incomes','expenses','expense_entries','savings'] loop
    execute format('drop trigger if exists hijos_mes on public.%I', t);
    execute format('create trigger hijos_mes before insert or update or delete on public.%I for each row execute function public.tg_hijos_mes()', t);
  end loop;
end $$;

create or replace function public.tg_months() returns trigger
language plpgsql as $$
begin
  if old.estado = 'Cerrado' and new.estado = 'Cerrado'
     and (new.titulo is distinct from old.titulo
          or new.saldo_real_cuenta is distinct from old.saldo_real_cuenta
          or new.fecha is distinct from old.fecha) then
    raise exception 'El mes está cerrado: reábrelo para modificarlo.' using errcode = 'P0001';
  end if;
  if new.titulo is distinct from old.titulo
     or new.saldo_real_cuenta is distinct from old.saldo_real_cuenta then
    new.ultimo_cambio := now();
  end if;
  return new;
end $$;

drop trigger if exists months_reglas on public.months;
create trigger months_reglas before update on public.months
  for each row execute function public.tg_months();

-- ---------------------------------------------------------------------
-- Crear mes nuevo (macro CrearMesNuevo) en UNA transacción.
-- Solo permite crear el mes siguiente al último (o mes_inicio si no hay ninguno).
-- ---------------------------------------------------------------------
create or replace function public.insertar_mes(
  p_mes jsonb, p_incomes jsonb, p_expenses jsonb, p_cerrar uuid
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  f date := (p_mes ->> 'fecha')::date;
  mid uuid := (p_mes ->> 'id')::uuid;
  ultima date;
  inicio date;
begin
  select max(fecha) into ultima from months where user_id = auth.uid();
  if ultima is null then
    select mes_inicio into inicio from config where user_id = auth.uid();
    if inicio is not null and f <> inicio then
      raise exception 'El primer mes debe ser %.', to_char(inicio, 'MM/YYYY');
    end if;
  elsif f <> (ultima + interval '1 month')::date then
    raise exception 'Solo se puede crear el mes siguiente al último.';
  end if;

  insert into months (id, fecha, titulo, estado)
  values (mid, f, coalesce(p_mes ->> 'titulo', 'Presupuesto personal'), 'Abierto');

  insert into incomes (id, month_id, concepto, importe, orden)
  select (x ->> 'id')::uuid, mid, x ->> 'concepto', 0, (x ->> 'orden')::int
  from jsonb_array_elements(p_incomes) x;

  insert into expenses (id, month_id, concepto, fecha_vencimiento, importe, orden)
  select (x ->> 'id')::uuid, mid, x ->> 'concepto', null, 0, (x ->> 'orden')::int
  from jsonb_array_elements(p_expenses) x;

  -- Igual que la macro: "Último cambio" vacío en un mes recién creado
  update months set ultimo_cambio = null where id = mid;

  if p_cerrar is not null then
    update months set estado = 'Cerrado' where id = p_cerrar;
  end if;
end $$;

revoke all on function public.insertar_mes(jsonb, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.insertar_mes(jsonb, jsonb, jsonb, uuid) to authenticated;
revoke all on function public.es_propietario(uuid) from public, anon;
grant execute on function public.es_propietario(uuid) to authenticated;
