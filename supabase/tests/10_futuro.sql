-- Futuro (0015). Se ejecuta después de 09.
\set ON_ERROR_STOP 1
\set QUIET 1

\echo '--- Futuro'
set role authenticated; select pruebas.como('yo');
select pruebas.ok((select rentabilidad_inversiones = 5 and inflacion = 2 and pct_retirada = 4 and fire_excluidos = '[]'::jsonb
  from config where cuenta_id = mi_cuenta_personal()), 'valores por defecto: 5 % de rentabilidad, 2 % de inflación y 4 % de retirada');
update config set rentabilidad_inversiones = 6.5, pct_retirada = 3.5, fire_excluidos = '["alquiler/hipoteca"]' where cuenta_id = mi_cuenta_personal();
select pruebas.ok((select fire_excluidos ? 'alquiler/hipoteca' from config where cuenta_id = mi_cuenta_personal()), 'se guardan los ajustes del futuro');
do $$ begin
  update config set pct_retirada = 0 where cuenta_id = mi_cuenta_personal();
  raise exception 'FALLO: aceptó sacar un 0 %% al año';
exception when check_violation then raise notice 'OK  el %% de retirada tiene que ser mayor que 0';
end $$;
do $$ begin
  update config set fire_excluidos = '"hipoteca"' where cuenta_id = mi_cuenta_personal();
  raise exception 'FALLO: aceptó una lista de gastos que no es una lista';
exception when check_violation then raise notice 'OK  los gastos excluidos son una lista';
end $$;
reset role;
\echo '=== 0015 OK'
