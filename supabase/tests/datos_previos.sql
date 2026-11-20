-- Datos de ejemplo creados con la app ANTES de la migración 0005 (incluye un mes cerrado).
-- Datos existentes de "yo" ANTES de la migración 0005 (como la app actual)
-- Usuarios autorizados (el intruso NO)
insert into app_owner values ('yo@ejemplo.com', false), ('pareja@ejemplo.com', false) on conflict do nothing;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"yo@ejemplo.com","role":"authenticated"}', false);
insert into config default values;
insert into months (id, fecha, estado) values ('aaaaaaaa-0000-0000-0000-000000000010','2026-10-01','Abierto'), ('aaaaaaaa-0000-0000-0000-000000000011','2026-11-01','Abierto');
insert into incomes (month_id, concepto, importe, orden) values ('aaaaaaaa-0000-0000-0000-000000000010','Nomina',2593,0), ('aaaaaaaa-0000-0000-0000-000000000011','Nomina',2000,0), ('aaaaaaaa-0000-0000-0000-000000000011','Otros',100,1);
insert into expenses (id, month_id, concepto, importe, orden) values ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000010','Super',100,0), ('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000011','Super',50,0);
insert into expense_entries (expense_id, importe) values ('bbbbbbbb-0000-0000-0000-000000000001', 100);
insert into savings (month_id, importe) values ('aaaaaaaa-0000-0000-0000-000000000010', 500);
do $$ begin
  if to_regclass('public.debts') is not null then
    insert into debts (persona, importe) values ('Juan', 30);
  end if;
end $$;
update months set estado='Cerrado' where id='aaaaaaaa-0000-0000-0000-000000000010';
reset role;
