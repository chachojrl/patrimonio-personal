import type { Cents } from './money'

export type EstadoMes = 'Abierto' | 'Cerrado'
/** Destino de un movimiento de ahorro / traspaso. */
export type TipoAhorro = 'Inversiones' | 'Cuenta remunerada' | 'Cuenta de gastos'
/** Origen de un movimiento: 'Ingresos mensuales' es la cuenta de gastos. */
export type OrigenAhorro = 'Ingresos mensuales' | 'Cuenta remunerada' | 'Inversiones'
/** Las tres cuentas entre las que se mueve el dinero. */
export type CuentaDinero = 'gastos' | 'remunerada' | 'inversiones'

export interface Config {
  mes_inicio: string // "2026-10-01"
  ajuste_cuenta_gastos_inicial: Cents
  inversiones_iniciales: Cents
  aportado_inicial_inversiones: Cents
  cuenta_remunerada_inicial: Cents
  plantilla_ingresos: string[]
  plantilla_gastos: string[]
  /** Regla 50/30/20: concepto de gasto (normalizado) → necesidad o capricho. */
  clasificacion: Record<string, Clase>
  /** TAE de la cuenta remunerada (en %) y desde qué mes vale cada una. Vacía = sin intereses. */
  tae_cuenta_rem: TramoTae[]
  /** % de los intereses que retiene Hacienda (19 en España). La app suma los intereses netos. */
  retencion_intereses: number
  /** Rentabilidad anual que esperas de las inversiones (%), para la proyección. */
  rentabilidad_inversiones: number
  /** Inflación anual (%), para ver la proyección en euros de hoy. */
  inflacion: number
  /** % del patrimonio que sacarías cada año al vivir de él (regla del 4 %). */
  pct_retirada: number
  /** Conceptos de gasto (normalizados) que no tendrías al vivir de tus ahorros. */
  fire_excluidos: string[]
}

export interface TramoTae {
  desde: string // primer día del mes: "2026-10-01"
  tae: number // en %: 2.5 = 2,5 %
}

export type Clase = 'necesidad' | 'capricho'

export interface Mes {
  id: string
  fecha: string // primer día del mes
  titulo: string
  estado: EstadoMes
  ultimo_cambio: string | null
  saldo_real_cuenta: Cents | null
  valor_real_inversiones: Cents | null
  /** Intereses que pagó de verdad la cuenta remunerada ese mes (null = se estiman con la TAE). */
  intereses_cuenta_rem: Cents | null
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
  /** Cuenta compartida: null = proporcional (aportaciones), 'mitad' o 'u:<user_id>' (lo paga ese miembro). */
  reparto?: string | null
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

/** Artículo de la lista de la compra (por cuenta; la compartida la veis los dos). */
export interface ArticuloCompra {
  id: string
  texto: string
  hecho: boolean
  orden: number
  creado_en: string
}

export type CategoriaViaje = 'alojamiento' | 'transporte' | 'comida' | 'ocio' | 'compras' | 'otros'

export interface Viaje {
  id: string
  nombre: string
  moneda: string // código ISO: EUR, GBP, USD…
  cambio: number // euros por 1 unidad de la moneda (por defecto para los gastos nuevos)
  presupuesto: Cents | null // en euros
  fecha_inicio: string | null
  fecha_fin: string | null
  cerrado: boolean
}

export interface GastoViaje {
  id: string
  viaje_id: string
  fecha: string
  concepto: string
  categoria: CategoriaViaje
  importe: Cents // en céntimos de la moneda del gasto
  moneda: string
  cambio: number // euros por unidad, el del día del gasto
}

/** Hucha: un objetivo de ahorro. Reserva dinero, no lo mueve (el dinero total no cambia). */
export interface Hucha {
  id: string
  nombre: string
  emoji: string
  objetivo: Cents
  fecha_objetivo: string | null
  /** Lo que piensas meter cada mes (null = sin aportación mensual). «Cerrar mes…» lo propone. */
  aportacion_mensual: Cents | null
  /** Cuenta donde está el dinero (opcional). */
  cuenta: CuentaDinero | null
  orden: number
  /** Día en que la marcaste como conseguida (null = en curso). */
  conseguida_en: string | null
}

/** Dinero que se mete (positivo) o se saca (negativo) de una hucha. */
export interface MovimientoHucha {
  id: string
  hucha_id: string
  fecha: string
  importe: Cents
  nota: string | null
  /** Mes de la aportación mensual (primer día del mes); null si se metió a mano. */
  mes: string | null
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
  lista_compra: ArticuloCompra[]
  viajes: Viaje[]
  viaje_gastos: GastoViaje[]
  huchas: Hucha[]
  hucha_movimientos: MovimientoHucha[]
}

export type Tabla = 'months' | 'incomes' | 'expenses' | 'expense_entries' | 'savings' | 'debts' | 'lista_compra' | 'viajes' | 'viaje_gastos' | 'huchas' | 'hucha_movimientos'

/** Un cambio hecho desde otro dispositivo (o por el servidor), recibido en tiempo real. */
export type CambioRemoto =
  | { tabla: Tabla; tipo: 'INSERT' | 'UPDATE'; fila: Datos[Tabla][number] }
  | { tabla: Tabla; tipo: 'DELETE'; id: string }
  | { tabla: 'config'; tipo: 'UPDATE'; config: Config }

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
  clasificacion: {},
  tae_cuenta_rem: [],
  retencion_intereses: 19,
  rentabilidad_inversiones: 5,
  inflacion: 2,
  pct_retirada: 4,
  fire_excluidos: [],
}

export function datosVacios(): Datos {
  return { config: { ...CONFIG_INICIAL }, months: [], incomes: [], expenses: [], expense_entries: [], savings: [], debts: [], lista_compra: [], viajes: [], viaje_gastos: [], huchas: [], hucha_movimientos: [] }
}

/** Completa campos que pueden faltar en datos antiguos (copias JSON o modo local de versiones previas). */
export function normalizarDatos(d: Datos): Datos {
  return {
    ...d,
    config: {
      ...d.config,
      clasificacion: d.config?.clasificacion ?? {},
      tae_cuenta_rem: d.config?.tae_cuenta_rem ?? [],
      retencion_intereses: d.config?.retencion_intereses ?? 19,
      rentabilidad_inversiones: d.config?.rentabilidad_inversiones ?? 5,
      inflacion: d.config?.inflacion ?? 2,
      pct_retirada: d.config?.pct_retirada ?? 4,
      fire_excluidos: d.config?.fire_excluidos ?? [],
    },
    months: d.months.map((m) => ({ ...m, intereses_cuenta_rem: m.intereses_cuenta_rem ?? null })),
    expenses: d.expenses.map((g) => ({ ...g, fijo: g.fijo ?? false, presupuesto: g.presupuesto ?? null })),
    expense_entries: d.expense_entries ?? [],
    debts: d.debts ?? [],
    lista_compra: d.lista_compra ?? [],
    viajes: d.viajes ?? [],
    viaje_gastos: d.viaje_gastos ?? [],
    huchas: d.huchas ?? [],
    hucha_movimientos: d.hucha_movimientos ?? [],
  }
}
