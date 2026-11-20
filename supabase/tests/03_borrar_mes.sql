-- Borrar un mes de la cuenta compartida (0007). Se ejecuta después de 01, con 0007 SIN aplicar:
-- comprueba el comportamiento anterior, aplica 0007 (con su limpieza) y el nuevo.
\set ON_ERROR_STOP 1
\set QUIET 1
\echo '--- Preparación: diciembre en las dos cuentas personales y en la compartida'
set role authenticated; select pruebas.como('pareja');
select insertar_mes(mi_cuenta_personal(), '{"id":"cccccccc-0000-0000-0000-000000000021","fecha":"2026-11-01"}', '[]', '[]', null);
select insertar_mes(mi_cuenta_personal(), '{"id":"cccccccc-0000-0000-0000-000000000022","fecha":"2026-12-01"}', '[{"id":"cccccccc-1111-0000-0000-000000000022","concepto":"Nomina","orden":0}]', '[]', null);
update incomes set importe = 1000 where id = 'cccccccc-1111-0000-0000-000000000022';
select pruebas.como('yo');
insert into incomes (month_id, concepto, importe, orden) values ('eeeeeeee-0000-0000-0000-000000000002', 'Nomina', 2000, 0);
select id as compartida from cuentas where tipo = 'compartida' \gset
select insertar_mes(:'compartida', '{"id":"dddddddd-0000-0000-0000-000000000012","fecha":"2026-12-01"}', '[]', '[]', null);
reset role;
select pruebas.ok(pruebas.ap('11111111-1111-1111-1111-111111111111', '2026-12-01') = 100, 'diciembre: mi aportación 5 % de 2.000 = 100');
select pruebas.ok(pruebas.ap('22222222-2222-2222-2222-222222222222', '2026-12-01') = 50, 'diciembre: la de Ana 5 % de 1.000 = 50');

\echo '--- Versión anterior: borrar el mes compartido deja aportaciones colgadas'
set role authenticated; select pruebas.como('yo');
delete from months where id = 'dddddddd-0000-0000-0000-000000000012';
reset role;
select pruebas.ok(pruebas.ap('11111111-1111-1111-1111-111111111111', '2026-12-01') = 100, '(antes de 0007) mi aportación se quedaba');
\echo '--- Se ejecuta la 0007 (incluye limpieza)'
\i supabase/migrations/0007_borrar_mes_compartido.sql
select pruebas.ok(pruebas.ap('11111111-1111-1111-1111-111111111111', '2026-12-01') is null and pruebas.ap('22222222-2222-2222-2222-222222222222', '2026-12-01') is null, 'la 0007 limpia las aportaciones colgadas de los dos');
select pruebas.ok(pruebas.ap('11111111-1111-1111-1111-111111111111', '2026-11-01') = 631.11, 'la de un mes cerrado (noviembre) no se toca');
select pruebas.ok((select count(*) from incomes where month_id = 'eeeeeeee-0000-0000-0000-000000000002') = 1, 'mis ingresos de diciembre siguen ahí');

\echo '--- Ahora: borrar el mes compartido quita las aportaciones'
set role authenticated; select pruebas.como('yo');
select insertar_mes(:'compartida', '{"id":"dddddddd-0000-0000-0000-000000000013","fecha":"2026-12-01"}', '[]', '[]', null);
reset role;
select pruebas.ok(pruebas.ap('11111111-1111-1111-1111-111111111111', '2026-12-01') = 100 and pruebas.ap('22222222-2222-2222-2222-222222222222', '2026-12-01') = 50, 'al volver a crear diciembre vuelven las aportaciones');
set role authenticated; select pruebas.como('pareja');
delete from months where id = 'dddddddd-0000-0000-0000-000000000013';
reset role;
select pruebas.ok(pruebas.ap('11111111-1111-1111-1111-111111111111', '2026-12-01') is null, 'Ana borra el mes compartido: desaparece mi aportación');
select pruebas.ok(pruebas.ap('22222222-2222-2222-2222-222222222222', '2026-12-01') is null, 'y la suya');
select pruebas.ok((select count(*) from expenses e join months m on m.id = e.month_id where m.cuenta_id = pruebas.personal('11111111-1111-1111-1111-111111111111') and m.fecha = '2026-12-01') = 0, 'en mi diciembre no queda ningún gasto de aportación');

\echo '--- Con mi mes personal cerrado, mi aportación se queda'
set role authenticated; select pruebas.como('yo');
select insertar_mes(:'compartida', '{"id":"dddddddd-0000-0000-0000-000000000014","fecha":"2026-12-01"}', '[]', '[]', null);
update months set estado = 'Cerrado' where id = 'eeeeeeee-0000-0000-0000-000000000002';
delete from months where id = 'dddddddd-0000-0000-0000-000000000014';
reset role;
select pruebas.ok(pruebas.ap('11111111-1111-1111-1111-111111111111', '2026-12-01') = 100, 'mi diciembre está cerrado: la aportación se queda (el pasado no cambia)');
select pruebas.ok(pruebas.ap('22222222-2222-2222-2222-222222222222', '2026-12-01') is null, 'el de Ana estaba abierto: la suya desaparece');

\echo '--- Borrar toda la cuenta sigue funcionando'
set role authenticated; select pruebas.como('yo');
select borrar_cuenta_compartida(:'compartida', 'Casa');
reset role;
select pruebas.ok((select count(*) from cuentas where tipo = 'compartida') = 0, 'la cuenta compartida se borra bien con la 0007');
\echo '=== BORRAR MES OK'
