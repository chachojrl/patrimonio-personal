-- Cuenta personal y compartida: privacidad, invitación y aportaciones automáticas.
\set ON_ERROR_STOP 1
\set QUIET 1
\echo '--- 1. Usuario actual, sin cambios visibles'
set role authenticated;
select pruebas.como('yo');
select pruebas.ok(jsonb_array_length(mis_cuentas()) = 1, 'yo: solo tengo mi cuenta personal');
select pruebas.ok((select count(*) from months) = 2, 'yo: veo mis 2 meses');
select pruebas.ok((select count(*) from config) = 1, 'yo: veo mi configuración');
select count(*) as deudas_antes from debts \gset
insert into debts (persona, importe) values ('Versión antigua de la app', 1);
select pruebas.ok((select count(*) from debts) = :deudas_antes + 1, 'una versión antigua (sin cuenta_id) sigue pudiendo guardar');

\echo '--- 2. Pareja: usuario nuevo, no ve nada mío'
select pruebas.como('pareja');
select pruebas.ok(jsonb_array_length(mis_cuentas()) = 1, 'pareja: se le crea su cuenta personal');
select pruebas.ok((select count(*) from months) + (select count(*) from incomes) + (select count(*) from debts) = 0, 'pareja: no ve nada de mi cuenta');
insert into config (cuenta_id) values (mi_cuenta_personal());

\echo '--- 3. Intruso (no está en app_owner)'
select pruebas.como('intruso');
do $$ begin perform mis_cuentas(); raise exception 'FALLO: intruso pudo llamar a mis_cuentas'; exception when insufficient_privilege then raise notice 'OK  intruso: mis_cuentas rechazado'; end $$;
select pruebas.ok((select count(*) from months) = 0 and (select count(*) from cuentas) = 0, 'intruso: no ve nada');

\echo '--- 4. Crear cuenta compartida (aportaciones apagadas)'
select pruebas.como('yo');
select crear_cuenta_compartida('Casa', 'Rodrigo', 'Pareja@Ejemplo.com', 'Ana') as compartida \gset
select pruebas.ok(jsonb_array_length(mis_cuentas()) = 2, 'yo: ahora tengo 2 cuentas');
select pruebas.ok((select aportacion_activa from cuentas where id = :'compartida') = false, 'aportaciones apagadas por defecto');
select pruebas.como('pareja');
select pruebas.ok(jsonb_array_length(mis_cuentas()) = 2, 'pareja: al entrar acepta la invitación y ve 2 cuentas');
select pruebas.ok((select count(*) from config) = 2, 'pareja: ve la configuración de la compartida');
select pruebas.ok((select count(*) from months where cuenta_id = pruebas.personal('11111111-1111-1111-1111-111111111111')) = 0, 'pareja: sigue sin ver mis meses');

\echo '--- 5. Meses de noviembre'
select pruebas.como('pareja');
select insertar_mes(mi_cuenta_personal(), '{"id":"cccccccc-0000-0000-0000-000000000011","fecha":"2026-11-01"}', '[{"id":"cccccccc-1111-0000-0000-000000000001","concepto":"Nomina","orden":0}]', '[]', null);
update incomes set importe = 1500 where id = 'cccccccc-1111-0000-0000-000000000001';
select pruebas.como('yo');
select insertar_mes(:'compartida', '{"id":"dddddddd-0000-0000-0000-000000000011","fecha":"2026-11-01","titulo":"Casa"}', '[]', '[{"id":"dddddddd-2222-0000-0000-000000000001","concepto":"Supermercado","orden":0}]', null);
select pruebas.ok((select count(*) from incomes where month_id = 'dddddddd-0000-0000-0000-000000000011') = 0, 'con aportaciones apagadas no se crean filas automáticas');
select pruebas.ok((select count(*) from expenses e where e.cuenta_id = :'compartida') = 1, 'la compartida tiene su gasto de supermercado');

\echo '--- 6. Activar aportaciones al 10 %'
update cuentas set aportacion_activa = true, pct_aportacion = 10 where id = :'compartida';
reset role;
select pruebas.ok(pruebas.ap_compartida('11111111-1111-1111-1111-111111111111') = 210, 'mi aportación = 10 % de 2.100 = 210');
select pruebas.ok(pruebas.ap_compartida('22222222-2222-2222-2222-222222222222') = 150, 'aportación de Ana = 10 % de 1.500 = 150');
select pruebas.ok(pruebas.ap_personal('11111111-1111-1111-1111-111111111111') = 210, 'gasto de 210 en mi cuenta personal');
select pruebas.ok(pruebas.ap_personal('22222222-2222-2222-2222-222222222222') = 150, 'gasto de 150 en la cuenta personal de Ana');
select pruebas.ok((select concepto from incomes where aportacion_de = '22222222-2222-2222-2222-222222222222') = 'Aportación Ana', 'el ingreso se llama «Aportación Ana»');
select pruebas.ok((select concepto from expenses where aportacion_cuenta is not null and user_id = '11111111-1111-1111-1111-111111111111') = 'Aportación Casa', 'el gasto se llama «Aportación Casa»');

\echo '--- 7. Privacidad con aportaciones'
set role authenticated;
select pruebas.como('pareja');
select pruebas.ok((select count(*) from incomes where cuenta_id = pruebas.personal('11111111-1111-1111-1111-111111111111')) = 0, 'Ana no ve mis ingresos personales');
select pruebas.ok((select count(*) from incomes where month_id = 'dddddddd-0000-0000-0000-000000000011') = 2, 'Ana ve las 2 aportaciones en la compartida');
do $$ begin
  insert into incomes (month_id, concepto, importe, orden) values ('aaaaaaaa-0000-0000-0000-000000000011', 'hack', 1, 9);
  raise exception 'FALLO: Ana pudo escribir en mi mes';
exception when others then
  if sqlerrm like 'FALLO%' then raise; end if;
  raise notice 'OK  Ana no puede escribir en mi mes (%)', sqlerrm;
end $$;
do $$ declare n int; begin
  update incomes set importe = 1 where cuenta_id = pruebas.personal('11111111-1111-1111-1111-111111111111');
  get diagnostics n = row_count;
  perform pruebas.ok(n = 0, 'Ana no puede modificar mis ingresos');
end $$;
do $$ begin
  perform recalcular_aportaciones(null, null);
  raise exception 'FALLO: Ana pudo llamar a recalcular_aportaciones';
exception when insufficient_privilege then raise notice 'OK  recalcular_aportaciones no se puede llamar desde la app';
end $$;
do $$ begin
  insert into cuenta_miembros (cuenta_id, user_id, email) select id, '33333333-3333-3333-3333-333333333333', 'x@x.com' from cuentas limit 1;
  raise exception 'FALLO: se pudo añadir un miembro a mano';
exception when insufficient_privilege then raise notice 'OK  no se pueden añadir miembros a mano';
end $$;
do $$ declare n int; begin
  update cuentas set nombre = 'hack' where tipo = 'personal';
  get diagnostics n = row_count;
  perform pruebas.ok(n = 0, 'no se puede tocar una cuenta personal (ni la propia) por la API');
end $$;
select pruebas.como('intruso');
select pruebas.ok((select count(*) from incomes) = 0, 'el intruso sigue sin ver nada');

\echo '--- 8. Cambian mis ingresos → cambia mi aportación'
select pruebas.como('yo');
update incomes set importe = 3000 where cuenta_id = mi_cuenta_personal() and concepto = 'Nomina' and month_id = 'aaaaaaaa-0000-0000-0000-000000000011';
reset role;
select pruebas.ok(pruebas.ap_compartida('11111111-1111-1111-1111-111111111111') = 310, 'nueva aportación 10 % de 3.100 = 310 (compartida)');
select pruebas.ok(pruebas.ap_personal('11111111-1111-1111-1111-111111111111') = 310, 'y 310 en mi cuenta personal');
set role authenticated; select pruebas.como('yo');
insert into incomes (month_id, concepto, importe, orden) values ('aaaaaaaa-0000-0000-0000-000000000011', 'Extra', 55.55, 5);
reset role;
select pruebas.ok(pruebas.ap_compartida('11111111-1111-1111-1111-111111111111') = 315.56, 'añadir un ingreso también recalcula (10 % de 3.155,55 = 315,56)');

\echo '--- 9. La pareja cambia el porcentaje al 20 %'
set role authenticated; select pruebas.como('pareja');
update cuentas set pct_aportacion = 20 where id = :'compartida';
reset role;
select pruebas.ok(pruebas.ap_compartida('11111111-1111-1111-1111-111111111111') = 631.11, 'mi aportación pasa a 631,11 aunque lo cambie ella');
select pruebas.ok(pruebas.ap_compartida('22222222-2222-2222-2222-222222222222') = 300, 'la suya a 300');

\echo '--- 10. Mes personal cerrado = congelado'
set role authenticated; select pruebas.como('yo');
update months set estado = 'Cerrado' where id = 'aaaaaaaa-0000-0000-0000-000000000011';
update cuentas set pct_aportacion = 5 where id = :'compartida';
reset role;
select pruebas.ok(pruebas.ap_compartida('11111111-1111-1111-1111-111111111111') = 631.11, 'con mi mes cerrado, mi aportación no cambia en la compartida');
select pruebas.ok(pruebas.ap_personal('11111111-1111-1111-1111-111111111111') = 631.11, 'ni en mi cuenta personal');
select pruebas.ok(pruebas.ap_compartida('22222222-2222-2222-2222-222222222222') = 75, 'la de Ana (mes abierto) sí: 5 % de 1.500 = 75');
set role authenticated; select pruebas.como('yo');
update cuentas set aportacion_activa = false where id = :'compartida';
reset role;
select pruebas.ok(pruebas.ap_compartida('11111111-1111-1111-1111-111111111111') = 631.11, 'al desactivar, lo de mi mes cerrado se queda');
select pruebas.ok(pruebas.ap_compartida('22222222-2222-2222-2222-222222222222') is null and pruebas.ap_personal('22222222-2222-2222-2222-222222222222') is null, 'lo de Ana (mes abierto) desaparece en los dos lados');

\echo '--- 11. Borrar un mes personal quita su aportación'
set role authenticated; select pruebas.como('pareja');
update cuentas set aportacion_activa = true where id = :'compartida';
reset role;
select pruebas.ok(pruebas.ap_compartida('22222222-2222-2222-2222-222222222222') = 75, 'reactivada: vuelve la aportación de Ana');
set role authenticated; select pruebas.como('pareja');
delete from months where id = 'cccccccc-0000-0000-0000-000000000011';
reset role;
select pruebas.ok(pruebas.ap_compartida('22222222-2222-2222-2222-222222222222') is null, 'Ana borra su mes: su aportación desaparece de la compartida');

\echo '--- 12. Reglas que ya existían'
set role authenticated; select pruebas.como('yo');
do $$ begin
  update incomes set importe = 1 where month_id = 'aaaaaaaa-0000-0000-0000-000000000010';
  raise exception 'FALLO: se pudo modificar un mes cerrado';
exception when raise_exception then
  if sqlerrm like 'FALLO%' then raise; end if;
  raise notice 'OK  un mes cerrado sigue siendo de solo lectura';
end $$;
do $$ begin
  update months set cuenta_id = (select id from cuentas where tipo = 'compartida') where id = 'aaaaaaaa-0000-0000-0000-000000000011';
  raise exception 'FALLO: un mes cambió de cuenta';
exception when raise_exception then
  if sqlerrm like 'FALLO%' then raise; end if;
  raise notice 'OK  un mes no puede cambiar de cuenta';
end $$;
do $$ begin
  perform insertar_mes((select id from cuentas where tipo = 'compartida'), '{"id":"eeeeeeee-0000-0000-0000-000000000001","fecha":"2027-05-01"}', '[]', '[]', null);
  raise exception 'FALLO: se creó un mes saltándose meses';
exception when raise_exception then
  if sqlerrm like 'FALLO%' then raise; end if;
  raise notice 'OK  solo se puede crear el mes siguiente (por cuenta)';
end $$;
select insertar_mes(mi_cuenta_personal(), '{"id":"eeeeeeee-0000-0000-0000-000000000002","fecha":"2026-12-01"}', '[]', '[]', null);
select insertar_mes('{"id":"eeeeeeee-0000-0000-0000-000000000003","fecha":"2027-01-01"}', '[]', '[]', null);
select pruebas.ok((select count(*) from months where cuenta_id = mi_cuenta_personal()) = 4, 'insertar_mes nuevo y antiguo crean meses en mi cuenta personal');
\echo '=== TODO OK'
