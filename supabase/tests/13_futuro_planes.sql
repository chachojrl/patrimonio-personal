-- Futuro: planes (0018). Se ejecuta después de 10.
\set ON_ERROR_STOP 1
\set QUIET 1

\echo '--- Futuro: planes'
set role authenticated; select pruebas.como('yo');
select pruebas.ok((select crecimiento_ahorro = 2 and comision_inversiones = 0.2 and impuestos_futuro and volatilidad = 15
  and anio_nacimiento is null and eventos_futuro = '[]'::jsonb from config where cuenta_id = mi_cuenta_personal()),
  'valores por defecto: el ahorro sube un 2 %, 0,2 % de comisiones, con impuestos, 15 % de altibajos y sin edad ni planes');
update config set anio_nacimiento = 1990, volatilidad = 10,
  eventos_futuro = '[{"id":"e1","nombre":"Fin hipoteca","tipo":"gasto_fin","importe":65000,"desde":"2031-06-01","hasta":null}]'
  where cuenta_id = mi_cuenta_personal();
select pruebas.ok((select anio_nacimiento = 1990 and eventos_futuro->0->>'tipo' = 'gasto_fin' from config where cuenta_id = mi_cuenta_personal()), 'se guardan la edad y los planes');
do $$ begin
  update config set anio_nacimiento = 1800 where cuenta_id = mi_cuenta_personal();
  raise exception 'FALLO: aceptó nacer en 1800';
exception when check_violation then raise notice 'OK  el año de nacimiento tiene que ser razonable';
end $$;
do $$ begin
  update config set eventos_futuro = '{}' where cuenta_id = mi_cuenta_personal();
  raise exception 'FALLO: aceptó unos planes que no son una lista';
exception when check_violation then raise notice 'OK  los planes son una lista';
end $$;
do $$ begin
  update config set comision_inversiones = -1 where cuenta_id = mi_cuenta_personal();
  raise exception 'FALLO: aceptó comisiones negativas';
exception when check_violation then raise notice 'OK  las comisiones no pueden ser negativas';
end $$;
reset role;
\echo '=== 0018 OK'
