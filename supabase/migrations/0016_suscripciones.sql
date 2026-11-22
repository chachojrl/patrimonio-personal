-- =====================================================================
-- 0016 · Detector de suscripciones.
--
-- La app detecta sola las suscripciones (gastos pequeños que se repiten cada mes,
-- gastos fijos pequeños y nombres conocidos como Netflix o el gimnasio).
-- Aquí solo se guardan los gastos que marcas como «no es una suscripción»
-- para que no vuelvan a salir, también en tus otros dispositivos.
--
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- =====================================================================

alter table public.config add column if not exists no_suscripciones jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'config_no_suscripciones_lista') then
    alter table public.config add constraint config_no_suscripciones_lista check (jsonb_typeof(no_suscripciones) = 'array');
  end if;
end $$;
