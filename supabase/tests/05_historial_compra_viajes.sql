-- Historial de cambios, lista de la compra y viajes (0009). Se ejecuta después de 01/02/04.
\set ON_ERROR_STOP 1
\set QUIET 1

\echo '--- Preparación: cuenta compartida «Hogar» con un mes'
set role authenticated; select pruebas.como('yo');
select crear_cuenta_compartida('Hogar', 'Rodrigo', 'pareja@ejemplo.com', 'Ana') as hogar \gset
select pruebas.como('pareja'); select mis_cuentas() is not null;
-- Ana tiene noviembre abierto en su cuenta personal, con su nómina (para las aportaciones)
select insertar_mes(mi_cuenta_personal(), '{"id":"f0000000-0000-0000-0000-0000000000a1","fecha":"2026-11-01"}', '[{"id":"f0000000-1111-0000-0000-0000000000a1","concepto":"Nomina","orden":0}]', '[]', null);
update incomes set importe = 1000 where id = 'f0000000-1111-0000-0000-0000000000a1';
select pruebas.como('yo');
select insertar_mes(:'hogar', '{"id":"f0000000-0000-0000-0000-000000000001","fecha":"2026-11-01","titulo":"Hogar"}', '[]',
  '[{"id":"f0000000-1111-0000-0000-000000000001","concepto":"Alquiler","orden":0,"fijo":true,"importe":"800"},{"id":"f0000000-1111-0000-0000-000000000002","concepto":"Luz","orden":1}]', null);
reset role;
select pruebas.ok((select count(*) from cambios where cuenta_id = :'hogar') = 1, 'crear un mes apunta una sola línea (no cada concepto copiado, ni el fijo)');
select pruebas.ok((select accion || ':' || tabla from cambios where cuenta_id = :'hogar') = 'alta:months', 'la línea es «creó el mes»');

\echo '--- Historial'
set role authenticated; select pruebas.como('yo');
insert into expenses (id, month_id, concepto, importe, orden) values ('f0000000-2222-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Super', 50, 5);
select pruebas.como('pareja');
update expenses set importe = 60 where id = 'f0000000-2222-0000-0000-000000000001';
update expenses set orden = 9 where id = 'f0000000-2222-0000-0000-000000000001';
insert into expense_entries (expense_id, importe, nota) values ('f0000000-1111-0000-0000-000000000002', 12.5, 'factura octubre');
delete from expenses where id = 'f0000000-2222-0000-0000-000000000001';
reset role;
select pruebas.ok((select count(*) from cambios where cuenta_id = :'hogar') = 5, '5 líneas: mes, alta, cambio de importe, apunte y baja (reordenar no cuenta)');
select pruebas.ok((select user_id from cambios where cuenta_id = :'hogar' and accion = 'alta' and tabla = 'expenses') = '11111111-1111-1111-1111-111111111111', 'el alta la hice yo');
select pruebas.ok((select detalle -> 'cambios' -> 'importe' from cambios where cuenta_id = :'hogar' and accion = 'cambio') = '[50, 60]'::jsonb
                  and (select user_id from cambios where cuenta_id = :'hogar' and accion = 'cambio') = '22222222-2222-2222-2222-222222222222',
  'el cambio de 50 a 60 lo hizo Ana');
select pruebas.ok((select detalle ->> 'nota' from cambios where cuenta_id = :'hogar' and tabla = 'expense_entries') = 'factura octubre'
                  and (select detalle ->> 'nombre' from cambios where cuenta_id = :'hogar' and tabla = 'expense_entries') = 'Luz',
  'el apunte guarda el concepto (Luz) y la nota');
select pruebas.ok((select detalle ->> 'nombre' from cambios where cuenta_id = :'hogar' and accion = 'baja') = 'Super', 'la baja dice qué se borró');

\echo '--- Las aportaciones automáticas no se apuntan'
set role authenticated; select pruebas.como('yo');
select count(*) as antes from cambios where cuenta_id = :'hogar' \gset
update cuentas set aportacion_activa = true, pct_aportacion = 10 where id = :'hogar';
reset role;
select pruebas.ok((select count(*) from incomes where cuenta_id = :'hogar' and aportacion_de is not null) = 1
                  and (select count(*) from expenses where aportacion_cuenta = :'hogar') = 1, 'hay aportaciones automáticas (la de Ana, en los dos lados)');
select pruebas.ok((select count(*) from cambios where cuenta_id = :'hogar') = :antes, 'y no aparecen en el historial');

\echo '--- Privacidad del historial'
set role authenticated; select pruebas.como('pareja');
select pruebas.ok((select count(*) from cambios where cuenta_id = pruebas.personal('11111111-1111-1111-1111-111111111111')) = 0, 'Ana no ve el historial de mi cuenta personal');
select pruebas.ok((select count(*) from cambios where cuenta_id = mi_cuenta_personal() and tabla = 'expenses') = 0, 'en su propio historial tampoco sale el gasto automático de aportación');
select pruebas.ok((select count(*) from cambios where cuenta_id = :'hogar') = :antes, 'pero sí el de la compartida');
do $$ begin
  insert into cambios (cuenta_id, tabla, accion) select id, 'x', 'alta' from cuentas limit 1;
  raise exception 'FALLO: se pudo escribir en el historial';
exception when insufficient_privilege then raise notice 'OK  nadie puede escribir en el historial';
end $$;
do $$ declare n int; begin
  delete from cambios; get diagnostics n = row_count;
  perform pruebas.ok(false, 'se pudo borrar el historial');
exception when insufficient_privilege then raise notice 'OK  nadie puede borrar el historial';
end $$;
select pruebas.como('intruso');
select pruebas.ok((select count(*) from cambios) = 0, 'el intruso no ve ningún historial');

\echo '--- Lista de la compra'
select pruebas.como('yo');
insert into lista_compra (cuenta_id, texto) values (:'hogar', 'Leche'), (:'hogar', 'Pan');
insert into lista_compra (texto) values ('Cuchillas'); -- sin cuenta: va a mi cuenta personal
select pruebas.como('pareja');
select pruebas.ok((select count(*) from lista_compra) = 2, 'Ana ve la lista de la compartida, no la mía personal');
update lista_compra set hecho = true where texto = 'Leche';
do $$ begin
  insert into lista_compra (cuenta_id, texto) values (pruebas.personal('11111111-1111-1111-1111-111111111111'), 'hack');
  raise exception 'FALLO: Ana escribió en mi lista personal';
exception when insufficient_privilege then raise notice 'OK  Ana no puede escribir en mi lista personal';
end $$;
select pruebas.como('yo');
select pruebas.ok((select hecho from lista_compra where texto = 'Leche'), 'veo que Ana marcó la leche');
select pruebas.como('intruso');
select pruebas.ok((select count(*) from lista_compra) = 0, 'el intruso no ve ninguna lista');

\echo '--- Viajes'
select pruebas.como('yo');
insert into viajes (id, nombre, moneda, cambio, presupuesto) values ('f0000000-3333-0000-0000-000000000001', 'Londres', 'GBP', 1.17, 900);
insert into viaje_gastos (viaje_id, concepto, categoria, importe, moneda, cambio) values ('f0000000-3333-0000-0000-000000000001', 'Hotel', 'alojamiento', 300, 'GBP', 1.17);
reset role;
select pruebas.ok((select cuenta_id from viaje_gastos where concepto = 'Hotel') = pruebas.personal('11111111-1111-1111-1111-111111111111'), 'el gasto hereda la cuenta del viaje (mi cuenta personal)');
set role authenticated; select pruebas.como('pareja');
select pruebas.ok((select count(*) from viajes) + (select count(*) from viaje_gastos) = 0, 'Ana no ve mi viaje personal');
do $$ begin
  insert into viaje_gastos (viaje_id, concepto, importe) values ('f0000000-3333-0000-0000-000000000001', 'hack', 1);
  raise exception 'FALLO: Ana añadió un gasto a mi viaje';
exception when others then
  if sqlerrm like 'FALLO%' then raise; end if;
  raise notice 'OK  Ana no puede añadir gastos a mi viaje (%)', sqlerrm;
end $$;
insert into viajes (id, cuenta_id, nombre) values ('f0000000-3333-0000-0000-000000000002', :'hogar', 'Vacaciones juntos');
select pruebas.como('yo');
select pruebas.ok((select count(*) from viajes where cuenta_id = :'hogar') = 1, 'un viaje en la compartida lo vemos los dos');
do $$ begin
  insert into viajes (nombre, moneda) values ('Mal', 'eur');
  raise exception 'FALLO: aceptó una moneda mal escrita';
exception when check_violation then raise notice 'OK  la moneda tiene que ser un código de 3 letras (EUR, GBP…)';
end $$;
delete from viajes where id = 'f0000000-3333-0000-0000-000000000001';
reset role;
select pruebas.ok((select count(*) from viaje_gastos where viaje_id = 'f0000000-3333-0000-0000-000000000001') = 0, 'borrar un viaje borra sus gastos');
select pruebas.ok((select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('lista_compra', 'viajes', 'viaje_gastos')) = 3, 'lista y viajes en tiempo real');

\echo '--- El historial se guarda 3 meses'
reset role;
update cambios set creado_en = now() - interval '3 months 1 day' where id = (select min(id) from cambios where cuenta_id = :'hogar');
update cambios set creado_en = now() - interval '2 months' where id = (select max(id) from cambios where cuenta_id = :'hogar');
select count(*) as antes from cambios where cuenta_id = :'hogar' \gset
set role authenticated; select pruebas.como('yo');
update expenses set importe = 61 where id = 'f0000000-1111-0000-0000-000000000002';
reset role;
select pruebas.ok((select count(*) from cambios where cuenta_id = :'hogar') = :antes, 'apuntar un cambio borra los de más de 3 meses (uno menos, uno más)');
select pruebas.ok(not exists (select 1 from cambios where creado_en < now() - interval '3 months'), 'no queda nada con más de 3 meses');
select pruebas.ok(exists (select 1 from cambios where creado_en < now() - interval '1 month'), 'lo de hace 2 meses se conserva');

\echo '--- Borrar la cuenta compartida sigue funcionando con historial, lista y viajes'
set role authenticated; select pruebas.como('pareja');
select borrar_cuenta_compartida(:'hogar', 'hogar');
reset role;
select pruebas.ok((select count(*) from cambios where cuenta_id = :'hogar') + (select count(*) from lista_compra where cuenta_id = :'hogar') + (select count(*) from viajes where cuenta_id = :'hogar') = 0, 'se borra todo, también historial, lista y viajes');
\echo '=== 0009 OK'
