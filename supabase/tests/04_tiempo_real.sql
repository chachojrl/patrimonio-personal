-- Tiempo real (0008): las tablas de la app están publicadas y las reglas de acceso siguen igual.
\set ON_ERROR_STOP 1
\set QUIET 1
reset role;
select pruebas.ok(
  (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
     and tablename in ('config','months','incomes','expenses','expense_entries','savings','debts','cuentas','cuenta_miembros')) = 9,
  'las 9 tablas de la app están en la publicación de tiempo real');
select pruebas.ok(
  (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'app_owner') = 0,
  'la lista de usuarios autorizados (app_owner) NO se publica');
select pruebas.ok(
  (select bool_and(relrowsecurity) from pg_class where relnamespace = 'public'::regnamespace
     and relname in ('config','months','incomes','expenses','expense_entries','savings','debts','cuentas','cuenta_miembros')),
  'todas siguen con las reglas de acceso (RLS) activadas');
\echo '=== TIEMPO REAL OK'
