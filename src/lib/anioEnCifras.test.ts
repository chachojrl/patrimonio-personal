import { describe, expect, it } from 'vitest'
import { anioEnCifras, anioParaAviso } from './anioEnCifras'
import { calcular } from './calculos'
import { datosIniciales } from './operaciones'

describe('Tu año en cifras', () => {
  const d = datosIniciales()
  const c = calcular(d)
  const [oct, nov] = c.meses

  it('totales del año, patrimonio de principio a fin y meses destacados', () => {
    const a = anioEnCifras(d, c, 2026)!
    expect(a.meses).toBe(2)
    expect(a.ingresos).toBe(oct.ingresosTotales + nov.ingresosTotales)
    expect(a.gastos).toBe(oct.gastosTotales + nov.gastosTotales)
    expect(a.patrimonio.inicio).toBe(c.kpis.saldoInicialTotal)
    expect(a.patrimonio.fin).toBe(nov.dineroTotal)
    expect(a.mejorMes?.fecha).toBe((oct.neto >= nov.neto ? oct : nov).mes.fecha)
    expect(a.topGastos.length).toBeLessThanOrEqual(3)
    expect(a.topGastos.map((x) => x.total)).toEqual([...a.topGastos.map((x) => x.total)].sort((x, y) => y - x))
  })

  it('un año sin meses no tiene resumen', () => {
    expect(anioEnCifras(d, c, 2020)).toBeNull()
  })

  it('el aviso sale en diciembre (año en curso) y en enero (año anterior)', () => {
    expect(anioParaAviso(new Date(2026, 11, 3))).toBe(2026)
    expect(anioParaAviso(new Date(2027, 0, 10))).toBe(2026)
    expect(anioParaAviso(new Date(2026, 5, 1))).toBeNull()
  })
})
