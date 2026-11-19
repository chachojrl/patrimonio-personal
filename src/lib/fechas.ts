export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** "2026-11-01" → { anio: 2026, mes: 11 } */
export function partes(fecha: string): { anio: number; mes: number } {
  const [a, m] = fecha.split('-').map(Number)
  return { anio: a, mes: m }
}

/** Índice absoluto de mes (anio*12 + mes-1), para comparar y contar meses. */
export function indiceMes(fecha: string): number {
  const { anio, mes } = partes(fecha)
  return anio * 12 + (mes - 1)
}

export function fechaDesdeIndice(i: number): string {
  const anio = Math.floor(i / 12)
  const mes = (i % 12) + 1
  return `${anio}-${String(mes).padStart(2, '0')}-01`
}

export function mesSiguiente(fecha: string): string {
  return fechaDesdeIndice(indiceMes(fecha) + 1)
}

/** "2026-11-01" → "Noviembre-2026" */
export function nombreMes(fecha: string): string {
  const { anio, mes } = partes(fecha)
  return `${MESES[mes - 1]}-${anio}`
}

/** "2026-11-16" → "16/11/2026" */
export function formatFecha(fecha: string | null | undefined): string {
  if (!fecha) return ''
  const [a, m, d] = fecha.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

/** ISO timestamp → "19/11/2026 14:05" (hora local) */
export function formatFechaHora(ts: string | null | undefined): string {
  if (!ts) return '–'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '–'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Fecha de hoy en formato "aaaa-mm-dd" (hora local). */
export function hoyISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
