import { describe, expect, it } from 'vitest'
import { aCentimos, conceptosFrecuentes, teclear } from './apuntar'
import { datosVacios } from './tipos'
import type { Gasto } from './tipos'

const gasto = (id: string, month_id: string, concepto: string, orden: number): Gasto => ({ id, month_id, concepto, orden, importe: 0, fecha_vencimiento: null, fijo: false, presupuesto: null })

describe('Teclado del panel de Apuntar', () => {
  const escribir = (teclas: string) => [...teclas].reduce(teclear, '')
  it.each([
    ['1250', '1250'],
    ['12,5', '12,5'],
    ['12,555', '12,55'],
    [',5', '0,5'],
    ['1,,2', '1,2'],
    ['007', '7'],
    ['12345678', '1234567'],
    ['12⌫3', '13'],
  ])('%s → %s', (t, r) => expect(escribir(t)).toBe(r))
  it('a céntimos', () => {
    expect(aCentimos('12,5')).toBe(1250)
    expect(aCentimos('0,05')).toBe(5)
    expect(aCentimos('3')).toBe(300)
    expect(aCentimos('0,')).toBeNull()
    expect(aCentimos('')).toBeNull()
  })
})

describe('Conceptos frecuentes', () => {
  it('primero lo que más se apunta, aunque sea en otros meses; después, el orden de la hoja', () => {
    const d = datosVacios()
    d.expenses = [gasto('a1', 'm1', 'Supermercado', 0), gasto('b1', 'm1', 'Gasolina', 1), gasto('a2', 'm2', 'supermercado', 0), gasto('b2', 'm2', 'Gasolina', 1), gasto('c2', 'm2', 'Luz', 2)]
    d.expense_entries = [
      { id: 'e1', expense_id: 'a1', importe: 100, creado_en: '', nota: null },
      { id: 'e2', expense_id: 'a1', importe: 100, creado_en: '', nota: null },
      { id: 'e3', expense_id: 'b2', importe: 100, creado_en: '', nota: null },
      { id: 'e4', expense_id: 'c2', importe: 100, creado_en: '', nota: null },
      { id: 'e5', expense_id: 'c2', importe: 100, creado_en: '', nota: null },
      { id: 'e6', expense_id: 'c2', importe: 100, creado_en: '', nota: null },
    ]
    const mes2 = d.expenses.filter((g) => g.month_id === 'm2')
    expect(conceptosFrecuentes(d, mes2).map((g) => g.concepto)).toEqual(['Luz', 'supermercado', 'Gasolina'])
  })
})
