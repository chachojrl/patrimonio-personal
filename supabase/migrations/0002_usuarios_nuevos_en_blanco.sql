-- Los usuarios nuevos empiezan "en blanco": saldos iniciales a 0 y el historial
-- empieza en el mes actual. No modifica la configuración de quien ya la tiene.
alter table public.config
  alter column mes_inicio set default date_trunc('month', current_date)::date,
  alter column ajuste_cuenta_gastos_inicial set default 0,
  alter column inversiones_iniciales set default 0,
  alter column aportado_inicial_inversiones set default 0,
  alter column cuenta_remunerada_inicial set default 0;
