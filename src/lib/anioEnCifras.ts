// «Tu año en cifras»: el resumen del año que se ve como historias. Módulo puro.
import type { Cents } from './money'
import type { Calculo } from './calculos'
import type { Datos } from './tipos'
import { normalizar } from './buscar'
import { partes } from './fechas'
import { resumenViaje } from './viajes'

export interface AnioEnCifras {
  anio: number
  meses: number
  patrimonio: { inicio: Cents; fin: Cents; diferencia: Cents; pct: number | null }
  ingresos: Cents
  gastos: Cents
  ahorro: Cents
  pctAhorro: number | null
  /** Mes con más ingresos menos gastos y mes con más gasto (fechas «AAAA-MM-01»). */
  mejorMes: { fecha: string; neto: Cents } | null
  mesMasGasto: { fecha: string; gastos: Cents } | null
  topGastos: { concepto: string; total: Cents; pct: number }[]
  apuntes: number
  masApuntado: { concepto: string; veces: number } | null
  mayorApunte: { concepto: string; importe: Cents; nota: string | null } | null
  viajes: { nombre: string; total: Cents }[]
}

/** Null si ese año no tiene ningún mes apuntado. */
export function anioEnCifras(d: Datos, c: Calculo, anio: number): AnioEnCifras | null {
  const meses = c.meses.filter((m) => partes(m.mes.fecha).anio === anio)
  if (meses.length === 0) return null
  const idx = c.meses.indexOf(meses[0])
  const inicio = idx > 0 ? c.meses[idx - 1].dineroTotal : c.kpis.saldoInicialTotal
  const fin = meses[meses.length - 1].dineroTotal
  const ingresos = meses.reduce((a, m) => a + m.ingresosTotales, 0)
  const gastos = meses.reduce((a, m) => a + m.gastosTotales, 0)
  const ahorro = meses.reduce((a, m) => a + m.ahorroDesdeIngresos, 0)
  const conMov = meses.filter((m) => m.conMovimientos)
  const mejor = conMov.length ? conMov.reduce((a, b) => (b.neto > a.neto ? b : a)) : null
  const peor = conMov.length ? conMov.reduce((a, b) => (b.gastosTotales > a.gastosTotales ? b : a)) : null

  const ids = new Set(meses.map((m) => m.mes.id))
  const gastosAnio = d.expenses.filter((g) => ids.has(g.month_id))
  const porConcepto = new Map<string, { concepto: string; total: Cents }>()
  for (const g of gastosAnio) {
    if (g.importe <= 0) continue
    const k = normalizar(g.concepto)
    const x = porConcepto.get(k) ?? { concepto: g.concepto.trim(), total: 0 }
    x.total += g.importe
    porConcepto.set(k, x)
  }
  const sumaConceptos = [...porConcepto.values()].reduce((a, x) => a + x.total, 0)
  const topGastos = [...porConcepto.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map((x) => ({ ...x, pct: sumaConceptos > 0 ? x.total / sumaConceptos : 0 }))

  const gastoDe = new Map(gastosAnio.map((g) => [g.id, g]))
  const apuntes = d.expense_entries.filter((a) => gastoDe.has(a.expense_id))
  const veces = new Map<string, { concepto: string; veces: number }>()
  for (const a of apuntes) {
    const g = gastoDe.get(a.expense_id)!
    const k = normalizar(g.concepto)
    const x = veces.get(k) ?? { concepto: g.concepto.trim(), veces: 0 }
    x.veces++
    veces.set(k, x)
  }
  const masApuntado = [...veces.values()].sort((a, b) => b.veces - a.veces)[0] ?? null
  const mayor = apuntes.length ? apuntes.reduce((a, b) => (b.importe > a.importe ? b : a)) : null

  const viajes = d.viajes
    .filter((v) => v.fecha_inicio && Number(v.fecha_inicio.slice(0, 4)) === anio)
    .map((v) => ({ nombre: v.nombre, total: resumenViaje(v, d.viaje_gastos).total }))
    .filter((v) => v.total > 0)

  return {
    anio,
    meses: meses.length,
    patrimonio: { inicio, fin, diferencia: fin - inicio, pct: inicio > 0 ? (fin - inicio) / inicio : null },
    ingresos,
    gastos,
    ahorro,
    pctAhorro: ingresos > 0 ? ahorro / ingresos : null,
    mejorMes: mejor && mejor.neto > 0 ? { fecha: mejor.mes.fecha, neto: mejor.neto } : null,
    mesMasGasto: peor && peor.gastosTotales > 0 ? { fecha: peor.mes.fecha, gastos: peor.gastosTotales } : null,
    topGastos,
    apuntes: apuntes.length,
    masApuntado,
    mayorApunte: mayor ? { concepto: gastoDe.get(mayor.expense_id)!.concepto.trim(), importe: mayor.importe, nota: mayor.nota } : null,
    viajes,
  }
}

/** ¿Toca enseñar el aviso en Inicio? En diciembre, el del año en curso; en enero, el del año anterior. */
export function anioParaAviso(hoy = new Date()): number | null {
  const m = hoy.getMonth()
  if (m === 11) return hoy.getFullYear()
  if (m === 0) return hoy.getFullYear() - 1
  return null
}
