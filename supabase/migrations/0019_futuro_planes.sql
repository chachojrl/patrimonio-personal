-- =====================================================================
-- 0019 · Futuro: proyección más realista y tus planes.
--
-- Ajustes de cada cuenta (la proyección se sigue calculando en la app):
-- - crecimiento_ahorro: cuánto sube al año lo que ahorras cada mes (%).
-- - comision_inversiones: comisiones anuales de tus fondos (%).
-- - impuestos_futuro: descontar el IRPF del ahorro al vender las inversiones.
-- - volatilidad: cuánto suben y bajan las inversiones de un año a otro (%).
-- - anio_nacimiento: para ver la proyección por edad (vacío = sin poner).
-- - eventos_futuro: cambios previstos (compras, fin de la hipoteca, pensión…).
--   Lista de objetos {id, nombre, tipo, importe (céntimos), desde, hasta}.
--
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- =====================================================================

alter table public.config add column if not exists crecimiento_ahorro numeric(5,2) not null default 2;
alter table public.config add column if not exists comision_inversiones numeric(5,2) not null default 0.2;
alter table public.config add column if not exists impuestos_futuro boolean not null default true;
alter table public.config add column if not exists volatilidad numeric(5,2) not null default 15;
alter table public.config add column if not exists anio_nacimiento integer;
alter table public.config add column if not exists eventos_futuro jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'config_futuro_planes_rangos') then
    alter table public.config add constraint config_futuro_planes_rangos check (
      crecimiento_ahorro between -20 and 30 and comision_inversiones between 0 and 10 and volatilidad between 0 and 60
      and (anio_nacimiento is null or anio_nacimiento between 1900 and 2100)
      and jsonb_typeof(eventos_futuro) = 'array' and jsonb_array_length(eventos_futuro) <= 100);
  end if;
end $$;
