-- =====================================================================
-- 0005 · Cuentas: cada usuario tiene su cuenta personal (privada) y, si lo
-- activa, una cuenta compartida que ven los dos miembros.
--
-- - Tus datos actuales pasan a tu cuenta personal: no cambia nada de lo que ves.
-- - Una cuenta compartida solo existe si alguien la crea desde Ajustes.
-- - Aportaciones automáticas (opcionales, apagadas por defecto): cada miembro
--   aporta el mismo porcentaje de sus ingresos del mes. Se apunta como ingreso
--   en la cuenta compartida y como gasto en su cuenta personal. Solo se tocan
--   meses abiertos; los cerrados se quedan como estaban.
--
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Requisitos de migraciones anteriores (por si no se ejecutaron):
-- 0003 (gasto fijo y presupuesto) y 0004 (tabla «Te deben»). Si ya están, no hace nada.
-- ---------------------------------------------------------------------
alter table public.expenses add column if not exists fijo boolean not null default false;
alter table public.expenses add column if not exists presupuesto numeric(12,2);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'expenses_presupuesto_no_negativo') then
    alter table public.expenses
      add constraint expenses_presupuesto_no_negativo check (presupuesto is null or presupuesto >= 0);
  end if;
end $$;

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
alter table public.debts enable row level security;
revoke all on public.debts from anon, public;
grant select, insert, update, delete on public.debts to authenticated;
drop trigger if exists updated_at on public.debts;
create trigger updated_at before update on public.debts
  for each row execute function public.tg_updated_at();

-- ---------------------------------------------------------------------
-- Antes de nada: el propietario de las tablas (quien ejecuta este script y
-- las funciones internas de aportaciones) tiene que poder ver todas las filas
-- para pasarlas a su cuenta. Los usuarios de la app siguen sujetos a RLS.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['config','months','incomes','expenses','expense_entries','savings','debts'] loop
    execute format('alter table public.%I no force row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Tablas nuevas
-- ---------------------------------------------------------------------
create table if not exists public.cuentas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null default 'Mi cuenta',
  tipo text not null default 'personal' check (tipo in ('personal', 'compartida')),
  aportacion_activa boolean not null default false,
  pct_aportacion numeric(5,2) check (pct_aportacion is null or (pct_aportacion >= 0 and pct_aportacion <= 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Miembros de cada cuenta. user_id vacío = invitación pendiente (se completa
-- cuando esa persona entra en la app con ese email).
create table if not exists public.cuenta_miembros (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  nombre text not null default '',
  created_at timestamptz not null default now(),
  unique (cuenta_id, email)
);
create unique index if not exists cuenta_miembros_usuario on public.cuenta_miembros(cuenta_id, user_id) where user_id is not null;
create index if not exists cuenta_miembros_user_idx on public.cuenta_miembros(user_id);

-- ---------------------------------------------------------------------
-- Funciones de permisos
-- ---------------------------------------------------------------------
-- ¿El usuario de la sesión está autorizado (app_owner, con 2FA si se exige)?
create or replace function public.usuario_autorizado() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_owner o
    where lower(o.email) = lower(auth.jwt() ->> 'email')
      and (not o.requiere_mfa or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2')
  );
$$;

-- ¿El usuario de la sesión es miembro de esa cuenta?
create or replace function public.es_miembro(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and exists (select 1 from public.cuenta_miembros m where m.cuenta_id = c and m.user_id = auth.uid())
     and public.usuario_autorizado();
$$;

create or replace function public.cuenta_personal_de(u uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select c.id from public.cuentas c
  join public.cuenta_miembros m on m.cuenta_id = c.id
  where c.tipo = 'personal' and m.user_id = u
  order by c.created_at, c.id
  limit 1;
$$;

-- Valor por defecto de cuenta_id: la cuenta personal de quien inserta.
create or replace function public.mi_cuenta_personal() returns uuid
language sql stable security definer set search_path = public as $$
  select public.cuenta_personal_de(auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Cuenta personal para cada usuario que ya tiene datos
-- ---------------------------------------------------------------------
do $$
declare
  u record;
  c uuid;
begin
  for u in
    select distinct x.user_id, au.email
    from (select user_id from public.config union select user_id from public.months union select user_id from public.debts) x
    join auth.users au on au.id = x.user_id
  loop
    if public.cuenta_personal_de(u.user_id) is null then
      insert into public.cuentas (nombre, tipo) values ('Mi cuenta', 'personal') returning id into c;
      insert into public.cuenta_miembros (cuenta_id, user_id, email, nombre)
      values (c, u.user_id, lower(coalesce(u.email, '')), split_part(coalesce(u.email, ''), '@', 1));
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- cuenta_id en todas las tablas de datos (y los datos actuales a la cuenta personal)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['config','months','incomes','expenses','expense_entries','savings','debts'] loop
    execute format('alter table public.%I add column if not exists cuenta_id uuid references public.cuentas(id) on delete cascade', t);
    -- Los triggers de "mes cerrado" impedirían rellenar filas de meses cerrados
    if t in ('incomes','expenses','expense_entries','savings') then
      execute format('alter table public.%I disable trigger hijos_mes', t);
    end if;
    execute format('update public.%I set cuenta_id = public.cuenta_personal_de(user_id) where cuenta_id is null', t);
    if t in ('incomes','expenses','expense_entries','savings') then
      execute format('alter table public.%I enable trigger hijos_mes', t);
    end if;
    execute format('alter table public.%I alter column cuenta_id set not null', t);
    execute format('create index if not exists %I on public.%I(cuenta_id)', t || '_cuenta_idx', t);
  end loop;
end $$;

-- config: una fila por cuenta (antes, una por usuario)
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.config'::regclass and conname = 'config_pkey' and pg_get_constraintdef(oid) like '%(user_id)%'
  ) then
    alter table public.config drop constraint config_pkey;
    alter table public.config add primary key (cuenta_id);
  end if;
end $$;

-- months: un mes por fecha y cuenta (antes, por usuario)
do $$
declare n text;
begin
  select conname into n from pg_constraint
  where conrelid = 'public.months'::regclass and contype = 'u' and pg_get_constraintdef(oid) = 'UNIQUE (user_id, fecha)';
  if n is not null then
    execute format('alter table public.months drop constraint %I', n);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.months'::regclass and conname = 'months_cuenta_fecha_key') then
    alter table public.months add constraint months_cuenta_fecha_key unique (cuenta_id, fecha);
  end if;
end $$;

-- Si una versión antigua de la app no envía cuenta_id, va a la cuenta personal
alter table public.config alter column cuenta_id set default public.mi_cuenta_personal();
alter table public.months alter column cuenta_id set default public.mi_cuenta_personal();
alter table public.debts alter column cuenta_id set default public.mi_cuenta_personal();

-- Las filas que cuelgan de un mes heredan SIEMPRE la cuenta de su mes.
-- (Se ejecuta con los permisos de quien inserta: si no ve el mes, falla.)
create or replace function public.tg_cuenta_desde_padre() returns trigger
language plpgsql set search_path = public as $$
declare c uuid;
begin
  if tg_table_name = 'expense_entries' then
    select e.cuenta_id into c from public.expenses e where e.id = new.expense_id;
  else
    select m.cuenta_id into c from public.months m where m.id = new.month_id;
  end if;
  if c is null then
    raise exception 'La fila no pertenece a ningún mes accesible.' using errcode = '23503';
  end if;
  new.cuenta_id := c;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['incomes','expenses','expense_entries','savings'] loop
    execute format('alter table public.%I alter column cuenta_id drop default', t);
    execute format('drop trigger if exists a_cuenta on public.%I', t);
    execute format('create trigger a_cuenta before insert or update on public.%I for each row execute function public.tg_cuenta_desde_padre()', t);
  end loop;
end $$;

-- Reglas de meses: además, un mes no puede cambiar de cuenta
create or replace function public.tg_months() returns trigger
language plpgsql as $$
begin
  if new.cuenta_id is distinct from old.cuenta_id then
    raise exception 'Un mes no puede cambiar de cuenta.' using errcode = 'P0001';
  end if;
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

-- ---------------------------------------------------------------------
-- Seguridad: cada fila la ven y modifican solo los miembros de su cuenta.
-- NO FORCE: las funciones internas (aportaciones), que son del propietario de
-- las tablas, tienen que poder escribir en la cuenta de ambos miembros. Los
-- usuarios de la app (rol authenticated) siguen sujetos a estas reglas.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['config','months','incomes','expenses','expense_entries','savings','debts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I no force row level security', t);
    execute format('drop policy if exists propietario on public.%I', t);
    execute format('drop policy if exists miembro on public.%I', t);
    execute format(
      'create policy miembro on public.%I for all to authenticated using (public.es_miembro(cuenta_id)) with check (public.es_miembro(cuenta_id))', t);
    execute format('revoke all on public.%I from anon, public', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

alter table public.cuentas enable row level security;
alter table public.cuenta_miembros enable row level security;
revoke all on public.cuentas, public.cuenta_miembros from anon, authenticated, public;

drop policy if exists ver on public.cuentas;
create policy ver on public.cuentas for select to authenticated using (public.es_miembro(id));
drop policy if exists editar on public.cuentas;
create policy editar on public.cuentas for update to authenticated
  using (public.es_miembro(id) and tipo = 'compartida') with check (public.es_miembro(id) and tipo = 'compartida');
grant select on public.cuentas to authenticated;
grant update (nombre, aportacion_activa, pct_aportacion) on public.cuentas to authenticated;

drop policy if exists ver on public.cuenta_miembros;
create policy ver on public.cuenta_miembros for select to authenticated using (public.es_miembro(cuenta_id));
drop policy if exists editar on public.cuenta_miembros;
create policy editar on public.cuenta_miembros for update to authenticated
  using (public.es_miembro(cuenta_id)) with check (public.es_miembro(cuenta_id));
grant select on public.cuenta_miembros to authenticated;
grant update (nombre) on public.cuenta_miembros to authenticated;

drop trigger if exists updated_at on public.cuentas;
create trigger updated_at before update on public.cuentas for each row execute function public.tg_updated_at();

-- ---------------------------------------------------------------------
-- Crear mes nuevo dentro de una cuenta concreta
-- ---------------------------------------------------------------------
create or replace function public.insertar_mes(
  p_cuenta uuid, p_mes jsonb, p_incomes jsonb, p_expenses jsonb, p_cerrar uuid
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
  if not public.es_miembro(p_cuenta) then
    raise exception 'No tienes acceso a esta cuenta.' using errcode = '42501';
  end if;
  select max(fecha) into ultima from months where cuenta_id = p_cuenta;
  if ultima is null then
    select mes_inicio into inicio from config where cuenta_id = p_cuenta;
    if inicio is not null and f <> inicio then
      raise exception 'El primer mes debe ser %.', to_char(inicio, 'MM/YYYY');
    end if;
  elsif f <> (ultima + interval '1 month')::date then
    raise exception 'Solo se puede crear el mes siguiente al último.';
  end if;

  insert into months (id, cuenta_id, fecha, titulo, estado)
  values (mid, p_cuenta, f, coalesce(p_mes ->> 'titulo', 'Presupuesto personal'), 'Abierto');

  insert into incomes (id, month_id, concepto, importe, orden)
  select (x ->> 'id')::uuid, mid, x ->> 'concepto', 0, (x ->> 'orden')::int
  from jsonb_array_elements(p_incomes) x;

  insert into expenses (id, month_id, concepto, fecha_vencimiento, importe, orden, fijo, presupuesto)
  select (x ->> 'id')::uuid, mid, x ->> 'concepto',
         nullif(x ->> 'fecha_vencimiento', '')::date,
         coalesce(nullif(x ->> 'importe', '')::numeric, 0),
         (x ->> 'orden')::int,
         coalesce((x ->> 'fijo')::boolean, false),
         nullif(x ->> 'presupuesto', '')::numeric
  from jsonb_array_elements(p_expenses) x;

  update months set ultimo_cambio = null where id = mid;

  if p_cerrar is not null then
    update months set estado = 'Cerrado' where id = p_cerrar and cuenta_id = p_cuenta;
  end if;
end $$;

-- La versión anterior (sin cuenta) sigue funcionando: usa la cuenta personal
create or replace function public.insertar_mes(
  p_mes jsonb, p_incomes jsonb, p_expenses jsonb, p_cerrar uuid
) returns void
language sql
security invoker
set search_path = public
as $$
  select public.insertar_mes(public.mi_cuenta_personal(), p_mes, p_incomes, p_expenses, p_cerrar);
$$;

-- ---------------------------------------------------------------------
-- Aportaciones automáticas a la cuenta compartida
-- ---------------------------------------------------------------------
alter table public.incomes add column if not exists aportacion_de uuid references auth.users(id) on delete set null;
alter table public.expenses add column if not exists aportacion_cuenta uuid references public.cuentas(id) on delete set null;
create unique index if not exists incomes_aportacion_unica on public.incomes(month_id, aportacion_de) where aportacion_de is not null;
create unique index if not exists expenses_aportacion_unica on public.expenses(month_id, aportacion_cuenta) where aportacion_cuenta is not null;

-- Recalcula las aportaciones de una cuenta compartida (de un mes o de todos).
-- Aportación = ingresos del mes de ese miembro en su cuenta personal × porcentaje.
create or replace function public.recalcular_aportaciones(p_cuenta uuid, p_fecha date default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  cta record;
  m record;
  mb record;
  pm record;
  personal uuid;
  ingresos numeric;
  v_importe numeric;
  concepto_ing text;
  fila uuid;
begin
  select * into cta from cuentas where id = p_cuenta and tipo = 'compartida';
  if not found then return; end if;

  for m in select * from months where cuenta_id = p_cuenta and estado = 'Abierto' and (p_fecha is null or fecha = p_fecha) loop
    for mb in select * from cuenta_miembros where cuenta_id = p_cuenta and user_id is not null loop
      personal := cuenta_personal_de(mb.user_id);
      select * into pm from months where cuenta_id = personal and fecha = m.fecha;
      -- Mes personal cerrado: su aportación se queda como estaba (en los dos lados)
      if pm.id is not null and pm.estado <> 'Abierto' then continue; end if;

      if not cta.aportacion_activa or cta.pct_aportacion is null or pm.id is null then
        -- Desactivadas o sin mes personal: se quitan las filas automáticas (solo en meses abiertos)
        delete from incomes where month_id = m.id and aportacion_de = mb.user_id;
        if pm.id is not null then
          delete from expenses where month_id = pm.id and aportacion_cuenta = p_cuenta;
        end if;
        continue;
      end if;

      select coalesce(sum(i.importe), 0) into ingresos from incomes i where i.month_id = pm.id;
      v_importe := round(ingresos * cta.pct_aportacion / 100, 2);
      concepto_ing := 'Aportación ' || coalesce(nullif(trim(mb.nombre), ''), split_part(mb.email, '@', 1));

      -- Ingreso en la cuenta compartida
      select id into fila from incomes where month_id = m.id and aportacion_de = mb.user_id;
      if fila is null then
        insert into incomes (month_id, cuenta_id, user_id, concepto, importe, orden, aportacion_de)
        values (m.id, p_cuenta, mb.user_id, concepto_ing, v_importe,
                (select coalesce(max(orden), -1) + 1 from incomes where month_id = m.id), mb.user_id);
      else
        update incomes i set importe = v_importe, concepto = concepto_ing
        where i.id = fila and (i.importe is distinct from v_importe or i.concepto is distinct from concepto_ing);
      end if;

      -- Gasto en su cuenta personal
      fila := null;
      select id into fila from expenses where month_id = pm.id and aportacion_cuenta = p_cuenta;
      if fila is null then
        insert into expenses (month_id, cuenta_id, user_id, concepto, importe, orden, aportacion_cuenta)
        values (pm.id, personal, mb.user_id, 'Aportación ' || cta.nombre, v_importe,
                (select coalesce(max(orden), -1) + 1 from expenses where month_id = pm.id), p_cuenta);
      else
        update expenses e set importe = v_importe
        where e.id = fila and e.importe is distinct from v_importe;
      end if;
      fila := null;
    end loop;
  end loop;
end $$;

-- Cuentas compartidas de las que es miembro el dueño de una cuenta personal
create or replace function public.compartidas_de_personal(p_personal uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct m2.cuenta_id
  from cuenta_miembros m1
  join cuenta_miembros m2 on m2.user_id = m1.user_id
  join cuentas c on c.id = m2.cuenta_id and c.tipo = 'compartida'
  where m1.cuenta_id = p_personal and m1.user_id is not null;
$$;

-- Cambian los ingresos de un mes personal → se recalcula su aportación
create or replace function public.tg_aportaciones_ingresos() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  mid uuid := case when tg_op = 'DELETE' then old.month_id else new.month_id end;
  mes record;
  c uuid;
begin
  if pg_trigger_depth() > 1 then return null; end if; -- escrituras hechas por el propio recálculo
  select m.fecha, m.cuenta_id, cu.tipo into mes from months m join cuentas cu on cu.id = m.cuenta_id where m.id = mid;
  if not found or mes.tipo <> 'personal' then return null; end if;
  for c in select * from compartidas_de_personal(mes.cuenta_id) loop
    perform recalcular_aportaciones(c, mes.fecha);
  end loop;
  return null;
end $$;

drop trigger if exists aportaciones on public.incomes;
create trigger aportaciones after insert or update of importe, month_id or delete on public.incomes
  for each row execute function public.tg_aportaciones_ingresos();

-- Se crea o borra un mes → se recalcula ese mes
create or replace function public.tg_aportaciones_meses() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
  tipo_cuenta text;
  c uuid;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select tipo into tipo_cuenta from cuentas where id = r.cuenta_id;
  if tipo_cuenta is null then return null; end if;
  if tipo_cuenta = 'compartida' then
    if tg_op = 'INSERT' then perform recalcular_aportaciones(r.cuenta_id, r.fecha); end if;
  else
    for c in select * from compartidas_de_personal(r.cuenta_id) loop
      perform recalcular_aportaciones(c, r.fecha);
    end loop;
  end if;
  return null;
end $$;

drop trigger if exists aportaciones on public.months;
create trigger aportaciones after insert or delete on public.months
  for each row execute function public.tg_aportaciones_meses();

-- Cambia el porcentaje, se activa/desactiva o cambia el nombre → se recalculan los meses abiertos
create or replace function public.tg_aportaciones_cuenta() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recalcular_aportaciones(new.id, null);
  return null;
end $$;

drop trigger if exists aportaciones on public.cuentas;
create trigger aportaciones after update of aportacion_activa, pct_aportacion, nombre on public.cuentas
  for each row execute function public.tg_aportaciones_cuenta();

-- Alguien acepta la invitación o cambia de nombre → se recalcula
create or replace function public.tg_aportaciones_miembros() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recalcular_aportaciones(new.cuenta_id, null);
  return null;
end $$;

drop trigger if exists aportaciones on public.cuenta_miembros;
create trigger aportaciones after insert or update of user_id, nombre on public.cuenta_miembros
  for each row execute function public.tg_aportaciones_miembros();

-- ---------------------------------------------------------------------
-- Funciones que llama la app
-- ---------------------------------------------------------------------
-- Al entrar: crea la cuenta personal si falta, acepta invitaciones y
-- devuelve las cuentas del usuario (la personal primero).
create or replace function public.mis_cuentas() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  yo uuid := auth.uid();
  mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
  c uuid;
begin
  if yo is null or not usuario_autorizado() then
    raise exception 'Tu usuario no está autorizado para usar esta aplicación.' using errcode = '42501';
  end if;
  if cuenta_personal_de(yo) is null then
    insert into cuentas (nombre, tipo) values ('Mi cuenta', 'personal') returning id into c;
    insert into cuenta_miembros (cuenta_id, user_id, email, nombre) values (c, yo, mail, split_part(mail, '@', 1));
  end if;
  update cuenta_miembros set user_id = yo where user_id is null and lower(email) = mail;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', cu.id, 'nombre', cu.nombre, 'tipo', cu.tipo,
      'aportacion_activa', cu.aportacion_activa, 'pct_aportacion', cu.pct_aportacion,
      'miembros', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', mm.id, 'user_id', mm.user_id, 'email', mm.email, 'nombre', mm.nombre
        ) order by mm.created_at), '[]'::jsonb)
        from cuenta_miembros mm where mm.cuenta_id = cu.id
      )
    ) order by cu.tipo desc, cu.created_at)
    from cuentas cu
    where exists (select 1 from cuenta_miembros m where m.cuenta_id = cu.id and m.user_id = yo)
  ), '[]'::jsonb);
end $$;

-- Crea una cuenta compartida contigo y con la persona invitada (por email).
create or replace function public.crear_cuenta_compartida(
  p_nombre text, p_mi_nombre text, p_email_pareja text, p_nombre_pareja text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  yo uuid := auth.uid();
  mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
  pareja text := lower(trim(coalesce(p_email_pareja, '')));
  c uuid;
begin
  if yo is null or not usuario_autorizado() then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;
  if pareja !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El email de la otra persona no es válido.';
  end if;
  if pareja = mail then
    raise exception 'El email de la otra persona tiene que ser distinto del tuyo.';
  end if;

  insert into cuentas (nombre, tipo) values (coalesce(nullif(trim(p_nombre), ''), 'Cuenta compartida'), 'compartida') returning id into c;
  insert into cuenta_miembros (cuenta_id, user_id, email, nombre) values
    (c, yo, mail, coalesce(nullif(trim(p_mi_nombre), ''), split_part(mail, '@', 1))),
    (c, null, pareja, coalesce(nullif(trim(p_nombre_pareja), ''), split_part(pareja, '@', 1)));
  insert into config (cuenta_id, user_id, mes_inicio, ajuste_cuenta_gastos_inicial, inversiones_iniciales,
                      aportado_inicial_inversiones, cuenta_remunerada_inicial, plantilla_ingresos, plantilla_gastos)
  values (c, yo, date_trunc('month', current_date)::date, 0, 0, 0, 0, array[]::text[],
          array['Alquiler/hipoteca','Comunidad','Electricidad','Agua','Gas','Teléfono móvil/WiFi','Supermercado','Seguro del hogar','Casa (otros)','Otros']);
  return c;
end $$;

-- ---------------------------------------------------------------------
-- Quién puede llamar a qué
-- ---------------------------------------------------------------------
revoke all on function public.recalcular_aportaciones(uuid, date) from public, anon, authenticated;
revoke all on function public.compartidas_de_personal(uuid) from public, anon, authenticated;
revoke all on function public.cuenta_personal_de(uuid) from public, anon, authenticated;
revoke all on function public.tg_aportaciones_ingresos() from public, anon, authenticated;
revoke all on function public.tg_aportaciones_meses() from public, anon, authenticated;
revoke all on function public.tg_aportaciones_cuenta() from public, anon, authenticated;
revoke all on function public.tg_aportaciones_miembros() from public, anon, authenticated;
revoke all on function public.usuario_autorizado() from public, anon;
revoke all on function public.es_miembro(uuid) from public, anon;
revoke all on function public.mi_cuenta_personal() from public, anon;
revoke all on function public.mis_cuentas() from public, anon;
revoke all on function public.crear_cuenta_compartida(text, text, text, text) from public, anon;
revoke all on function public.insertar_mes(uuid, jsonb, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.usuario_autorizado() to authenticated;
grant execute on function public.es_miembro(uuid) to authenticated;
grant execute on function public.mi_cuenta_personal() to authenticated;
grant execute on function public.mis_cuentas() to authenticated;
grant execute on function public.crear_cuenta_compartida(text, text, text, text) to authenticated;
grant execute on function public.insertar_mes(uuid, jsonb, jsonb, jsonb, uuid) to authenticated;
