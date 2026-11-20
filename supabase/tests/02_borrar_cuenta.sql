-- Borrar una cuenta compartida (0006). Se ejecuta después de 01.
\set ON_ERROR_STOP 1
\set QUIET 1
\echo '--- Preparación: mes de diciembre en la compartida y noviembre compartido cerrado'
set role authenticated; select pruebas.como('yo');
select id as compartida from cuentas where tipo = 'compartida' \gset
select insertar_mes(:'compartida', '{"id":"dddddddd-0000-0000-0000-000000000012","fecha":"2026-12-01"}', '[]', '[{"id":"dddddddd-2222-0000-0000-000000000009","concepto":"Luz","orden":0}]', null);
update months set estado = 'Cerrado' where id = 'dddddddd-0000-0000-0000-000000000011';
reset role;
select pruebas.ok((select count(*) from expenses e join months m on m.id = e.month_id where e.aportacion_cuenta = :'compartida' and m.estado = 'Abierto') = 1, 'hay una aportación en un mes personal abierto (diciembre)');
select pruebas.ok((select count(*) from expenses e join months m on m.id = e.month_id where e.aportacion_cuenta = :'compartida' and m.estado = 'Cerrado') = 1, 'y otra en un mes personal cerrado (noviembre)');

\echo '--- Intentos que NO deben borrar nada'
set role authenticated; select pruebas.como('intruso');
do $$ begin perform borrar_cuenta_compartida((select id from public.cuentas where tipo='compartida' limit 1), 'Casa'); raise exception 'FALLO'; exception when insufficient_privilege then raise notice 'OK  el intruso no puede borrarla'; end $$;
select pruebas.como('pareja');
do $$ begin perform borrar_cuenta_compartida(null, 'Casa'); raise exception 'FALLO'; exception when insufficient_privilege then raise notice 'OK  sin cuenta no hace nada'; end $$;
do $$ begin
  perform borrar_cuenta_compartida((select id from cuentas where tipo = 'compartida'), 'Cas');
  raise exception 'FALLO: borró con un nombre mal escrito';
exception when raise_exception then
  if sqlerrm like 'FALLO%' then raise; end if;
  raise notice 'OK  con el nombre mal escrito no borra (%)', sqlerrm;
end $$;
do $$ begin
  perform borrar_cuenta_compartida((select id from cuentas where tipo = 'compartida'), '');
  raise exception 'FALLO: borró sin confirmación';
exception when raise_exception then
  if sqlerrm like 'FALLO%' then raise; end if;
  raise notice 'OK  sin escribir el nombre no borra';
end $$;
select pruebas.como('yo');
do $$ begin
  perform borrar_cuenta_compartida(pruebas.personal('11111111-1111-1111-1111-111111111111'), 'Mi cuenta');
  raise exception 'FALLO: se borró una cuenta personal';
exception when raise_exception then
  if sqlerrm like 'FALLO%' then raise; end if;
  raise notice 'OK  una cuenta personal no se puede borrar (%)', sqlerrm;
end $$;
do $$ begin
  delete from cuentas where tipo = 'compartida';
  raise exception 'FALLO: se pudo borrar la cuenta sin la función';
exception when insufficient_privilege then raise notice 'OK  no se puede borrar la cuenta directamente';
end $$;
reset role;
select pruebas.ok((select count(*) from cuentas where tipo = 'compartida') = 1, 'después de todos los intentos, la cuenta sigue ahí');

\echo '--- Borrado correcto (lo hace Ana, nombre con otras mayúsculas y espacios)'
set role authenticated; select pruebas.como('pareja');
select borrar_cuenta_compartida(:'compartida', '  cAsA ');
reset role;
select pruebas.ok((select count(*) from cuentas where tipo = 'compartida') = 0, 'la cuenta compartida ya no existe');
select pruebas.ok((select count(*) from months where cuenta_id = :'compartida') + (select count(*) from incomes where cuenta_id = :'compartida') + (select count(*) from expenses where cuenta_id = :'compartida') + (select count(*) from config where cuenta_id = :'compartida') + (select count(*) from cuenta_miembros where cuenta_id = :'compartida') = 0, 'no queda nada suyo (meses cerrados incluidos)');
select pruebas.ok((select count(*) from expenses e join months m on m.id = e.month_id where m.estado = 'Abierto' and e.concepto = 'Aportación Casa') = 0, 'la aportación de mi mes abierto ha desaparecido');
select pruebas.ok((select e.importe from expenses e join months m on m.id = e.month_id where m.id = 'aaaaaaaa-0000-0000-0000-000000000011' and e.concepto = 'Aportación Casa' and e.aportacion_cuenta is null) = 631.11, 'la de mi mes cerrado se queda como gasto normal (631,11)');
select pruebas.ok((select estado from months where id = 'aaaaaaaa-0000-0000-0000-000000000011') = 'Cerrado', 'mi mes cerrado sigue cerrado');
select pruebas.ok((select count(*) from months where cuenta_id = pruebas.personal('11111111-1111-1111-1111-111111111111')) = 4, 'mi cuenta personal conserva sus 4 meses');
set role authenticated; select pruebas.como('yo');
select pruebas.ok(jsonb_array_length(mis_cuentas()) = 1, 'yo: vuelvo a tener solo mi cuenta');
select pruebas.como('pareja');
select pruebas.ok(jsonb_array_length(mis_cuentas()) = 1, 'Ana: vuelve a tener solo la suya');
do $$ begin
  update incomes set importe = 1 where month_id = 'aaaaaaaa-0000-0000-0000-000000000010';
exception when others then null; end $$;
select pruebas.como('yo');
do $$ begin
  update expenses set importe = 1 where month_id = 'aaaaaaaa-0000-0000-0000-000000000011';
  raise exception 'FALLO: se pudo modificar un gasto de un mes cerrado';
exception when raise_exception then
  if sqlerrm like 'FALLO%' then raise; end if;
  raise notice 'OK  los meses cerrados siguen siendo de solo lectura';
end $$;
\echo '--- Se puede volver a crear otra'
select crear_cuenta_compartida('Casa nueva', 'Rodrigo', 'pareja@ejemplo.com', 'Ana') is not null as creada \gset
select pruebas.ok(:'creada'::boolean, 'se puede crear una nueva cuenta compartida');
\echo '=== BORRADO OK'
