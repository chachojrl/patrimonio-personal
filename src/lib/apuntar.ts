// Panel rápido de Apuntar: qué conceptos salen primero y cómo se teclea el importe.
import type { Cents } from './money'
import type { Datos, Gasto } from './tipos'
import { normalizar } from './buscar'

/**
 * Gastos del mes ordenados por lo que más sueles apuntar (número de apuntes con ese concepto en
 * todos los meses). Los que nunca se han usado van detrás, en su orden de la hoja.
 */
export function conceptosFrecuentes(d: Datos, gastosMes: Gasto[]): Gasto[] {
  const conceptoDe = new Map(d.expenses.map((g) => [g.id, normalizar(g.concepto)]))
  const usos = new Map<string, number>()
  for (const a of d.expense_entries) {
    const c = conceptoDe.get(a.expense_id)
    if (c) usos.set(c, (usos.get(c) ?? 0) + 1)
  }
  return [...gastosMes].sort((a, b) => (usos.get(normalizar(b.concepto)) ?? 0) - (usos.get(normalizar(a.concepto)) ?? 0) || a.orden - b.orden)
}

/** Tecla del teclado numérico: dígitos, «,» y «⌫». Hasta 7 cifras enteras y 2 decimales. */
export function teclear(texto: string, tecla: string): string {
  if (tecla === '⌫') return texto.slice(0, -1)
  if (tecla === ',' || tecla === '.') {
    if (texto.includes(',')) return texto
    return (texto || '0') + ','
  }
  if (!/^\d$/.test(tecla)) return texto
  const [ent, dec] = texto.split(',')
  if (dec !== undefined) return dec.length >= 2 ? texto : texto + tecla
  if (ent === '0') return tecla
  return ent.length >= 7 ? texto : texto + tecla
}

/** Lo tecleado («12,5») en céntimos; null si no hay importe. */
export function aCentimos(texto: string): Cents | null {
  if (!texto) return null
  const [ent, dec = ''] = texto.split(',')
  const c = Number(ent || '0') * 100 + Number((dec + '00').slice(0, 2))
  return c > 0 ? c : null
}
