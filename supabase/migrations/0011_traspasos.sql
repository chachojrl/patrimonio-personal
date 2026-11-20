-- =====================================================================
-- 0011 · Traspasos entre cuentas.
--
-- La tabla «savings» (ahorro mensual) ya era un movimiento de una cuenta a otra:
--   origen → tipo (destino).
-- Hasta ahora solo se podía mover dinero en un sentido:
--   cuenta de gastos → inversiones / cuenta remunerada, y cuenta remunerada → inversiones.
-- Ahora vale cualquier combinación entre las tres cuentas:
--   origen: 'Ingresos mensuales' (= cuenta de gastos), 'Cuenta remunerada' o 'Inversiones'
--   tipo:   'Inversiones', 'Cuenta remunerada' o 'Cuenta de gastos'
-- Por ejemplo, de la cuenta remunerada a la cuenta de gastos, o vender inversiones.
-- Origen y destino no pueden ser la misma cuenta.
--
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- =====================================================================

-- Quitar las reglas antiguas sobre tipo/origen (sea cual sea su nombre) y poner una nueva
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.savings'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) ~ '\mtipo\M' or pg_get_constraintdef(oid) ~ '\morigen\M')
  loop
    execute format('alter table public.savings drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.savings add constraint savings_traspaso_valido check (
  tipo in ('Inversiones', 'Cuenta remunerada', 'Cuenta de gastos')
  and origen in ('Ingresos mensuales', 'Cuenta remunerada', 'Inversiones')
  and not (tipo = 'Cuenta remunerada' and origen = 'Cuenta remunerada')
  and not (tipo = 'Inversiones' and origen = 'Inversiones')
  and not (tipo = 'Cuenta de gastos' and origen = 'Ingresos mensuales')
);
