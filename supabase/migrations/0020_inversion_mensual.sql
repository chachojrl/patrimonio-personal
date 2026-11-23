-- =====================================================================
-- 0020 · Futuro: lo que inviertes al mes.
--
-- config.inversion_mensual: lo que metes cada mes en inversiones, si lo escribes tú.
-- Vacío (null) = la proyección usa la media de tus últimos meses.
--
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- =====================================================================

alter table public.config add column if not exists inversion_mensual numeric(12,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'config_inversion_mensual_positiva') then
    alter table public.config add constraint config_inversion_mensual_positiva check (inversion_mensual is null or inversion_mensual >= 0);
  end if;
end $$;
