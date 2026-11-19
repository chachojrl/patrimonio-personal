// Operaciones puras que transforman los datos (sin red). Las usan la UI y los tests.
import type { Cents } from './money'
import type { Ahorro, ApunteGasto, Datos, Gasto, Ingreso, Mes } from './tipos'
import { CONFIG_INICIAL, PLANTILLA_GASTOS, PLANTILLA_INGRESOS } from './tipos'
import { indiceMes, mesSiguiente, nombreMes } from './fechas'

export const uid = () => crypto.randomUUID()

export function mesesOrdenados(d: Datos): Mes[] {
  return [...d.months].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export function ultimoMes(d: Datos): Mes | null {
  const m = mesesOrdenados(d)
  return m[m.length - 1] ?? null
}

/** Fecha del mes que se crearía con "Crear mes nuevo". */
export function fechaMesNuevo(d: Datos): string {
  const u = ultimoMes(d)
  return u ? mesSiguiente(u.fecha) : d.config.mes_inicio
}

export interface PlanMesNuevo {
  mes: Mes
  incomes: Ingreso[]
  expenses: Gasto[]
  cerrarMesId: string | null
  nuevoResumen: number | null // año del resumen que aparece por primera vez
}

/** Equivale a la macro CrearMesNuevo: mes siguiente al último, conceptos copiados con importe 0. */
export function planMesNuevo(d: Datos, cerrarAnterior: boolean): PlanMesNuevo {
  const anterior = ultimoMes(d)
  const fecha = fechaMesNuevo(d)
  if (d.months.some((m) => m.fecha === fecha)) throw new Error(`Ya existe el mes ${nombreMes(fecha)}.`)
  const mes: Mes = {
    id: uid(),
    fecha,
    titulo: 'Presupuesto personal',
    estado: 'Abierto',
    ultimo_cambio: null,
    saldo_real_cuenta: null,
    valor_real_inversiones: null,
  }
  let conceptosIng: string[]
  let gastosBase: Pick<Gasto, 'concepto' | 'fijo' | 'presupuesto' | 'importe' | 'fecha_vencimiento'>[]
  if (anterior) {
    conceptosIng = d.incomes.filter((x) => x.month_id === anterior.id).sort((a, b) => a.orden - b.orden).map((x) => x.concepto)
    gastosBase = d.expenses
      .filter((x) => x.month_id === anterior.id)
      .sort((a, b) => a.orden - b.orden)
      .map((x) => ({
        concepto: x.concepto,
        fijo: x.fijo,
        presupuesto: x.presupuesto,
        // Gastos fijos: mismo importe y vencimiento un mes después
        importe: x.fijo ? x.importe : 0,
        fecha_vencimiento: x.fijo && x.fecha_vencimiento ? sumarUnMes(x.fecha_vencimiento) : null,
      }))
  } else {
    conceptosIng = d.config.plantilla_ingresos
    gastosBase = d.config.plantilla_gastos.map((concepto) => ({ concepto, fijo: false, presupuesto: null, importe: 0, fecha_vencimiento: null }))
  }
  const anio = Number(fecha.slice(0, 4))
  const yaHabiaAnio = d.months.some((m) => m.fecha.startsWith(`${anio}-`))
  return {
    mes,
    incomes: conceptosIng.map((concepto, i) => ({ id: uid(), month_id: mes.id, concepto, importe: 0, orden: i })),
    expenses: gastosBase.map((g, i) => ({ id: uid(), month_id: mes.id, ...g, orden: i })),
    cerrarMesId: cerrarAnterior && anterior && anterior.estado === 'Abierto' ? anterior.id : null,
    nuevoResumen: yaHabiaAnio ? null : anio,
  }
}

export function aplicarPlan(d: Datos, p: PlanMesNuevo): Datos {
  return {
    ...d,
    months: [...d.months.map((m) => (m.id === p.cerrarMesId ? { ...m, estado: 'Cerrado' as const } : m)), p.mes],
    incomes: [...d.incomes, ...p.incomes],
    expenses: [...d.expenses, ...p.expenses],
  }
}

/** Borra un mes y todo lo que cuelga de él. */
export function borrarMes(d: Datos, monthId: string): Datos {
  const gastosIds = new Set(d.expenses.filter((x) => x.month_id === monthId).map((x) => x.id))
  return {
    ...d,
    months: d.months.filter((m) => m.id !== monthId),
    incomes: d.incomes.filter((x) => x.month_id !== monthId),
    expenses: d.expenses.filter((x) => x.month_id !== monthId),
    expense_entries: d.expense_entries.filter((x) => !gastosIds.has(x.expense_id)),
    savings: d.savings.filter((x) => x.month_id !== monthId),
  }
}

/** ¿Borrar este mes dejaría un hueco en el historial? */
export function borrarCreaHueco(d: Datos, monthId: string): boolean {
  const u = ultimoMes(d)
  const primero = mesesOrdenados(d)[0]
  return !!u && u.id !== monthId && primero?.id !== monthId
}

/** Equivale a la macro SumarGasto: suma el importe al gasto y deja un apunte. */
export function anadirGasto(d: Datos, expenseId: string, importe: Cents, ahora = new Date().toISOString()): { datos: Datos; apunte: ApunteGasto; gasto: Gasto } {
  if (!Number.isInteger(importe) || importe <= 0) throw new Error('Introduce un importe numérico.')
  const g = d.expenses.find((x) => x.id === expenseId)
  if (!g) throw new Error('Gasto no encontrado')
  const gasto = { ...g, importe: g.importe + importe }
  const apunte: ApunteGasto = { id: uid(), expense_id: expenseId, importe, creado_en: ahora, nota: null }
  return {
    datos: {
      ...d,
      expenses: d.expenses.map((x) => (x.id === expenseId ? gasto : x)),
      expense_entries: [...d.expense_entries, apunte],
    },
    apunte,
    gasto,
  }
}

/** Deshace un apunte: lo borra y resta su importe (sin bajar de 0). */
export function deshacerApunte(d: Datos, apunteId: string): { datos: Datos; gasto: Gasto | null } {
  const a = d.expense_entries.find((x) => x.id === apunteId)
  if (!a) return { datos: d, gasto: null }
  const g = d.expenses.find((x) => x.id === a.expense_id)
  const gasto = g ? { ...g, importe: Math.max(0, g.importe - a.importe) } : null
  return {
    datos: {
      ...d,
      expenses: d.expenses.map((x) => (gasto && x.id === gasto.id ? gasto : x)),
      expense_entries: d.expense_entries.filter((x) => x.id !== apunteId),
    },
    gasto,
  }
}

/** "2026-01-31" → "2026-02-28" (mismo día del mes siguiente, ajustado al último día si no existe). */
export function sumarUnMes(fecha: string): string {
  const [a, m, d] = fecha.slice(0, 10).split('-').map(Number)
  const anio = m === 12 ? a + 1 : a
  const mes = m === 12 ? 1 : m + 1
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  return `${anio}-${String(mes).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`
}

/**
 * Mueve un elemento de la posición `desde` a `hasta` y devuelve los cambios de `orden`
 * necesarios (solo de las filas que cambian).
 */
export function reordenar<T extends { id: string; orden: number }>(filas: T[], desde: number, hasta: number): { id: string; orden: number }[] {
  const lista = [...filas].sort((a, b) => a.orden - b.orden)
  if (desde === hasta || desde < 0 || hasta < 0 || desde >= lista.length || hasta >= lista.length) return []
  const [mov] = lista.splice(desde, 1)
  lista.splice(hasta, 0, mov)
  return lista.map((x, i) => ({ id: x.id, orden: i })).filter((x) => filas.find((f) => f.id === x.id)!.orden !== x.orden)
}

/** Estado de presupuesto de un gasto: proporción gastada y si se ha superado. */
export function estadoPresupuesto(g: Pick<Gasto, 'importe' | 'presupuesto'>): { pct: number; exceso: Cents } | null {
  if (g.presupuesto === null) return null
  if (g.presupuesto === 0) return { pct: g.importe > 0 ? 1 : 0, exceso: g.importe }
  return { pct: g.importe / g.presupuesto, exceso: Math.max(0, g.importe - g.presupuesto) }
}

export function validarAhorro(a: Pick<Ahorro, 'tipo' | 'origen' | 'importe'>): string | null {
  if (a.tipo === 'Cuenta remunerada' && a.origen === 'Cuenta remunerada') return 'Origen y tipo no pueden ser ambos "Cuenta remunerada".'
  if (a.importe < 0) return 'El importe no puede ser negativo.'
  return null
}

export function mesBloqueado(d: Datos, monthId: string): boolean {
  return d.months.find((m) => m.id === monthId)?.estado === 'Cerrado'
}

export function huecosEntre(d: Datos): number {
  const m = mesesOrdenados(d)
  if (m.length < 2) return 0
  return indiceMes(m[m.length - 1].fecha) - indiceMes(m[0].fecha) + 1 - m.length
}

// ---------- Seed: mis datos actuales (Octubre y Noviembre 2026) ----------

export function datosIniciales(): Datos {
  const ahora = new Date().toISOString()
  const oct: Mes = { id: uid(), fecha: '2026-10-01', titulo: 'Plantilla de presupuesto mensual', estado: 'Cerrado', ultimo_cambio: ahora, saldo_real_cuenta: null, valor_real_inversiones: null }
  const nov: Mes = { id: uid(), fecha: '2026-11-01', titulo: 'Presupuesto personal', estado: 'Abierto', ultimo_cambio: ahora, saldo_real_cuenta: null, valor_real_inversiones: 1760200 }

  const ing = (m: Mes, valores: Record<string, Cents>): Ingreso[] =>
    PLANTILLA_INGRESOS.map((concepto, i) => ({ id: uid(), month_id: m.id, concepto, importe: valores[concepto] ?? 0, orden: i }))
  const gas = (m: Mes, valores: Record<string, Cents>, extra: [string, Cents, number][]): Gasto[] => {
    const base: Gasto[] = PLANTILLA_GASTOS.map((concepto, i) => ({ id: uid(), month_id: m.id, concepto, fecha_vencimiento: null, importe: valores[concepto] ?? 0, orden: i * 10, fijo: false, presupuesto: null }))
    for (const [concepto, importe, orden] of extra) base.push({ id: uid(), month_id: m.id, concepto, fecha_vencimiento: null, importe, orden, fijo: false, presupuesto: null })
    return base.sort((a, b) => a.orden - b.orden).map((g, i) => ({ ...g, orden: i }))
  }

  return {
    config: { ...CONFIG_INICIAL },
    months: [oct, nov],
    incomes: [...ing(oct, { Nomina: 259300 }), ...ing(nov, { Nomina: 179091, Otros: 3479 })],
    expenses: [
      // Octubre: total 428,55 € (Otros 14,00 € + 414,55 € pendiente de repartir)
      ...gas(oct, { Otros: 1400 }, [['Pendiente de desglosar', 41455, 135]]),
      ...gas(nov, {
        'Teléfono móvil/WiFi': 4788, Supermercado: 540, Restaurantes: 6200, Entretenimiento: 700, 'Comida oficina': 2210, Otros: 8449,
      }, [['Golf', 2500, 125]]),
    ],
    expense_entries: [],
    savings: [
      { id: uid(), month_id: oct.id, fecha: '2026-10-01', importe: 400000, tipo: 'Inversiones', origen: 'Cuenta remunerada' },
      { id: uid(), month_id: oct.id, fecha: '2026-10-16', importe: 200000, tipo: 'Inversiones', origen: 'Cuenta remunerada' },
      { id: uid(), month_id: oct.id, fecha: '2026-10-31', importe: 150000, tipo: 'Inversiones', origen: 'Ingresos mensuales' },
      { id: uid(), month_id: nov.id, fecha: '2026-11-16', importe: 119900, tipo: 'Inversiones', origen: 'Ingresos mensuales' },
    ],
  }
}
