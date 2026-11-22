-- Suscripciones (0016). Se ejecuta después de 10.
\set ON_ERROR_STOP 1
\set QUIET 1

\echo '--- Suscripciones'
set role authenticated; select pruebas.como('yo');
select pruebas.ok((select no_suscripciones = '[]'::jsonb from config where cuenta_id = mi_cuenta_personal()), 'al principio no hay nada marcado como «no es una suscripción»');
update config set no_suscripciones = '["telefono movil/wifi"]' where cuenta_id = mi_cuenta_personal();
select pruebas.ok((select no_suscripciones ? 'telefono movil/wifi' from config where cuenta_id = mi_cuenta_personal()), 'se guarda «no es una suscripción»');
do $$ begin
  update config set no_suscripciones = '{}' where cuenta_id = mi_cuenta_personal();
  raise exception 'FALLO: aceptó algo que no es una lista';
exception when check_violation then raise notice 'OK  «no es una suscripción» es una lista';
end $$;
reset role;
\echo '=== 0016 OK'
