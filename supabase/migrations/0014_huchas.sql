-- =====================================================================
-- 0014 · Huchas (objetivos de ahorro).
--
-- - huchas: un objetivo («Viaje a Japón: 3.000 €») con fecha límite opcional,
--   aportación mensual prevista opcional y, si se quiere, la cuenta donde está
--   el dinero ('gastos', 'remunerada' o 'inversiones').
-- - hucha_movimientos: lo que se mete (importe positivo) o se saca (negativo).
--   «mes» es el mes de la aportación mensual (la que propone «Cerrar mes…»);
--   vacío para lo que se mete a mano.
--
-- Las huchas RESERVAN dinero, no lo mueven: el dinero total no cambia.
-- Misma seguridad que el resto: solo las ven los miembros de la cuenta.
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- =====================================================================

create table if not exists public.huchas (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null default public.mi_cuenta_personal() references public.cuentas(id) on delete cascade,
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  nombre text not null default 'Hucha',
  emoji text not null default '🐷',
  objetivo numeric(12,2) not null default 0 check (objetivo >= 0),
  fecha_objetivo date,
  aportacion_mensual numeric(12,2) check (aportacion_mensual is null or aportacion_mensual >= 0),
  cuenta text check (cuenta is null or cuenta in ('gastos', 'remunerada', 'inversiones')),
  orden integer not null default 0,
  conseguida_en date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists huchas_cuenta_idx on public.huchas(cuenta_id);

create table if not exists public.hucha_movimientos (
  id uuid primary key default gen_random_uuid(),
  hucha_id uuid not null references public.huchas(id) on delete cascade,
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  fecha date not null default current_date,
  importe numeric(12,2) not null check (importe <> 0), -- positivo: meter; negativo: sacar
  nota text,
  mes date check (mes is null or extract(day from mes) = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hucha_movimientos_hucha_idx on public.hucha_movimientos(hucha_id);
create index if not exists hucha_movimientos_cuenta_idx on public.hucha_movimientos(cuenta_id);
-- Una sola aportación mensual por hucha y mes
create unique index if not exists hucha_movimientos_mes_unico on public.hucha_movimientos(hucha_id, mes) where mes is not null;

-- Los movimientos heredan SIEMPRE la cuenta de su hucha (si no la ves, falla)
create or replace function public.tg_cuenta_desde_hucha() returns trigger
language plpgsql set search_path = public as $$
declare c uuid;
begin
  select h.cuenta_id into c from public.huchas h where h.id = new.hucha_id;
  if c is null then
    raise exception 'El movimiento no pertenece a ninguna hucha accesible.' using errcode = '23503';
  end if;
  new.cuenta_id := c;
  return new;
end $$;
revoke all on function public.tg_cuenta_desde_hucha() from public, anon;

drop trigger if exists a_cuenta on public.hucha_movimientos;
create trigger a_cuenta before insert or update on public.hucha_movimientos
  for each row execute function public.tg_cuenta_desde_hucha();

-- Seguridad
do $$
declare t text;
begin
  foreach t in array array['huchas', 'hucha_movimientos'] loop
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

-- Tiempo real
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['huchas', 'hucha_movimientos'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
