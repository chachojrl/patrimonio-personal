-- =====================================================================
-- 0009 · Historial de cambios, lista de la compra y viajes.
--
-- - cambios: quién cambió qué y cuándo (lo apunta la base de datos sola; nadie
--   puede escribirlo ni borrarlo desde la app). Se guarda un año.
-- - lista_compra: lista compartida en tiempo real dentro de cada cuenta.
-- - viajes / viaje_gastos: presupuesto de un viaje con gastos en otra moneda.
--
-- Todo con la misma seguridad que el resto: solo lo ven los miembros de la cuenta.
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------
create table if not exists public.cambios (
  id bigint generated always as identity primary key,
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  tabla text not null,
  fila_id uuid,
  accion text not null check (accion in ('alta', 'cambio', 'baja')),
  detalle jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);
create index if not exists cambios_cuenta_fecha on public.cambios(cuenta_id, creado_en desc);

create table if not exists public.lista_compra (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null default public.mi_cuenta_personal() references public.cuentas(id) on delete cascade,
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  texto text not null default '',
  hecho boolean not null default false,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lista_compra_cuenta_idx on public.lista_compra(cuenta_id);

create table if not exists public.viajes (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null default public.mi_cuenta_personal() references public.cuentas(id) on delete cascade,
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  nombre text not null default 'Viaje',
  moneda text not null default 'EUR' check (moneda ~ '^[A-Z]{3}$'),
  cambio numeric(14,6) not null default 1 check (cambio > 0), -- euros por 1 unidad de la moneda
  presupuesto numeric(12,2) check (presupuesto is null or presupuesto >= 0), -- en euros
  fecha_inicio date,
  fecha_fin date,
  cerrado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists viajes_cuenta_idx on public.viajes(cuenta_id);

create table if not exists public.viaje_gastos (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.viajes(id) on delete cascade,
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  fecha date not null default current_date,
  concepto text not null default '',
  categoria text not null default 'otros'
    check (categoria in ('alojamiento', 'transporte', 'comida', 'ocio', 'compras', 'otros')),
  importe numeric(12,2) not null default 0 check (importe >= 0), -- en la moneda del gasto
  moneda text not null default 'EUR' check (moneda ~ '^[A-Z]{3}$'),
  cambio numeric(14,6) not null default 1 check (cambio > 0), -- euros por unidad, el del día del gasto
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists viaje_gastos_viaje_idx on public.viaje_gastos(viaje_id);
create index if not exists viaje_gastos_cuenta_idx on public.viaje_gastos(cuenta_id);

-- Los gastos de un viaje heredan SIEMPRE la cuenta del viaje (si no lo ves, falla)
create or replace function public.tg_cuenta_desde_viaje() returns trigger
language plpgsql set search_path = public as $$
declare c uuid;
begin
  select v.cuenta_id into c from public.viajes v where v.id = new.viaje_id;
  if c is null then
    raise exception 'El gasto no pertenece a ningún viaje accesible.' using errcode = '23503';
  end if;
  new.cuenta_id := c;
  return new;
end $$;

drop trigger if exists a_cuenta on public.viaje_gastos;
create trigger a_cuenta before insert or update on public.viaje_gastos
  for each row execute function public.tg_cuenta_desde_viaje();

-- ---------------------------------------------------------------------
-- Seguridad
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['lista_compra', 'viajes', 'viaje_gastos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists miembro on public.%I', t);
    execute format(
      'create policy miembro on public.%I for all to authenticated using (public.es_miembro(cuenta_id)) with check (public.es_miembro(cuenta_id))', t);
    execute format('revoke all on public.%I from anon, public', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop trigger if exists updated_at on public.%I', t);
    execute format('create trigger updated_at before update on public.%I for each row execute function public.tg_updated_at()', t);
  end loop;
end $$;

-- El historial solo se puede leer (lo escribe el trigger)
alter table public.cambios enable row level security;
revoke all on public.cambios from anon, authenticated, public;
drop policy if exists ver on public.cambios;
create policy ver on public.cambios for select to authenticated using (public.es_miembro(cuenta_id));
grant select on public.cambios to authenticated;

-- ---------------------------------------------------------------------
-- Historial: un trigger apunta cada cambio hecho por una persona
-- ---------------------------------------------------------------------
create or replace function public.tg_registrar_cambio() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  o jsonb;
  campos text[] := array['concepto', 'importe', 'fecha_vencimiento', 'fijo', 'presupuesto', 'titulo', 'estado',
                         'saldo_real_cuenta', 'valor_real_inversiones', 'tipo', 'origen', 'fecha', 'persona',
                         'devuelto_en', 'nota'];
  c text;
  dif jsonb := '{}'::jsonb;
  cuenta uuid;
  mes date;
  nombre text;
  detalle jsonb;
begin
  -- Escrituras hechas por otros triggers (aportaciones, «último cambio»…) no son de una persona
  if pg_trigger_depth() > 1 then return null; end if;

  if tg_op = 'DELETE' then r := to_jsonb(old); else r := to_jsonb(new); end if;
  if tg_op = 'UPDATE' then o := to_jsonb(old); end if;

  -- Aportaciones automáticas: las calcula el servidor, no se apuntan
  if coalesce(r ->> 'aportacion_de', r ->> 'aportacion_cuenta') is not null then return null; end if;

  if tg_op = 'UPDATE' then
    foreach c in array campos loop
      if r ? c and (r -> c) is distinct from (o -> c) then
        dif := dif || jsonb_build_object(c, jsonb_build_array(o -> c, r -> c));
      end if;
    end loop;
    if dif = '{}'::jsonb then return null; end if; -- solo cambió el orden, la fecha de modificación…
  end if;

  -- Filas que se copian al crear un mes (vacías o gastos fijos): ya se apunta «creó el mes»
  if tg_op = 'INSERT' and tg_table_name in ('incomes', 'expenses') then
    if coalesce((r ->> 'importe')::numeric, 0) = 0
       or exists (select 1 from months m where m.id = (r ->> 'month_id')::uuid and m.created_at = now()) then
      return null; -- now() = inicio de la transacción: el mes se acaba de crear en esta misma operación
    end if;
  end if;

  cuenta := (r ->> 'cuenta_id')::uuid;
  -- Se está borrando la cuenta entera (en cascada): no hay dónde apuntarlo
  if not exists (select 1 from cuentas where id = cuenta) then return null; end if;
  if tg_table_name = 'months' then
    mes := (r ->> 'fecha')::date;
    nombre := r ->> 'titulo';
  elsif tg_table_name = 'expense_entries' then
    select e.concepto, m.fecha into nombre, mes
      from expenses e join months m on m.id = e.month_id where e.id = (r ->> 'expense_id')::uuid;
  elsif tg_table_name = 'debts' then
    nombre := r ->> 'persona';
  else
    select m.fecha into mes from months m where m.id = (r ->> 'month_id')::uuid;
    nombre := coalesce(r ->> 'concepto', r ->> 'tipo');
  end if;

  detalle := jsonb_build_object('nombre', nombre, 'mes', mes);
  if tg_op = 'UPDATE' then
    detalle := detalle || jsonb_build_object('cambios', dif);
  else
    detalle := detalle || jsonb_strip_nulls(jsonb_build_object('importe', r -> 'importe', 'nota', r -> 'nota', 'concepto', r -> 'concepto'));
  end if;

  insert into cambios (cuenta_id, user_id, tabla, fila_id, accion, detalle)
  values (cuenta, auth.uid(), tg_table_name, (r ->> 'id')::uuid,
          case tg_op when 'INSERT' then 'alta' when 'UPDATE' then 'cambio' else 'baja' end, detalle);

  -- Se guarda un año
  delete from cambios where cuenta_id = cuenta and creado_en < now() - interval '1 year';
  return null;
end $$;

revoke all on function public.tg_registrar_cambio() from public, anon, authenticated;
revoke all on function public.tg_cuenta_desde_viaje() from public, anon;

do $$
declare t text;
begin
  foreach t in array array['months', 'incomes', 'expenses', 'expense_entries', 'savings', 'debts'] loop
    execute format('drop trigger if exists historial on public.%I', t);
    execute format('create trigger historial after insert or update or delete on public.%I for each row execute function public.tg_registrar_cambio()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Tiempo real para la lista de la compra y los viajes
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['lista_compra', 'viajes', 'viaje_gastos'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
