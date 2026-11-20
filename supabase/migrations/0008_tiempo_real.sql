-- =====================================================================
-- 0008 · Tiempo real: los cambios aparecen al momento en los demás dispositivos
-- (por ejemplo, un gasto que apunta tu pareja en la cuenta compartida).
--
-- Añade las tablas de la app a la publicación «supabase_realtime» de Supabase.
-- Las reglas de acceso (RLS) se siguen aplicando: cada usuario solo recibe los
-- cambios de las filas que puede ver. De los borrados solo llega el id de la fila.
--
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- =====================================================================

do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['config','months','incomes','expenses','expense_entries','savings','debts','cuentas','cuenta_miembros'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
