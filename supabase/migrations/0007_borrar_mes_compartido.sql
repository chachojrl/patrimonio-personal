-- =====================================================================
-- 0007 · Al borrar un mes de la cuenta compartida, desaparece también el
-- gasto automático «Aportación …» de ese mes en la cuenta personal de cada
-- miembro (si su mes personal está abierto; los cerrados no se tocan).
--
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- =====================================================================

create or replace function public.tg_aportaciones_meses() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
  tipo_cuenta text;
  c uuid;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select tipo into tipo_cuenta from cuentas where id = r.cuenta_id;
  if tipo_cuenta is null then return null; end if; -- se está borrando la cuenta entera

  if tipo_cuenta = 'compartida' then
    if tg_op = 'INSERT' then
      perform recalcular_aportaciones(r.cuenta_id, r.fecha);
    else
      -- Mes compartido borrado: fuera las aportaciones de ese mes en las cuentas personales
      delete from expenses e using months m
       where e.month_id = m.id
         and m.fecha = r.fecha
         and m.estado = 'Abierto'
         and e.aportacion_cuenta = r.cuenta_id;
    end if;
  else
    for c in select * from compartidas_de_personal(r.cuenta_id) loop
      perform recalcular_aportaciones(c, r.fecha);
    end loop;
  end if;
  return null;
end $$;

revoke all on function public.tg_aportaciones_meses() from public, anon, authenticated;

-- Limpieza: aportaciones que quedaron de meses compartidos borrados antes de esta versión
delete from public.expenses e using public.months m
 where e.month_id = m.id
   and m.estado = 'Abierto'
   and e.aportacion_cuenta is not null
   and not exists (
     select 1 from public.months sm where sm.cuenta_id = e.aportacion_cuenta and sm.fecha = m.fecha
   );
