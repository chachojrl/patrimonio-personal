-- =====================================================================
-- 0013 · Intereses de la cuenta remunerada.
--
-- - config.tae_cuenta_rem: la TAE de la cuenta remunerada y desde qué mes vale
--   cada una (los bancos la cambian). Lista JSON: [{"desde":"2026-10-01","tae":2.5}].
-- - config.retencion_intereses: % que Hacienda retiene de los intereses (19 en España).
--   La app suma cada mes los intereses netos: saldo al empezar el mes
--   × ((1 + TAE)^(1/12) − 1) × (1 − retención).
-- - months.intereses_cuenta_rem: lo que de verdad pagó el banco ese mes (opcional).
--   Si se escribe, sustituye a la estimación. Se puede escribir con el mes cerrado,
--   como el valor real de las inversiones.
--
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- =====================================================================

alter table public.config add column if not exists tae_cuenta_rem jsonb not null default '[]'::jsonb;
alter table public.config add column if not exists retencion_intereses numeric(5,2) not null default 19;
alter table public.months add column if not exists intereses_cuenta_rem numeric(12,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'config_tae_cuenta_rem_lista') then
    alter table public.config add constraint config_tae_cuenta_rem_lista check (jsonb_typeof(tae_cuenta_rem) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'config_retencion_intereses_rango') then
    alter table public.config add constraint config_retencion_intereses_rango check (retencion_intereses between 0 and 100);
  end if;
end $$;
