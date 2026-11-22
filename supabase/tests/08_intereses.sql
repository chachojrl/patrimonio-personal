-- Intereses de la cuenta remunerada (0013). Se ejecuta después de 07.
\set ON_ERROR_STOP 1
\set QUIET 1

\echo '--- Intereses de la cuenta remunerada'
set role authenticated; select pruebas.como('yo');
select pruebas.ok((select tae_cuenta_rem = '[]'::jsonb and retencion_intereses = 19 from config where cuenta_id = mi_cuenta_personal()),
  'sin TAE y con el 19 % de retención por defecto');
update config set tae_cuenta_rem = '[{"desde":"2026-10-01","tae":2.5},{"desde":"2027-03-01","tae":2}]', retencion_intereses = 19
  where cuenta_id = mi_cuenta_personal();
select pruebas.ok((select jsonb_array_length(tae_cuenta_rem) from config where cuenta_id = mi_cuenta_personal()) = 2, 'se guarda la TAE con sus tramos');

do $$ begin
  update config set tae_cuenta_rem = '{"tae":2}' where cuenta_id = mi_cuenta_personal();
  raise exception 'FALLO: aceptó una TAE que no es una lista';
exception when check_violation then raise notice 'OK  la TAE tiene que ser una lista de tramos';
end $$;
do $$ begin
  update config set retencion_intereses = 150 where cuenta_id = mi_cuenta_personal();
  raise exception 'FALLO: aceptó una retención de más del 100 %%';
exception when check_violation then raise notice 'OK  la retención va de 0 a 100 %%';
end $$;

-- Los intereses reales se pueden escribir con el mes cerrado (como el valor real de las inversiones)
update months set estado = 'Cerrado' where id = 'b1000000-0000-0000-0000-000000000001';
update months set intereses_cuenta_rem = 21.37 where id = 'b1000000-0000-0000-0000-000000000001';
select pruebas.ok((select intereses_cuenta_rem from months where id = 'b1000000-0000-0000-0000-000000000001') = 21.37,
  'los intereses reales se guardan aunque el mes esté cerrado');
update months set estado = 'Abierto' where id = 'b1000000-0000-0000-0000-000000000001';

select pruebas.como('pareja');
select pruebas.ok((select count(*) from config where tae_cuenta_rem <> '[]'::jsonb) = 0, 'Ana no ve mi TAE');
update months set intereses_cuenta_rem = 999 where id = 'b1000000-0000-0000-0000-000000000001';
reset role;
select pruebas.ok((select intereses_cuenta_rem from months where id = 'b1000000-0000-0000-0000-000000000001') = 21.37, 'Ana no puede cambiar mis intereses');
\echo '=== 0013 OK'
