-- =====================================================================
-- 0012 · El historial de cambios (Actividad) se guarda 3 meses, no un año.
--
-- Es la tabla que más crece: una fila por cada cambio. Ahora, cada vez que se
-- apunta un cambio, se borran los de cualquier cuenta con más de 3 meses
-- desde que se crearon. Al ejecutar esta migración se borran ya los antiguos.
--
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- =====================================================================

-- Para borrar por fecha sin recorrer toda la tabla
create index if not exists cambios_creado_en on public.cambios(creado_en);

create or replace function public.tg_limpiar_cambios() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from cambios where creado_en < now() - interval '3 months';
  return null;
end $$;

revoke all on function public.tg_limpiar_cambios() from public, anon, authenticated;

-- Una vez por operación (no por fila)
drop trigger if exists limpiar on public.cambios;
create trigger limpiar after insert on public.cambios
  for each statement execute function public.tg_limpiar_cambios();

-- Limpieza inicial
delete from public.cambios where creado_en < now() - interval '3 months';
