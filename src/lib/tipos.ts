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
  /** Aportación automática a la cuenta compartida: id del usuario que aporta (la calcula el servidor). */
  aportacion_de?: string | null
}

export interface Gasto {
  id: string
  month_id: string
  concepto: string
  fecha_vencimiento: string | null
  importe: Cents
  orden: number
  /** Gasto fijo: al crear el mes siguiente se copia con el mismo importe. */
  fijo: boolean
  /** Límite de presupuesto para este concepto (null = sin límite). */
  presupuesto: Cents | null
  /** Aportación automática a esa cuenta compartida (la calcula el servidor). */
  aportacion_cuenta?: string | null
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

/** Dinero que te deben. No forma parte de ningún mes ni de los cálculos. */
export interface Deuda {
  id: string
  persona: string
  concepto: string
  importe: Cents
  fecha: string // día en que prestaste o pagaste
  /** Fecha en que te lo devolvieron (null = pendiente). */
  devuelto_en: string | null
}

export type TipoCuenta = 'personal' | 'compartida'

export interface MiembroCuenta {
  id: string
  user_id: string | null // null = invitación pendiente
  email: string
  nombre: string
}

/** Una cuenta: la personal de cada usuario o una compartida entre varios. */
export interface Cuenta {
  id: string
  nombre: string
  tipo: TipoCuenta
  aportacion_activa: boolean
  pct_aportacion: number | null // porcentaje (0–100)
  miembros: MiembroCuenta[]
}

export interface Datos {
  config: Config
  months: Mes[]
  incomes: Ingreso[]
  expenses: Gasto[]
  expense_entries: ApunteGasto[]
  savings: Ahorro[]
  debts: Deuda[]
}

export type Tabla = 'months' | 'incomes' | 'expenses' | 'expense_entries' | 'savings' | 'debts'

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
  return { config: { ...CONFIG_INICIAL }, months: [], incomes: [], expenses: [], expense_entries: [], savings: [], debts: [] }
}

/** Completa campos que pueden faltar en datos antiguos (copias JSON o modo local de versiones previas). */
export function normalizarDatos(d: Datos): Datos {
  return {
    ...d,
    expenses: d.expenses.map((g) => ({ ...g, fijo: g.fijo ?? false, presupuesto: g.presupuesto ?? null })),
    expense_entries: d.expense_entries ?? [],
    debts: d.debts ?? [],
  }
}
