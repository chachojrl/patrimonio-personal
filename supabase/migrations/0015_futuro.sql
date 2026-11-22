-- =====================================================================
-- 0015 · Futuro: proyección del patrimonio y libertad financiera.
--
-- Ajustes de cada cuenta (la proyección se calcula en la app, no se guarda):
-- - rentabilidad_inversiones: lo que esperas que rindan las inversiones al año (%).
-- - inflacion: subida de precios anual (%) para ver las cifras «en euros de hoy».
-- - pct_retirada: % de tu patrimonio que sacarías cada año al vivir de él (regla del 4 %).
-- - fire_excluidos: conceptos de gasto que no tendrías entonces (p. ej. la hipoteca pagada).
--
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- =====================================================================

alter table public.config add column if not exists rentabilidad_inversiones numeric(5,2) not null default 5;
alter table public.config add column if not exists inflacion numeric(5,2) not null default 2;
alter table public.config add column if not exists pct_retirada numeric(5,2) not null default 4;
alter table public.config add column if not exists fire_excluidos jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'config_futuro_rangos') then
    alter table public.config add constraint config_futuro_rangos check (
      rentabilidad_inversiones between -50 and 50 and inflacion between -20 and 50 and pct_retirada > 0 and pct_retirada <= 20
      and jsonb_typeof(fire_excluidos) = 'array');
  end if;
end $$;
