-- Traspasos entre cuentas (0011). Se ejecuta después de 06.
\set ON_ERROR_STOP 1
\set QUIET 1

\echo '--- Traspasos entre cuentas'
set role authenticated; select pruebas.como('yo');
select insertar_mes(mi_cuenta_personal(), jsonb_build_object('id', 'b1000000-0000-0000-0000-000000000001', 'fecha',
  to_char((select max(fecha) from months where cuenta_id = mi_cuenta_personal()) + interval '1 month', 'YYYY-MM-DD')), '[]', '[]', null);

insert into savings (month_id, importe, tipo, origen) values
  ('b1000000-0000-0000-0000-000000000001', 500, 'Cuenta de gastos', 'Cuenta remunerada'),
  ('b1000000-0000-0000-0000-000000000001', 200, 'Cuenta de gastos', 'Inversiones'),
  ('b1000000-0000-0000-0000-000000000001', 100, 'Cuenta remunerada', 'Inversiones'),
  ('b1000000-0000-0000-0000-000000000001', 50, 'Inversiones', 'Ingresos mensuales');
select pruebas.ok((select count(*) from savings where month_id = 'b1000000-0000-0000-0000-000000000001') = 4,
  'se aceptan traspasos a la cuenta de gastos y desde inversiones (y los de siempre)');

do $$ begin
  insert into savings (month_id, importe, tipo, origen) values ('b1000000-0000-0000-0000-000000000001', 10, 'Cuenta de gastos', 'Ingresos mensuales');
  raise exception 'FALLO: aceptó un traspaso de la cuenta de gastos a sí misma';
exception when check_violation then raise notice 'OK  no se puede traspasar de la cuenta de gastos a sí misma';
end $$;
do $$ begin
  insert into savings (month_id, importe, tipo, origen) values ('b1000000-0000-0000-0000-000000000001', 10, 'Inversiones', 'Inversiones');
  raise exception 'FALLO: aceptó un traspaso de inversiones a inversiones';
exception when check_violation then raise notice 'OK  no se puede traspasar de inversiones a inversiones';
end $$;
do $$ begin
  insert into savings (month_id, importe, tipo, origen) values ('b1000000-0000-0000-0000-000000000001', 10, 'Cuenta remunerada', 'Cuenta remunerada');
  raise exception 'FALLO: aceptó un traspaso de la cuenta remunerada a sí misma';
exception when check_violation then raise notice 'OK  no se puede traspasar de la cuenta remunerada a sí misma';
end $$;
do $$ begin
  insert into savings (month_id, importe, tipo, origen) values ('b1000000-0000-0000-0000-000000000001', 10, 'Bitcoin', 'Ingresos mensuales');
  raise exception 'FALLO: aceptó una cuenta que no existe';
exception when check_violation then raise notice 'OK  solo se aceptan las tres cuentas';
end $$;
do $$ begin
  insert into savings (month_id, importe, tipo, origen) values ('b1000000-0000-0000-0000-000000000001', -10, 'Cuenta de gastos', 'Cuenta remunerada');
  raise exception 'FALLO: aceptó un importe negativo';
exception when check_violation then raise notice 'OK  el importe sigue sin poder ser negativo';
end $$;

select pruebas.como('pareja');
select pruebas.ok((select count(*) from savings where month_id = 'b1000000-0000-0000-0000-000000000001') = 0, 'Ana no ve mis traspasos');
\echo '=== 0011 OK'
