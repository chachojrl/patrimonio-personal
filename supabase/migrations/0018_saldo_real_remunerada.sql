-- =====================================================================
-- 0018 · Saldo real de la cuenta remunerada.
--
-- months.saldo_real_remunerada: lo que dice el banco que hay en la cuenta remunerada
-- a final de ese mes (opcional). Si se escribe, la diferencia con lo calculado se
-- ajusta sola y los meses siguientes parten de esa cifra. Se puede escribir con el
-- mes cerrado, como el valor real de las inversiones.
--
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez.
-- =====================================================================

alter table public.months add column if not exists saldo_real_remunerada numeric(12,2);
