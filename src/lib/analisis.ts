// Análisis sobre los datos ya calculados: colchón, 50/30/20, gastos raros y reparto por concepto.
import type { Cents } from './money'
import type { Calculo } from './calculos'
import type { Clase, Datos, Gasto } from './tipos'
import { normalizar } from './buscar'
import { detectarSuscripciones } from './suscripciones'

const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

// ---------- 1. Colchón de emergencia ----------

export interface Colchon {
  liquido: Cents // saldo disponible + cuenta remunerada (las inversiones no cuentan: no son inmediatas)
  gastoMedio: Cents // media de gastos de los últimos meses con gastos (hasta 6)
  mesesUsados: number
  meses: number | null // cuántos meses podrías vivir sin ingresos
  nivel: 'bajo' | 'medio' | 'bueno' | null // < 3, 3–6, ≥ 6 meses
}

export function colchon(c: Calculo): Colchon {
  const ultimo = c.meses.at(-1)
  const liquido = ultimo ? ultimo.saldoDisponible + ultimo.cuentaRemAcum : 0
  const recientes = c.meses.filter((m) => m.gastosTotales > 0).slice(-6)
  const gastoMedio = recientes.length ? Math.round(suma(recientes.map((m) => m.gastosTotales)) / recientes.length) : 0
  const meses = gastoMedio > 0 ? Math.max(0, liquido) / gastoMedio : null
  return {
    liquido,
    gastoMedio,
    mesesUsados: recientes.length,
    meses,
    nivel: meses === null ? null : meses < 3 ? 'bajo' : meses < 6 ? 'medio' : 'bueno',
  }
}

// ---------- 2. Necesidades / caprichos / ahorro (regla 50/30/20) ----------

export interface Reparto503020 {
  ingresos: Cents
  necesidades: Cents
  caprichos: Cents
  sinClasificar: Cents
  ahorro: Cents
  pct: { necesidades: number; caprichos: number; ahorro: number; sinClasificar: number } | null // sobre ingresos
  pendientes: string[] // conceptos con gasto este mes y sin clasificar
}

/** La aportación a la cuenta compartida (casa, facturas…) cuenta como necesidad. */
export function claseDe(g: Gasto, clasificacion: Record<string, Clase>): Clase | null {
  if (g.aportacion_cuenta) return 'necesidad'
  return clasificacion[normalizar(g.concepto)] ?? null
}

export function reparto503020(d: Datos, c: Calculo, monthId: string): Reparto503020 | null {
  const m = c.porId.get(monthId)
  if (!m) return null
  const gastos = d.expenses.filter((g) => g.month_id === monthId && g.importe > 0)
  let necesidades = 0
  let caprichos = 0
  let sinClasificar = 0
  const pendientes = new Set<string>()
  for (const g of gastos) {
    const cl = claseDe(g, d.config.clasificacion ?? {})
    if (cl === 'necesidad') necesidades += g.importe
    else if (cl === 'capricho') caprichos += g.importe
    else {
      sinClasificar += g.importe
      pendientes.add(g.concepto.trim())
    }
  }
  // El ajuste de saldo negativo (gasto no registrado) también es gasto, sin clasificar
  sinClasificar += m.gastosTotales - m.sumGastos
  const ingresos = m.ingresosTotales
  const ahorro = m.ahorroDesdeIngresos
  return {
    ingresos, necesidades, caprichos, sinClasificar, ahorro,
    pct: ingresos > 0 ? { necesidades: necesidades / ingresos, caprichos: caprichos / ingresos, ahorro: ahorro / ingresos, sinClasificar: sinClasificar / ingresos } : null,
    pendientes: [...pendientes],
  }
}

// ---------- 3. Gastos raros ----------

export interface Aviso {
  tipo: 'por-encima' | 'duplicado' | 'subida'
  /** Subida de una suscripción: lo que costaba antes. */
  antes?: Cents
  concepto: string
  importe: Cents
  media?: Cents
  veces?: number
  cuando?: string
}

const UMBRAL_VECES = 2.5
const IMPORTE_MINIMO = 3000 // 30 €: por debajo no merece la pena avisar
const MESES_MINIMOS = 3

export function gastosRaros(d: Datos, monthId: string): Aviso[] {
  const mes = d.months.find((m) => m.id === monthId)
  if (!mes) return []
  const avisos: Aviso[] = []
  const fechaDe = new Map(d.months.map((m) => [m.id, m.fecha]))

  // Concepto muy por encima de su media de meses anteriores
  for (const g of d.expenses.filter((x) => x.month_id === monthId && !x.aportacion_cuenta && x.importe >= IMPORTE_MINIMO)) {
    const clave = normalizar(g.concepto)
    const anteriores = d.expenses.filter((x) => {
      const f = fechaDe.get(x.month_id)
      return f !== undefined && f < mes.fecha && x.importe > 0 && normalizar(x.concepto) === clave
    })
    if (anteriores.length < MESES_MINIMOS) continue
    const media = Math.round(suma(anteriores.map((x) => x.importe)) / anteriores.length)
    if (g.importe > media * UMBRAL_VECES) avisos.push({ tipo: 'por-encima', concepto: g.concepto, importe: g.importe, media, veces: g.importe / media })
  }

  // Dos apuntes iguales en el mismo concepto con menos de 24 h de diferencia
  const gastosMes = new Map(d.expenses.filter((x) => x.month_id === monthId).map((g) => [g.id, g]))
  const apuntes = d.expense_entries.filter((a) => gastosMes.has(a.expense_id)).sort((a, b) => a.creado_en.localeCompare(b.creado_en))
  const vistos = new Set<string>()
  for (let i = 0; i < apuntes.length; i++) {
    for (let j = i + 1; j < apuntes.length; j++) {
      const a = apuntes[i]
      const b = apuntes[j]
      if (Date.parse(b.creado_en) - Date.parse(a.creado_en) > 86_400_000) break
      const clave = `${b.expense_id}:${b.importe}`
      if (a.expense_id === b.expense_id && a.importe === b.importe && !vistos.has(clave)) {
        vistos.add(clave)
        avisos.push({ tipo: 'duplicado', concepto: gastosMes.get(b.expense_id)!.concepto, importe: b.importe, cuando: b.creado_en })
      }
    }
  }
  // Una suscripción que ha subido de precio este mes
  for (const x of detectarSuscripciones(d)) {
    if (x.subida && x.subida.mes === mes.fecha) avisos.push({ tipo: 'subida', concepto: x.nombre, importe: x.subida.a, antes: x.subida.de })
  }
  return avisos
}

// ---------- 6. Reparto por concepto (cuenta compartida) ----------

export interface RepartoMiembro {
  user_id: string
  aportacion: Cents // automática (proporcional a sus ingresos)
  aMedias: Cents // su parte de los gastos «a medias»
  propios: Cents // gastos que paga entero
  extra: Cents // lo que pone además de la aportación = aMedias + propios
}

export interface RepartoCompartida {
  proporcional: Cents // gastos que cubren las aportaciones
  aMedias: Cents
  propios: Cents
  miembros: RepartoMiembro[]
}

export function repartoCompartida(d: Datos, monthId: string, miembros: string[]): RepartoCompartida {
  const gastos = d.expenses.filter((g) => g.month_id === monthId && g.importe > 0)
  const n = Math.max(1, miembros.length)
  const mitad = gastos.filter((g) => g.reparto === 'mitad')
  const totalMitad = suma(mitad.map((g) => g.importe))
  const lista: RepartoMiembro[] = miembros.map((u, i) => {
    // Reparto exacto en céntimos: el resto de dividir va a los primeros
    const parte = Math.floor(totalMitad / n) + (i < totalMitad % n ? 1 : 0)
    const propios = suma(gastos.filter((g) => g.reparto === `u:${u}`).map((g) => g.importe))
    const aportacion = suma(d.incomes.filter((x) => x.month_id === monthId && x.aportacion_de === u).map((x) => x.importe))
    return { user_id: u, aportacion, aMedias: parte, propios, extra: parte + propios }
  })
  const propios = suma(lista.map((m) => m.propios))
  return {
    proporcional: suma(gastos.filter((g) => !g.reparto || (g.reparto !== 'mitad' && !miembros.includes(g.reparto.slice(2)))).map((g) => g.importe)),
    aMedias: totalMitad,
    propios,
    miembros: lista,
  }
}
