-- Cuándo paga el banco los intereses (0017). Se ejecuta después de 11.
\set ON_ERROR_STOP 1
\set QUIET 1

\echo '--- Pago de intereses'
set role authenticated; select pruebas.como('yo');
select pruebas.ok((select pago_intereses = 'mes-siguiente' from config where cuenta_id = mi_cuenta_personal()), 'por defecto, el banco paga el día 1 del mes siguiente');
update config set pago_intereses = 'mismo-mes' where cuenta_id = mi_cuenta_personal();
select pruebas.ok((select pago_intereses = 'mismo-mes' from config where cuenta_id = mi_cuenta_personal()), 'se puede elegir a final del mismo mes');
do $$ begin
  update config set pago_intereses = 'cada-año' where cuenta_id = mi_cuenta_personal();
  raise exception 'FALLO: aceptó un tipo de pago que no existe';
exception when check_violation then raise notice 'OK  solo «mes-siguiente» o «mismo-mes»';
end $$;
reset role;
\echo '=== 0017 OK'
