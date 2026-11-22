-- =====================================================================
-- 0010 · Necesidades / caprichos y reparto por concepto.
--
-- - config.clasificacion: para cada concepto de gasto, si es «necesidad» o
--   «capricho» (regla 50/30/20). Es un objeto {"alquiler/hipoteca": "necesidad", …}.
-- - expenses.reparto (cuenta compartida): cómo se reparte un gasto.
--     null      → proporcional (lo cubren las aportaciones; como hasta ahora)
--     'mitad'   → a medias entre los miembros
--     'u:<id>'  → lo paga entero ese miembro
--   «Crear mes nuevo» lo copia al mes siguiente, como el gasto fijo o el presupuesto.
--
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- =====================================================================

alter table public.config add column if not exists clasificacion jsonb not null default '{}'::jsonb;

alter table public.expenses add column if not exists reparto text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'expenses_reparto_valido') then
    alter table public.expenses add constraint expenses_reparto_valido
      check (reparto is null or reparto = 'mitad' or reparto ~ '^u:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
  end if;
end $$;

-- Crear mes nuevo: copia también el reparto
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

  insert into expenses (id, month_id, concepto, fecha_vencimiento, importe, orden, fijo, presupuesto, reparto)
  select (x ->> 'id')::uuid, mid, x ->> 'concepto',
         nullif(x ->> 'fecha_vencimiento', '')::date,
         coalesce(nullif(x ->> 'importe', '')::numeric, 0),
         (x ->> 'orden')::int,
         coalesce((x ->> 'fijo')::boolean, false),
         nullif(x ->> 'presupuesto', '')::numeric,
         nullif(x ->> 'reparto', '')
  from jsonb_array_elements(p_expenses) x;

  update months set ultimo_cambio = null where id = mid;

  if p_cerrar is not null then
    update months set estado = 'Cerrado' where id = p_cerrar and cuenta_id = p_cuenta;
  end if;
end $$;

-- Historial: apunta también los cambios de reparto
create or replace function public.tg_registrar_cambio() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  o jsonb;
  campos text[] := array['concepto', 'importe', 'fecha_vencimiento', 'fijo', 'presupuesto', 'titulo', 'estado',
                         'saldo_real_cuenta', 'valor_real_inversiones', 'tipo', 'origen', 'fecha', 'persona',
                         'devuelto_en', 'nota', 'reparto'];
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

  -- Se guarda 3 meses (ver 0012)
  delete from cambios where cuenta_id = cuenta and creado_en < now() - interval '3 months';
  return null;
end $$;
