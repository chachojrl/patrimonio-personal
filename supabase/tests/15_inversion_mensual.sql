-- Futuro: lo que inviertes al mes (0020). Se ejecuta después de 14.
\set ON_ERROR_STOP 1
\set QUIET 1

\echo '--- Futuro: lo que inviertes al mes'
set role authenticated; select pruebas.como('yo');
select pruebas.ok((select inversion_mensual is null from config where cuenta_id = mi_cuenta_personal()), 'al principio se usa la media (vacío)');
update config set inversion_mensual = 1200 where cuenta_id = mi_cuenta_personal();
select pruebas.ok((select inversion_mensual = 1200 from config where cuenta_id = mi_cuenta_personal()), 'se guarda lo que inviertes al mes');
do $$ begin
  update config set inversion_mensual = -5 where cuenta_id = mi_cuenta_personal();
  raise exception 'FALLO: aceptó invertir una cantidad negativa';
exception when check_violation then raise notice 'OK  lo que inviertes al mes no puede ser negativo';
end $$;
reset role;
\echo '=== 0020 OK'
