-- Gastos fijos y presupuesto por concepto.
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez sin problema.

alter table public.expenses add column if not exists fijo boolean not null default false;
alter table public.expenses add column if not exists presupuesto numeric(12,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'expenses_presupuesto_no_negativo') then
    alter table public.expenses
      add constraint expenses_presupuesto_no_negativo check (presupuesto is null or presupuesto >= 0);
  end if;
end $$;

-- "Crear mes nuevo": ahora copia también si el gasto es fijo, su importe (si es fijo),
-- su vencimiento (si es fijo) y su presupuesto.
create or replace function public.insertar_mes(
  p_mes jsonb, p_incomes jsonb, p_expenses jsonb, p_cerrar uuid
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  f date := (p_mes ->> 'fecha')::date;
  mid uuid := (p_mes ->> 'id')::uuid;
  ultima date;
  inicio date;
begin
  select max(fecha) into ultima from months where user_id = auth.uid();
  if ultima is null then
    select mes_inicio into inicio from config where user_id = auth.uid();
    if inicio is not null and f <> inicio then
      raise exception 'El primer mes debe ser %.', to_char(inicio, 'MM/YYYY');
    end if;
  elsif f <> (ultima + interval '1 month')::date then
    raise exception 'Solo se puede crear el mes siguiente al último.';
  end if;

  insert into months (id, fecha, titulo, estado)
  values (mid, f, coalesce(p_mes ->> 'titulo', 'Presupuesto personal'), 'Abierto');

  insert into incomes (id, month_id, concepto, importe, orden)
  select (x ->> 'id')::uuid, mid, x ->> 'concepto', 0, (x ->> 'orden')::int
  from jsonb_array_elements(p_incomes) x;

  insert into expenses (id, month_id, concepto, fecha_vencimiento, importe, orden, fijo, presupuesto)
  select (x ->> 'id')::uuid, mid, x ->> 'concepto',
         nullif(x ->> 'fecha_vencimiento', '')::date,
         coalesce(nullif(x ->> 'importe', '')::numeric, 0),
         (x ->> 'orden')::int,
         coalesce((x ->> 'fijo')::boolean, false),
         nullif(x ->> 'presupuesto', '')::numeric
  from jsonb_array_elements(p_expenses) x;

  -- Igual que la macro: "Último cambio" vacío en un mes recién creado
  update months set ultimo_cambio = null where id = mid;

  if p_cerrar is not null then
    update months set estado = 'Cerrado' where id = p_cerrar;
  end if;
end $$;

revoke all on function public.insertar_mes(jsonb, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.insertar_mes(jsonb, jsonb, jsonb, uuid) to authenticated;
