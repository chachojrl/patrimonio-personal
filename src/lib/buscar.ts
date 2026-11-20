// Buscador: cuánto has gastado (o ingresado) en conceptos que coinciden con un texto, y en qué meses.
import type { Cents } from './money'
import type { Datos, Deuda } from './tipos'
import { partes } from './fechas'

/** Minúsculas y sin tildes, para que "camion" encuentre "Camión". */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export interface MesImporte {
  fecha: string // primer día del mes
  importe: Cents
}

export interface GrupoConcepto {
  concepto: string // tal como se escribió la última vez
  total: Cents
  meses: MesImporte[] // orden cronológico, solo meses con importe
}

export interface ResultadoBloque {
  grupos: GrupoConcepto[] // de mayor a menor total
  total: Cents
  meses: number // meses distintos con algún importe
}

export interface ApunteEncontrado {
  id: string
  fecha: string // mes al que pertenece
  creado_en: string
  concepto: string
  nota: string
  importe: Cents
}

export interface ResultadoBusqueda {
  gastos: ResultadoBloque
  ingresos: ResultadoBloque
  deudas: Deuda[]
  /** Apuntes («+ €») cuya nota coincide, del más reciente al más antiguo. */
  notas: ApunteEncontrado[]
}

function agrupar(
  filas: { month_id: string; concepto: string; importe: Cents }[],
  fechaDe: Map<string, string>,
  coincide: (concepto: string) => boolean,
  anio: number | null,
): ResultadoBloque {
  const grupos = new Map<string, { concepto: string; ultima: string; porMes: Map<string, Cents> }>()
  for (const f of filas) {
    const fecha = fechaDe.get(f.month_id)
    if (!fecha || f.importe === 0 || !coincide(f.concepto)) continue
    if (anio !== null && partes(fecha).anio !== anio) continue
    const clave = normalizar(f.concepto)
    let g = grupos.get(clave)
    if (!g) grupos.set(clave, (g = { concepto: f.concepto.trim(), ultima: fecha, porMes: new Map() }))
    if (fecha >= g.ultima) {
      g.ultima = fecha
      g.concepto = f.concepto.trim()
    }
    g.porMes.set(fecha, (g.porMes.get(fecha) ?? 0) + f.importe)
  }
  const lista: GrupoConcepto[] = [...grupos.values()].map((g) => {
    const meses = [...g.porMes.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([fecha, importe]) => ({ fecha, importe }))
    return { concepto: g.concepto, total: meses.reduce((a, m) => a + m.importe, 0), meses }
  })
  lista.sort((a, b) => b.total - a.total || a.concepto.localeCompare(b.concepto))
  const mesesDistintos = new Set(lista.flatMap((g) => g.meses.map((m) => m.fecha)))
  return { grupos: lista, total: lista.reduce((a, g) => a + g.total, 0), meses: mesesDistintos.size }
}

/**
 * Busca `texto` en los conceptos de gastos e ingresos y en las deudas (persona o concepto).
 * Con `anio` solo cuenta los meses de ese año; con null, todos.
 */
export function buscar(d: Datos, texto: string, anio: number | null): ResultadoBusqueda {
  const q = normalizar(texto)
  const vacio: ResultadoBloque = { grupos: [], total: 0, meses: 0 }
  if (q === '') return { gastos: vacio, ingresos: vacio, deudas: [], notas: [] }
  const coincide = (s: string) => normalizar(s).includes(q)
  const fechaDe = new Map(d.months.map((m) => [m.id, m.fecha]))
  const deudas = d.debts
    .filter((x) => coincide(x.persona) || coincide(x.concepto))
    .filter((x) => anio === null || partes(x.fecha).anio === anio)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
  const gastoDe = new Map(d.expenses.map((g) => [g.id, g]))
  const notas: ApunteEncontrado[] = []
  for (const a of d.expense_entries) {
    if (!a.nota || !coincide(a.nota)) continue
    const g = gastoDe.get(a.expense_id)
    const fecha = g ? fechaDe.get(g.month_id) : undefined
    if (!g || !fecha || (anio !== null && partes(fecha).anio !== anio)) continue
    notas.push({ id: a.id, fecha, creado_en: a.creado_en, concepto: g.concepto, nota: a.nota, importe: a.importe })
  }
  notas.sort((a, b) => b.creado_en.localeCompare(a.creado_en))
  return {
    gastos: agrupar(d.expenses, fechaDe, coincide, anio),
    ingresos: agrupar(d.incomes, fechaDe, coincide, anio),
    deudas,
    notas,
  }
}

/** Conceptos de gasto con algún importe, del más reciente al más antiguo (para sugerencias). */
export function conceptosGasto(d: Datos): string[] {
  const fechaDe = new Map(d.months.map((m) => [m.id, m.fecha]))
  const vistos = new Map<string, { concepto: string; fecha: string }>()
  for (const g of d.expenses) {
    const fecha = fechaDe.get(g.month_id)
    if (!fecha || g.importe === 0 || g.concepto.trim() === '') continue
    const k = normalizar(g.concepto)
    const prev = vistos.get(k)
    if (!prev || fecha > prev.fecha) vistos.set(k, { concepto: g.concepto.trim(), fecha })
  }
  return [...vistos.values()].sort((a, b) => b.fecha.localeCompare(a.fecha) || a.concepto.localeCompare(b.concepto)).map((x) => x.concepto)
}
