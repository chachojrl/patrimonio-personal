import { describe, expect, it } from 'vitest'
import { aplicarCambioRemoto, datosIniciales } from './operaciones'
import type { Datos, Gasto } from './tipos'

const base = (): Datos => datosIniciales()

describe('Tiempo real: aplicar cambios de otro dispositivo', () => {
  it('UPDATE de un gasto cambia solo esa fila', () => {
    const d = base()
    const g = d.expenses.find((x) => x.importe > 0)!
    const r = aplicarCambioRemoto(d, { tabla: 'expenses', tipo: 'UPDATE', fila: { ...g, importe: g.importe + 1000 } })
    expect(r.expenses.find((x) => x.id === g.id)!.importe).toBe(g.importe + 1000)
    expect(r.expenses.length).toBe(d.expenses.length)
    expect(r.incomes).toBe(d.incomes) // lo demás no se toca
  })

  it('INSERT añade la fila; si ya existe igual (eco propio) no cambia nada', () => {
    const d = base()
    const mes = d.months[1]
    const nuevo: Gasto = { id: 'nuevo', month_id: mes.id, concepto: 'Farmacia', importe: 1250, orden: 99, fijo: false, presupuesto: null, fecha_vencimiento: null, aportacion_cuenta: null }
    const r = aplicarCambioRemoto(d, { tabla: 'expenses', tipo: 'INSERT', fila: nuevo })
    expect(r.expenses.at(-1)).toEqual(nuevo)
    expect(aplicarCambioRemoto(r, { tabla: 'expenses', tipo: 'INSERT', fila: { ...nuevo } })).toBe(r)
  })

  it('DELETE quita la fila (y sus apuntes); si no es de esta cuenta se ignora', () => {
    const d = base()
    const g = d.expenses[0]
    d.expense_entries.push({ id: 'a1', expense_id: g.id, importe: 100, creado_en: '2026-11-01T10:00:00Z', nota: null })
    const r = aplicarCambioRemoto(d, { tabla: 'expenses', tipo: 'DELETE', id: g.id })
    expect(r.expenses.some((x) => x.id === g.id)).toBe(false)
    expect(r.expense_entries.some((x) => x.expense_id === g.id)).toBe(false)
    expect(aplicarCambioRemoto(d, { tabla: 'expenses', tipo: 'DELETE', id: 'de-otra-cuenta' })).toBe(d)
  })

  it('DELETE de un mes quita todo lo que cuelga de él', () => {
    const d = base()
    const nov = d.months.find((m) => m.fecha === '2026-11-01')!
    const r = aplicarCambioRemoto(d, { tabla: 'months', tipo: 'DELETE', id: nov.id })
    expect(r.months.map((m) => m.fecha)).toEqual(['2026-10-01'])
    expect(r.incomes.some((x) => x.month_id === nov.id)).toBe(false)
    expect(r.savings.some((x) => x.month_id === nov.id)).toBe(false)
  })

  it('cambio de configuración', () => {
    const d = base()
    const r = aplicarCambioRemoto(d, { tabla: 'config', tipo: 'UPDATE', config: { ...d.config, cuenta_remunerada_inicial: 1 } })
    expect(r.config.cuenta_remunerada_inicial).toBe(1)
    expect(aplicarCambioRemoto(r, { tabla: 'config', tipo: 'UPDATE', config: { ...r.config } })).toBe(r)
  })
})
