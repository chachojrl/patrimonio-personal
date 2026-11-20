-- Necesidades/caprichos y reparto por concepto (0010). Se ejecuta después de 05.
\set ON_ERROR_STOP 1
\set QUIET 1

\echo '--- Clasificación de conceptos'
set role authenticated; select pruebas.como('yo');
update config set clasificacion = '{"supermercado": "necesidad", "restaurantes": "capricho"}' where cuenta_id = mi_cuenta_personal();
select pruebas.ok((select clasificacion ->> 'restaurantes' from config where cuenta_id = mi_cuenta_personal()) = 'capricho', 'se guarda la clasificación en mi configuración');
select pruebas.como('pareja');
select pruebas.ok((select count(*) from config where clasificacion ? 'restaurantes') = 0, 'Ana no ve mi clasificación');

\echo '--- Reparto por concepto en una cuenta compartida'
select pruebas.como('yo');
select crear_cuenta_compartida('Piso', 'Rodrigo', 'pareja@ejemplo.com', 'Ana') as piso \gset
select pruebas.como('pareja'); select mis_cuentas() is not null;
select pruebas.como('yo');
select insertar_mes(:'piso', '{"id":"a1000000-0000-0000-0000-000000000001","fecha":"2026-11-01","titulo":"Piso"}', '[]', '[]', null);
insert into expenses (id, month_id, concepto, importe, orden, reparto) values
  ('a1000000-1111-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Cena aniversario', 60, 0, 'mitad'),
  ('a1000000-1111-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Gimnasio Ana', 40, 1, 'u:22222222-2222-2222-2222-222222222222'),
  ('a1000000-1111-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'Luz', 50, 2, null);
select pruebas.como('pareja');
select pruebas.ok((select reparto from expenses where concepto = 'Gimnasio Ana') = 'u:22222222-2222-2222-2222-222222222222', 'Ana ve cómo se reparte cada gasto');
do $$ begin
  update expenses set reparto = 'a medias' where concepto = 'Luz';
  raise exception 'FALLO: aceptó un reparto no válido';
exception when check_violation then raise notice 'OK  solo se aceptan repartos válidos (mitad o u:<id>)';
end $$;

\echo '--- Crear mes nuevo copia el reparto'
select pruebas.como('yo');
select insertar_mes(:'piso', '{"id":"a1000000-0000-0000-0000-000000000002","fecha":"2026-12-01"}', '[]',
  '[{"id":"a1000000-2222-0000-0000-000000000001","concepto":"Gimnasio Ana","orden":0,"fijo":true,"importe":"40","reparto":"u:22222222-2222-2222-2222-222222222222"},{"id":"a1000000-2222-0000-0000-000000000002","concepto":"Cena","orden":1,"reparto":"mitad"},{"id":"a1000000-2222-0000-0000-000000000003","concepto":"Luz","orden":2}]', null);
select pruebas.ok((select reparto from expenses where id = 'a1000000-2222-0000-0000-000000000001') = 'u:22222222-2222-2222-2222-222222222222'
                  and (select reparto from expenses where id = 'a1000000-2222-0000-0000-000000000002') = 'mitad'
                  and (select reparto from expenses where id = 'a1000000-2222-0000-0000-000000000003') is null,
  'el mes nuevo conserva el reparto de cada concepto');
select pruebas.ok((select importe from expenses where id = 'a1000000-2222-0000-0000-000000000001') = 40, 'y el importe del gasto fijo');

\echo '--- Historial del reparto'
update expenses set reparto = 'mitad' where id = 'a1000000-2222-0000-0000-000000000003';
reset role;
select pruebas.ok((select detalle -> 'cambios' -> 'reparto' from cambios where fila_id = 'a1000000-2222-0000-0000-000000000003' order by id desc limit 1) = '[null, "mitad"]'::jsonb, 'cambiar el reparto queda en el historial');

\echo '--- La versión antigua de insertar_mes sigue funcionando'
set role authenticated; select pruebas.como('pareja');
select count(*) as meses_ana from months where cuenta_id = mi_cuenta_personal() \gset
select insertar_mes(jsonb_build_object('id', 'a1000000-0000-0000-0000-0000000000f1', 'fecha', to_char((select max(fecha) from months where cuenta_id = mi_cuenta_personal()) + interval '1 month', 'YYYY-MM-DD')), '[]', '[]', null);
select pruebas.ok((select count(*) from months where cuenta_id = mi_cuenta_personal()) = :meses_ana + 1, 'insertar_mes sin cuenta crea el mes en la cuenta personal');
\echo '=== 0010 OK'
