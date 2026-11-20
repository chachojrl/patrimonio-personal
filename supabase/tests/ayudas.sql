-- Funciones de ayuda para las pruebas (esquema «pruebas», no existe en Supabase).
-- pruebas.como('yo' | 'pareja' | 'intruso') simula la sesión de ese usuario.
\set ON_ERROR_STOP 1
\set QUIET 1
create schema if not exists pruebas;
grant usage on schema pruebas to authenticated;
create or replace function pruebas.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FALLO: %', msg; end if;
  raise notice 'OK  %', msg;
end $$;
grant execute on function pruebas.ok(boolean, text) to authenticated;
create or replace function pruebas.como(u text) returns void language plpgsql as $$
declare e text := case u when 'yo' then 'yo@ejemplo.com' when 'pareja' then 'pareja@ejemplo.com' else 'intruso@ejemplo.com' end;
        id text := case u when 'yo' then '11111111-1111-1111-1111-111111111111' when 'pareja' then '22222222-2222-2222-2222-222222222222' else '33333333-3333-3333-3333-333333333333' end;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', id, 'email', e, 'role', 'authenticated')::text, false);
end $$;
grant execute on function pruebas.como(text) to authenticated;
create or replace function pruebas.personal(u uuid) returns uuid language sql security definer set search_path=public as $$ select public.cuenta_personal_de(u) $$;
grant execute on function pruebas.personal(uuid) to authenticated;
-- importe de la aportación de un usuario en el mes de noviembre de la cuenta compartida / en su cuenta personal (como propietario, sin RLS)
create or replace function pruebas.ap_compartida(u uuid) returns numeric language sql as $$
  select i.importe from incomes i join months m on m.id=i.month_id join cuentas c on c.id=m.cuenta_id
  where c.tipo='compartida' and m.fecha='2026-11-01' and i.aportacion_de=u $$;
create or replace function pruebas.ap_personal(u uuid) returns numeric language sql as $$
  select e.importe from expenses e join months m on m.id=e.month_id
  where m.cuenta_id=pruebas.personal(u) and m.fecha='2026-11-01' and e.aportacion_cuenta is not null $$;

create or replace function pruebas.ap(u uuid, f date) returns numeric language sql as $$
  select e.importe from expenses e join months m on m.id = e.month_id
  where m.cuenta_id = pruebas.personal(u) and m.fecha = f and e.aportacion_cuenta is not null $$;
