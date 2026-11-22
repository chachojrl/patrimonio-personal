-- Huchas (0014). Se ejecuta después de 08.
\set ON_ERROR_STOP 1
\set QUIET 1

\echo '--- Huchas'
set role authenticated; select pruebas.como('yo');
insert into huchas (id, nombre, emoji, objetivo, aportacion_mensual, cuenta)
  values ('c1000000-0000-0000-0000-000000000001', 'Japón', '🗾', 3000, 200, 'remunerada');
select pruebas.ok((select cuenta_id from huchas where id = 'c1000000-0000-0000-0000-000000000001') = mi_cuenta_personal(), 'la hucha va a mi cuenta personal');
insert into hucha_movimientos (hucha_id, importe, nota) values ('c1000000-0000-0000-0000-000000000001', 1500, 'Lo que ya tenía');
insert into hucha_movimientos (hucha_id, importe, mes) values ('c1000000-0000-0000-0000-000000000001', 200, '2026-11-01');
insert into hucha_movimientos (hucha_id, importe) values ('c1000000-0000-0000-0000-000000000001', -100);
select pruebas.ok((select sum(importe) from hucha_movimientos where hucha_id = 'c1000000-0000-0000-0000-000000000001') = 1600, 'se mete y se saca dinero');
select pruebas.ok((select bool_and(cuenta_id = mi_cuenta_personal()) from hucha_movimientos), 'los movimientos heredan la cuenta de la hucha');

do $$ begin
  insert into hucha_movimientos (hucha_id, importe, mes) values ('c1000000-0000-0000-0000-000000000001', 200, '2026-11-01');
  raise exception 'FALLO: aceptó dos aportaciones mensuales del mismo mes';
exception when unique_violation then raise notice 'OK  una sola aportación mensual por hucha y mes';
end $$;
do $$ begin
  insert into hucha_movimientos (hucha_id, importe) values ('c1000000-0000-0000-0000-000000000001', 0);
  raise exception 'FALLO: aceptó un movimiento de 0 €';
exception when check_violation then raise notice 'OK  no hay movimientos de 0 €';
end $$;
do $$ begin
  update huchas set cuenta = 'bitcoin' where id = 'c1000000-0000-0000-0000-000000000001';
  raise exception 'FALLO: aceptó una cuenta que no existe';
exception when check_violation then raise notice 'OK  la cuenta de la hucha es gastos, remunerada o inversiones';
end $$;

select pruebas.como('pareja');
select pruebas.ok((select count(*) from huchas) + (select count(*) from hucha_movimientos) = 0, 'Ana no ve mis huchas');
do $$ begin
  insert into hucha_movimientos (hucha_id, importe) values ('c1000000-0000-0000-0000-000000000001', 50);
  raise exception 'FALLO: Ana metió dinero en mi hucha';
exception when others then
  if sqlerrm like 'FALLO%' then raise; end if;
  raise notice 'OK  Ana no puede meter dinero en mi hucha (%)', sqlerrm;
end $$;

select pruebas.como('yo');
delete from huchas where id = 'c1000000-0000-0000-0000-000000000001';
reset role;
select pruebas.ok((select count(*) from hucha_movimientos where hucha_id = 'c1000000-0000-0000-0000-000000000001') = 0, 'borrar una hucha borra sus movimientos');
select pruebas.ok((select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('huchas', 'hucha_movimientos')) = 2, 'huchas en tiempo real');
\echo '=== 0014 OK'
