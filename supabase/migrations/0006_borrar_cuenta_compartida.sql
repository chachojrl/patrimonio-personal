-- =====================================================================
-- 0006 · Borrar una cuenta compartida (con confirmación).
--
-- - Solo un miembro puede borrarla, y solo si es compartida (nunca una personal).
-- - Hay que enviar el nombre exacto de la cuenta como confirmación (no distingue
--   mayúsculas): así no se puede borrar por error ni con una llamada equivocada.
-- - Se borra todo lo de la cuenta (meses, gastos, ingresos, ahorros, deudas…).
-- - En las cuentas personales de los miembros:
--     · meses abiertos: desaparece el gasto automático «Aportación …»;
--     · meses cerrados: se queda como gasto normal (el pasado no cambia).
--
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- =====================================================================

-- Regla de "mes cerrado = solo lectura", con una excepción: quitar la marca de
-- aportación (aportacion_cuenta) a un gasto, sin cambiar nada más, al borrar la cuenta.
create or replace function public.tg_hijos_mes() returns trigger
language plpgsql
set search_path = public
as $$
declare
  mid uuid;
  est text;
begin
  -- (IF anidados: las otras tablas no tienen la columna aportacion_cuenta)
  if tg_op = 'UPDATE' and tg_table_name = 'expenses' then
    if old.aportacion_cuenta is not null and new.aportacion_cuenta is null
       and (to_jsonb(new) - 'aportacion_cuenta' - 'updated_at') = (to_jsonb(old) - 'aportacion_cuenta' - 'updated_at') then
      return new;
    end if;
  end if;

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

create or replace function public.borrar_cuenta_compartida(p_cuenta uuid, p_confirmacion text) returns void
language plpgsql security definer set search_path = public as $$
declare
  cta record;
begin
  if p_cuenta is null or not es_miembro(p_cuenta) then
    raise exception 'No tienes acceso a esta cuenta.' using errcode = '42501';
  end if;
  select * into cta from cuentas where id = p_cuenta;
  if cta.tipo <> 'compartida' then
    raise exception 'Solo se puede borrar una cuenta compartida.';
  end if;
  if lower(trim(coalesce(p_confirmacion, ''))) <> lower(trim(cta.nombre)) then
    raise exception 'El nombre escrito no coincide con el de la cuenta: no se ha borrado nada.';
  end if;

  -- Aportaciones en las cuentas personales: fuera en meses abiertos, gasto normal en cerrados
  delete from expenses e using months m
   where e.month_id = m.id and m.estado = 'Abierto' and e.aportacion_cuenta = p_cuenta;
  update expenses set aportacion_cuenta = null where aportacion_cuenta = p_cuenta;

  -- Los meses cerrados de la cuenta no admiten borrar su contenido: se reabren antes
  update months set estado = 'Abierto' where cuenta_id = p_cuenta and estado = 'Cerrado';

  -- En cascada: miembros, configuración, meses, ingresos, gastos, apuntes, ahorros y deudas
  delete from cuentas where id = p_cuenta;
end $$;

revoke all on function public.borrar_cuenta_compartida(uuid, text) from public, anon;
grant execute on function public.borrar_cuenta_compartida(uuid, text) to authenticated;
