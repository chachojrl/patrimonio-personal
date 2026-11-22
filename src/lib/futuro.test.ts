import { describe, expect, it } from 'vitest'
import { calcular } from './calculos'
import { datosIniciales } from './operaciones'
import { base, conceptosRecientes, escenarios, libertadFinanciera, proyectar, type Base } from './futuro'
import { normalizar } from './buscar'

const cfg = { tae_cuenta_rem: [], retencion_intereses: 19 }
const b0: Base = { desde: '2026-12-01', gastos: 100000, remunerada: 500000, inversiones: 1000000, netoMedio: 50000, aInversiones: 30000, aRemunerada: 10000, mesesMedia: 12 }

describe('Futuro: proyección', () => {
  it('sin rentabilidad ni inflación: lo de hoy + lo que ahorras', () => {
    const p = proyectar(b0, cfg, { rentabilidad: 0, extra: 0, inflacion: 0 }, 12)
    expect(p).toHaveLength(13)
    expect(p[0].total).toBe(1600000)
    expect(p[12].total).toBe(1600000 + 12 * 50000)
    expect(p[12].inversiones).toBe(1000000 + 12 * 30000)
    expect(p[12].remunerada).toBe(500000 + 12 * 10000)
    expect(p[12].gastos).toBe(100000 + 12 * 10000)
    expect(p[12].aportado).toBe(12 * 50000)
    expect(p[12].fecha).toBe('2027-12-01')
  })

  it('las inversiones crecen a la rentabilidad anual y el extra se invierte', () => {
    const sinAhorro: Base = { ...b0, netoMedio: 0, aInversiones: 0, aRemunerada: 0 }
    const p = proyectar(sinAhorro, cfg, { rentabilidad: 6, extra: 0, inflacion: 0 }, 12)
    expect(Math.abs(p[12].inversiones - 1060000)).toBeLessThanOrEqual(12)
    const conExtra = proyectar(sinAhorro, cfg, { rentabilidad: 0, extra: 10000, inflacion: 0 }, 12)
    expect(conExtra[12].inversiones).toBe(1000000 + 120000)
  })

  it('la cuenta remunerada genera intereses con la TAE', () => {
    const sinAhorro: Base = { ...b0, netoMedio: 0, aInversiones: 0, aRemunerada: 0 }
    const p = proyectar(sinAhorro, { tae_cuenta_rem: [{ desde: '2020-01-01', tae: 3 }], retencion_intereses: 0 }, { rentabilidad: 0, extra: 0, inflacion: 0 }, 12)
    expect(Math.abs(p[12].remunerada - 515000)).toBeLessThanOrEqual(12)
  })

  it('en euros de hoy descuenta la inflación', () => {
    const sinAhorro: Base = { ...b0, netoMedio: 0, aInversiones: 0, aRemunerada: 0 }
    const p = proyectar(sinAhorro, cfg, { rentabilidad: 0, extra: 0, inflacion: 2 }, 12)
    expect(p[12].total).toBe(1600000)
    expect(p[12].totalReal).toBe(Math.round(1600000 / 1.02))
  })

  it('escenarios: pesimista < normal < optimista', () => {
    const e = escenarios(b0, cfg, { rentabilidad: 5, extra: 0, inflacion: 0 }, 120)
    expect(e.pesimista[120].total).toBeLessThan(e.normal[120].total)
    expect(e.normal[120].total).toBeLessThan(e.optimista[120].total)
  })

  it('base: lo de hoy y las medias de los últimos meses', () => {
    const d = datosIniciales()
    const c = calcular(d)
    const b = base(c, d)
    expect(b.desde).toBe('2026-12-01')
    expect(b.gastos + b.remunerada + b.inversiones).toBe(c.kpis.dineroTotalActual)
    expect(b.mesesMedia).toBe(2)
    expect(b.netoMedio).toBe(Math.round((c.meses[0].neto + c.meses[1].neto) / 2))
  })
})

describe('Futuro: libertad financiera', () => {
  const d = datosIniciales()
  const c = calcular(d)

  it('número = gasto anual ÷ % de retirada, y progreso', () => {
    const p = proyectar(base(c, d), d.config, { rentabilidad: 5, extra: 0, inflacion: 2 }, 600)
    const l = libertadFinanciera(c, d, p)!
    const gastoMes = Math.round((c.meses[0].gastosTotales + c.meses[1].gastosTotales) / 2)
    expect(l.gastoAnual).toBe(gastoMes * 12)
    expect(l.numero).toBe(Math.round(gastoMes * 12 / 0.04))
    expect(l.progreso).toBeCloseTo(c.kpis.dineroTotalActual / l.numero)
  })

  it('quitar conceptos que no tendrías baja el número', () => {
    const p = proyectar(base(c, d), d.config, { rentabilidad: 5, extra: 0, inflacion: 2 }, 600)
    const conceptos = conceptosRecientes(c, d)
    expect(conceptos[0].medioMes).toBeGreaterThan(0)
    const sin = { ...d, config: { ...d.config, fire_excluidos: [conceptos[0].clave] } }
    const l = libertadFinanciera(c, d, p)!
    const l2 = libertadFinanciera(c, sin, p)!
    expect(l2.excluidoAnual).toBe(conceptos[0].medioMes * 12)
    expect(l2.numero).toBeLessThan(l.numero)
    expect(conceptos[0].clave).toBe(normalizar(conceptos[0].concepto))
  })

  it('fecha de llegada: el primer mes en que el patrimonio (en euros de hoy) llega al número', () => {
    const b: Base = { ...b0, netoMedio: 100000, aInversiones: 100000, aRemunerada: 0 }
    const p = proyectar(b, cfg, { rentabilidad: 0, extra: 0, inflacion: 0 }, 600)
    const l = libertadFinanciera(c, d, p)!
    expect(l.fecha).not.toBeNull()
    const i = p.findIndex((x) => x.totalReal >= l.numero)
    expect(l.meses).toBe(i)
    expect(p[i - 1].totalReal).toBeLessThan(l.numero)
  })

  it('sin meses no hay número', () => {
    const vacio = { ...d, months: [], incomes: [], expenses: [], savings: [] }
    expect(libertadFinanciera(calcular(vacio), vacio, [])).toBeNull()
  })
})
