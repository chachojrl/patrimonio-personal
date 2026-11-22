// Calendario de gastos: cuánto gastaste cada día. Módulo PURO.
// Solo tienen día los apuntes («+ € nota», el botón +, Siri…) y los gastos con fecha de vencimiento;
// un importe escrito directamente en la casilla del concepto no sabe qué día fue.
import type { Cents } from './money'
import type { Datos } from './tipos'

export interface ApunteDia {
  concepto: string
  importe: Cents
  nota: string | null
  /** 'apunte' (con su hora) o 'vencimiento' (gasto con fecha de vencimiento y sin apuntes). */
  origen: 'apunte' | 'vencimiento'
}

export interface DiaGasto {
  dia: string // "2026-11-16"
  total: Cents
  apuntes: ApunteDia[]
}

/** Fecha local "aaaa-mm-dd" de una marca de tiempo. */
export function diaLocal(ts: string): string {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts.slice(0, 10)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Gastos con día de un mes (fecha = primer día del mes), por día. */
export function gastosDelMes(d: Pick<Datos, 'months' | 'expenses' | 'expense_entries'>, fecha: string): { dias: Map<string, DiaGasto>; conDia: Cents; total: Cents } {
  const mes = d.months.find((m) => m.fecha === fecha)
  const dias = new Map<string, DiaGasto>()
  if (!mes) return { dias, conDia: 0, total: 0 }
  const gastos = d.expenses.filter((g) => g.month_id === mes.id && !g.aportacion_cuenta)
  const total = gastos.reduce((a, g) => a + g.importe, 0)
  const ym = fecha.slice(0, 7)
  const add = (dia: string, a: ApunteDia) => {
    const x = dias.get(dia) ?? { dia, total: 0, apuntes: [] }
    x.total += a.importe
    x.apuntes.push(a)
    dias.set(dia, x)
  }
  for (const g of gastos) {
    const apuntes = d.expense_entries.filter((a) => a.expense_id === g.id)
    for (const a of apuntes) {
      // Un apunte de otro mes (p. ej. apuntado el día 1 en el mes anterior) se pone en el último/primer día del mes
      let dia = diaLocal(a.creado_en)
      if (dia.slice(0, 7) !== ym) dia = dia < fecha ? fecha : ultimoDia(fecha)
      add(dia, { concepto: g.concepto, importe: a.importe, nota: a.nota, origen: 'apunte' })
    }
    // Lo escrito a mano en la casilla no tiene día; un gasto sin apuntes con fecha de vencimiento, sí
    if (apuntes.length === 0 && g.fecha_vencimiento && g.importe > 0 && g.fecha_vencimiento.slice(0, 7) === ym) {
      add(g.fecha_vencimiento, { concepto: g.concepto, importe: g.importe, nota: null, origen: 'vencimiento' })
    }
  }
  const conDia = [...dias.values()].reduce((a, x) => a + x.total, 0)
  return { dias, conDia, total }
}

export function ultimoDia(fecha: string): string {
  const [a, m] = fecha.split('-').map(Number)
  const n = new Date(a, m, 0).getDate()
  return `${fecha.slice(0, 7)}-${String(n).padStart(2, '0')}`
}

/** Semanas del mes para pintar el calendario (lunes primero); null = hueco. */
export function semanasDelMes(fecha: string): (string | null)[][] {
  const [a, m] = fecha.split('-').map(Number)
  const primero = new Date(a, m - 1, 1)
  const hueco = (primero.getDay() + 6) % 7 // lunes = 0
  const n = new Date(a, m, 0).getDate()
  const celdas: (string | null)[] = Array.from({ length: hueco }, () => null)
  for (let i = 1; i <= n; i++) celdas.push(`${fecha.slice(0, 7)}-${String(i).padStart(2, '0')}`)
  while (celdas.length % 7) celdas.push(null)
  const semanas: (string | null)[][] = []
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7))
  return semanas
}

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/**
 * Gasto medio por día de la semana en los meses indicados (solo lo que tiene día).
 * Cuenta los días transcurridos (hasta «hoy»), aunque no gastaras nada, de los meses con algo apuntado con día.
 */
export function mediaPorDiaSemana(d: Pick<Datos, 'months' | 'expenses' | 'expense_entries'>, fechas: string[], hoy: string): { dia: string; media: Cents; total: Cents }[] {
  const total = Array(7).fill(0) as number[]
  const n = Array(7).fill(0) as number[]
  for (const f of fechas) {
    const { dias, conDia } = gastosDelMes(d, f)
    if (conDia === 0) continue // un mes sin nada con día bajaría la media sin motivo
    for (const semana of semanasDelMes(f)) {
      semana.forEach((dia, i) => {
        if (!dia || dia > hoy) return
        n[i]++
        total[i] += dias.get(dia)?.total ?? 0
      })
    }
  }
  return DIAS_SEMANA.map((dia, i) => ({ dia, total: total[i], media: n[i] ? Math.round(total[i] / n[i]) : 0 }))
}
