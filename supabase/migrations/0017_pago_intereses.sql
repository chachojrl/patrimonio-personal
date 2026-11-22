-- =====================================================================
-- 0017 · Cuándo paga el banco los intereses de la cuenta remunerada.
--
-- config.pago_intereses:
-- - 'mes-siguiente' (por defecto): los intereses de un mes se cobran el día 1 del mes
--   siguiente, así que se suman en la hoja del mes siguiente. Por ejemplo, los de
--   noviembre aparecen en diciembre.
-- - 'mismo-mes': se cobran el último día del mes y se suman en ese mismo mes.
--
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- =====================================================================

alter table public.config add column if not exists pago_intereses text not null default 'mes-siguiente';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'config_pago_intereses_valido') then
    alter table public.config add constraint config_pago_intereses_valido check (pago_intereses in ('mes-siguiente', 'mismo-mes'));
  end if;
end $$;
