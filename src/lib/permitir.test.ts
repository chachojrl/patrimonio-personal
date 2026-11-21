import { describe, expect, it } from 'vitest'
import { simular } from './permitir'
import type { Calculo, MesCalculado } from './calculos'

// 6 meses iguales: ingresan 3.000 €, gastan 2.000 € (ahorran 1.000 €); al final hay 10.000 € de
// saldo y 14.000 € en la cuenta remunerada → colchón de 12 meses.
function calculo(saldo = 1000000, remunerada = 1400000): Calculo {
  const mes = (i: number) => ({
    mes: { id: `m${i}`, fecha: `2026-0${i + 1}-01` },
    conMovimientos: true,
    ingresosTotales: 300000,
    gastosTotales: 200000,
    neto: 100000,
    saldoDisponible: saldo,
    cuentaRemAcum: remunerada,
  }) as unknown as MesCalculado
  const meses = Array.from({ length: 6 }, (_, i) => mes(i))
  return { meses, porId: new Map(), historial: [], kpis: { dineroTotalActual: 5000000 } } as unknown as Calculo
}

describe('¿Me lo puedo permitir?', () => {
  it('una compra pequeña: sí, y cuenta los meses de ahorro y el colchón que queda', () => {
    const s = simular(calculo(), 120000)
    expect(s.veredicto).toBe('si')
    expect(s.ahorroMedio).toBe(100000)
    expect(s.mesesDeAhorro).toBeCloseTo(1.2)
    expect(s.colchonAntes).toBeCloseTo(12)
    expect(s.colchonDespues).toBeCloseTo(11.4)
    expect(s.pctPatrimonio).toBeCloseTo(0.024)
  })
  it('si deja el colchón entre 3 y 6 meses: con cuidado; por debajo de 3: mejor esperar', () => {
    expect(simular(calculo(), 1600000).veredicto).toBe('cuidado') // colchón 4 meses
    expect(simular(calculo(), 2000000).veredicto).toBe('esperar') // colchón 2 meses
  })
  it('más caro que todo lo disponible: mejor esperar', () => {
    expect(simular(calculo(), 3000000).veredicto).toBe('esperar')
  })
  it('a plazos: depende de la cuota frente a lo que ahorras al mes, y el colchón no baja', () => {
    const s = simular(calculo(), 480000, 12) // 400 €/mes
    expect(s.cuota).toBe(40000)
    expect(s.veredicto).toBe('si')
    expect(s.colchonDespues).toBeCloseTo(12)
    expect(simular(calculo(), 960000, 12).veredicto).toBe('cuidado') // 800 €/mes
    expect(simular(calculo(), 1440000, 12).veredicto).toBe('esperar') // 1.200 €/mes
  })
})

describe('¿Me lo puedo permitir?: TAE, entrada y plazos a medida', () => {
  it('cuota con intereses (sistema francés): 10.000 € a 36 meses al 7 % TAE', async () => {
    const { cuotaMensual } = await import('./permitir')
    // Interés mensual equivalente (1,07)^(1/12) − 1 ≈ 0,5654 % → cuota ≈ 307,79 €
    expect(cuotaMensual(1000000, 36, 7)).toBe(30779)
    expect(cuotaMensual(1000000, 36, 0)).toBe(27778)
    expect(cuotaMensual(0, 36, 7)).toBe(0)
  })
  it('la entrada baja el colchón; lo financiado va en cuotas y se suman los intereses', () => {
    const s = simular(calculo(), 2000000, 48, { tae: 6, entrada: 400000 })
    expect(s.entrada).toBe(400000)
    expect(s.financiado).toBe(1600000)
    expect(s.cuota).toBeGreaterThan(1600000 / 48)
    expect(s.totalPagado).toBe(400000 + s.cuota * 48)
    expect(s.intereses).toBe(s.totalPagado - 2000000)
    expect(s.colchonDespues).toBeCloseTo((2400000 - 400000) / 200000)
  })
  it('una entrada mayor que lo disponible: mejor esperar', () => {
    expect(simular(calculo(), 3000000, 60, { entrada: 2500000 }).veredicto).toBe('esperar')
  })
  it('plazos largos a medida (por ejemplo, 60 meses) abaratan la cuota', () => {
    const corto = simular(calculo(), 2400000, 24, { tae: 5 })
    const largo = simular(calculo(), 2400000, 60, { tae: 5 })
    expect(largo.cuota).toBeLessThan(corto.cuota)
    expect(largo.intereses).toBeGreaterThan(corto.intereses)
  })
})
