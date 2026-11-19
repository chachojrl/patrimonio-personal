import type { Cents } from './money'

export type EstadoMes = 'Abierto' | 'Cerrado'
export type TipoAhorro = 'Inversiones' | 'Cuenta remunerada'
export type OrigenAhorro = 'Ingresos mensuales' | 'Cuenta remunerada'

export interface Config {
  mes_inicio: string // "2026-10-01"
  ajuste_cuenta_gastos_inicial: Cents
  inversiones_iniciales: Cents
  aportado_inicial_inversiones: Cents
  cuenta_remunerada_inicial: Cents
  plantilla_ingresos: string[]
  plantilla_gastos: string[]
}

export interface Mes {
  id: string
  fecha: string // primer día del mes
  titulo: string
  estado: EstadoMes
  ultimo_cambio: string | null
  saldo_real_cuenta: Cents | null
  valor_real_inversiones: Cents | null
}

export interface Ingreso {
  id: string
  month_id: string
  concepto: string
  importe: Cents
  orden: number
}

export interface Gasto {
  id: string
  month_id: string
  concepto: string
  fecha_vencimiento: string | null
  importe: Cents
  orden: number
}

export interface ApunteGasto {
  id: string
  expense_id: string
  importe: Cents
  creado_en: string
  nota: string | null
}

export interface Ahorro {
  id: string
  month_id: string
  fecha: string | null
  importe: Cents
  tipo: TipoAhorro
  origen: OrigenAhorro
}

export interface Datos {
  config: Config
  months: Mes[]
  incomes: Ingreso[]
  expenses: Gasto[]
  expense_entries: ApunteGasto[]
  savings: Ahorro[]
}

export type Tabla = 'months' | 'incomes' | 'expenses' | 'expense_entries' | 'savings'

export const PLANTILLA_INGRESOS = ['Nomina', 'Fuente de ingresos 2', 'Fuente de ingresos 3', 'Fuente de ingresos 4', 'Otros']
export const PLANTILLA_GASTOS = [
  'Alquiler/hipoteca', 'Electricidad', 'Gas', 'Teléfono móvil/WiFi', 'Supermercado', 'Pago del coche',
  'Gastos del automóvil/Gasolina', 'Seguro del automóvil', 'Restaurantes', 'Entretenimiento',
  'Comida oficina', 'Regalos', 'Ropa', 'Otros',
]

export const CONFIG_INICIAL: Config = {
  mes_inicio: '2026-10-01',
  ajuste_cuenta_gastos_inicial: -32796,
  inversiones_iniciales: 933600,
  aportado_inicial_inversiones: 1157000,
  cuenta_remunerada_inicial: 1848875,
  plantilla_ingresos: PLANTILLA_INGRESOS,
  plantilla_gastos: PLANTILLA_GASTOS,
}

export function datosVacios(): Datos {
  return { config: { ...CONFIG_INICIAL }, months: [], incomes: [], expenses: [], expense_entries: [], savings: [] }
}
