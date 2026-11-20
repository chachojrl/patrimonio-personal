-- Simula lo mínimo de Supabase para probar las migraciones en un PostgreSQL normal:
-- roles anon/authenticated, esquema auth con auth.uid()/auth.jwt() (leen request.jwt.claims),
-- 3 usuarios de prueba y un propietario de tablas SIN privilegios especiales (el peor caso).
-- Lo ejecuta ejecutar.sh como superusuario dentro de la base de datos pruebas_bd.
create role anon nologin;
create role authenticated nologin;
create role owner_sim login password 'pruebas' nosuperuser nobypassrls;
grant anon, authenticated to owner_sim;
grant all on schema public to owner_sim;
grant create on database pruebas_bd to owner_sim;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
grant usage on schema auth to owner_sim, authenticated, anon;
grant select, references on auth.users to owner_sim;
grant execute on all functions in schema auth to owner_sim, authenticated, anon;
alter schema public owner to owner_sim;
insert into auth.users values
 ('11111111-1111-1111-1111-111111111111','yo@ejemplo.com'),
 ('22222222-2222-2222-2222-222222222222','pareja@ejemplo.com'),
 ('33333333-3333-3333-3333-333333333333','intruso@ejemplo.com');
-- Supabase la trae creada (tiempo real); aquí basta con que exista
set client_min_messages = error;
create publication supabase_realtime;
alter publication supabase_realtime owner to owner_sim;
