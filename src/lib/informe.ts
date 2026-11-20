// Datos del informe PDF: todo lo que se dibuja sale de aquí (módulo puro, sin jsPDF).
import type { Cents } from './money'
import type { Datos, Deuda, Viaje } from './tipos'
import type { Calculo, MesCalculado, ResumenAnual } from './calculos'
import { aniosConMeses, resumenAnual } from './calculos'
import { colchon, type Colchon } from './analisis'
import { normalizar } from './buscar'
import { resumenViaje, type ResumenViaje } from './viajes'

const suma = (xs: Cents[]) => xs.reduce((a, b) => a + b, 0)

export interface TotalConcepto {
  concepto: string
  total: Cents
  /** Meses en los que aparece con importe. */
  meses: number
}

export interface Destacado {
  titulo: string
  texto: string
}

export interface DatosInforme {
  cuenta: string
  compartida: boolean
  /** Nombre de la persona que aparece en el informe (vacío = no se muestra). */
  titular: string
  /** Cuenta compartida: nombres de los miembros. */
  miembros: string[]
  generado: Date
  meses: MesCalculado[]
  desde: string | null
  hasta: string | null
  kpis: {
    dineroTotal: Cents
    saldoDisponible: Cents
    inversiones: Cents
    totalInvertido: Cents
    gananciaInversiones: Cents
    cuentaRemunerada: Cents
    ingresos: Cents
    gastos: Cents
    ahorroDesdeIngresos: Cents
    pctAhorro: number | null
    /** Dinero total al final menos lo que había al empezar (saldos iniciales). */
    variacion: Cents
    saldoInicial: Cents
  }
  anios: ResumenAnual[]
  gastosPorConcepto: TotalConcepto[]
  ingresosPorConcepto: TotalConcepto[]
  colchon: Colchon
  destacados: Destacado[]
  deudasPendientes: Deuda[]
  viajes: { viaje: Viaje; resumen: ResumenViaje }[]
}

/** Agrupa por concepto (sin distinguir mayúsculas ni tildes) y ordena de mayor a menor. */
function porConcepto(filas: { month_id: string; concepto: string; importe: Cents }[]): TotalConcepto[] {
  const grupos = new Map<string, { concepto: string; total: Cents; meses: Set<string> }>()
  for (const f of filas) {
    if (f.importe === 0) continue
    const k = normalizar(f.concepto) || '(sin concepto)'
    const g = grupos.get(k) ?? { concepto: f.concepto.trim() || '(sin concepto)', total: 0, meses: new Set<string>() }
    g.total += f.importe
    g.meses.add(f.month_id)
    grupos.set(k, g)
  }
  return [...grupos.values()]
    .map((g) => ({ concepto: g.concepto, total: g.total, meses: g.meses.size }))
    .sort((a, b) => b.total - a.total || a.concepto.localeCompare(b.concepto))
}

export function datosInforme(
  d: Datos,
  c: Calculo,
  opts: { cuenta: string; compartida: boolean; titular?: string; miembros?: string[]; generado?: Date },
): DatosInforme {
  const meses = c.meses
  const k = c.kpis
  const ultimo = meses.at(-1)
  const ingresos = suma(meses.map((m) => m.ingresosTotales))
  const gastos = suma(meses.map((m) => m.gastosTotales))
  const ahorroDesdeIngresos = suma(meses.map((m) => m.ahorroDesdeIngresos))

  const gastosPorConcepto = porConcepto(d.expenses)
  const ingresosPorConcepto = porConcepto(d.incomes)
  // El ajuste del saldo real también es gasto / ingreso: se muestra como una línea aparte
  const noApuntado = suma(meses.map((m) => m.gastosTotales - m.sumGastos))
  if (noApuntado > 0) {
    gastosPorConcepto.push({ concepto: 'Gastos no apuntados (ajuste de saldo)', total: noApuntado, meses: meses.filter((m) => m.gastosTotales > m.sumGastos).length })
    gastosPorConcepto.sort((a, b) => b.total - a.total)
  }
  const extra = suma(meses.map((m) => m.ingresosTotales - m.sumIngresos))
  if (extra > 0) {
    ingresosPorConcepto.push({ concepto: 'Ingresos extra (ajuste de saldo)', total: extra, meses: meses.filter((m) => m.ingresosTotales > m.sumIngresos).length })
    ingresosPorConcepto.sort((a, b) => b.total - a.total)
  }

  const col = colchon(c)
  const destacados: Destacado[] = []
  const conMov = meses.filter((m) => m.conMovimientos)
  if (conMov.length > 0) {
    const masAhorro = conMov.reduce((a, b) => (b.ahorroDesdeIngresos > a.ahorroDesdeIngresos ? b : a))
    const masGasto = conMov.reduce((a, b) => (b.gastosTotales > a.gastosTotales ? b : a))
    if (masAhorro.ahorroDesdeIngresos > 0) destacados.push({ titulo: 'Mes con más ahorro', texto: masAhorro.nombre })
    if (masGasto.gastosTotales > 0) destacados.push({ titulo: 'Mes con más gasto', texto: masGasto.nombre })
  }
  if (gastosPorConcepto[0] && gastos > 0) destacados.push({ titulo: 'Mayor gasto', texto: gastosPorConcepto[0].concepto })
  if (!opts.compartida && col.meses !== null) destacados.push({ titulo: 'Colchón', texto: `${col.meses.toFixed(1).replace('.', ',')} meses` })

  return {
    cuenta: opts.cuenta,
    compartida: opts.compartida,
    titular: (opts.titular ?? '').trim(),
    miembros: (opts.miembros ?? []).map((x) => x.trim()).filter(Boolean),
    generado: opts.generado ?? new Date(),
    meses,
    desde: meses[0]?.mes.fecha ?? null,
    hasta: ultimo?.mes.fecha ?? null,
    kpis: {
      dineroTotal: k.dineroTotalActual,
      saldoDisponible: ultimo ? ultimo.saldoDisponible : d.config.ajuste_cuenta_gastos_inicial,
      inversiones: k.totalInversiones,
      totalInvertido: k.totalInvertido,
      gananciaInversiones: k.gananciaInversiones,
      cuentaRemunerada: k.totalCuentaRem,
      ingresos,
      gastos,
      ahorroDesdeIngresos,
      pctAhorro: ingresos > 0 ? ahorroDesdeIngresos / ingresos : null,
      variacion: k.dineroTotalActual - k.saldoInicialTotal,
      saldoInicial: k.saldoInicialTotal,
    },
    anios: aniosConMeses(c).map((a) => resumenAnual(c, a)),
    gastosPorConcepto,
    ingresosPorConcepto,
    colchon: col,
    destacados,
    deudasPendientes: d.debts.filter((x) => !x.devuelto_en).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    viajes: [...d.viajes]
      .sort((a, b) => (a.fecha_inicio ?? '').localeCompare(b.fecha_inicio ?? ''))
      .map((v) => ({ viaje: v, resumen: resumenViaje(v, d.viaje_gastos) })),
  }
}

/** Escalas "redondas" para los ejes: incluye siempre el 0. */
export function escalaBonita(min: number, max: number, marcas = 5): { min: number; max: number; paso: number } {
  let lo = Math.min(0, min)
  let hi = Math.max(0, max)
  if (lo === hi) hi = lo + 1
  const bruto = (hi - lo) / marcas
  const mag = 10 ** Math.floor(Math.log10(bruto))
  const norm = bruto / mag
  const paso = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag
  lo = Math.floor(lo / paso) * paso
  hi = Math.ceil(hi / paso) * paso
  return { min: lo, max: hi, paso }
}

/** Texto apto para las fuentes estándar del PDF (WinAnsi): sin signos que no existen en ellas. */
export function textoPdf(s: string): string {
  return s
    .replace(/−/g, '-')
    .replace(/[→⇄]/g, '->')
    .replace(/[   ]/g, ' ')
    .replace(/[^\u0000-ÿ€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/gu, '')
    .replace(/\s{2,}/g, ' ')
}
