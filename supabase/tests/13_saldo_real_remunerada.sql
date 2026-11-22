-- Saldo real de la cuenta remunerada (0018). Se ejecuta después de 12.
\set ON_ERROR_STOP 1
\set QUIET 1

\echo '--- Saldo real de la cuenta remunerada'
set role authenticated; select pruebas.como('yo');
update months set estado = 'Cerrado' where id = 'b1000000-0000-0000-0000-000000000001';
update months set saldo_real_remunerada = 12488.75 where id = 'b1000000-0000-0000-0000-000000000001';
select pruebas.ok((select saldo_real_remunerada from months where id = 'b1000000-0000-0000-0000-000000000001') = 12488.75,
  'el saldo real de la cuenta remunerada se guarda aunque el mes esté cerrado');
update months set estado = 'Abierto' where id = 'b1000000-0000-0000-0000-000000000001';
select pruebas.como('pareja');
update months set saldo_real_remunerada = 1 where id = 'b1000000-0000-0000-0000-000000000001';
reset role;
select pruebas.ok((select saldo_real_remunerada from months where id = 'b1000000-0000-0000-0000-000000000001') = 12488.75, 'Ana no puede cambiar mi saldo real');
\echo '=== 0018 OK'
