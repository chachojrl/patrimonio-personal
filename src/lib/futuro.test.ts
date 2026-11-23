import { describe, expect, it } from 'vitest'
import { calcular } from './calculos'
import { datosIniciales } from './operaciones'
import {
  base, brutoParaNeto, conceptosRecientes, costeFuturo, edadEn, escenarios, impuestoAhorro, libertadFinanciera, llegadaPercentil, probabilidadAntesDe,
  proyectar, simular, sobranteMes, type Base, type EventoFuturo,
} from './futuro'
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

const sinAhorro: Base = { ...b0, netoMedio: 0, aInversiones: 0, aRemunerada: 0 }
const p0 = { rentabilidad: 0, extra: 0, inflacion: 0 }
const ev = (e: Partial<EventoFuturo> & Pick<EventoFuturo, 'tipo' | 'importe' | 'desde'>): EventoFuturo => ({ id: e.tipo, nombre: e.tipo, hasta: null, ...e })

describe('Futuro: proyección más realista', () => {
  it('el ahorro sube cada año con el crecimiento', () => {
    const b: Base = { ...b0, netoMedio: 120000, aInversiones: 120000, aRemunerada: 0 }
    const p = proyectar(b, cfg, { ...p0, crecimiento: 10 }, 24)
    // Primer año: 1.200 € al mes; el segundo, un 10 % más (mes a mes, con la subida repartida)
    const primerAnio = p[12].inversiones - p[0].inversiones
    const segundoAnio = p[24].inversiones - p[12].inversiones
    expect(primerAnio).toBeGreaterThan(12 * 120000)
    expect(segundoAnio / primerAnio).toBeCloseTo(1.1, 2)
  })

  it('las comisiones se restan de la rentabilidad', () => {
    const p = proyectar(sinAhorro, cfg, { ...p0, rentabilidad: 6, comision: 1 }, 12)
    expect(Math.abs(p[12].inversiones - 1050000)).toBeLessThanOrEqual(12)
  })

  it('impuestos: tramos del IRPF del ahorro', () => {
    expect(impuestoAhorro(0)).toBe(0)
    expect(impuestoAhorro(-5000)).toBe(0)
    expect(impuestoAhorro(600000)).toBe(114000) // 6.000 € al 19 %
    expect(impuestoAhorro(1000000)).toBe(114000 + 84000) // + 4.000 € al 21 %
    expect(impuestoAhorro(40000000)).toBe(114000 + 924000 + 3450000 + 2700000 + 3000000)
  })

  it('cada punto sabe lo aportado a inversiones y los impuestos si vendieras', () => {
    const b: Base = { ...sinAhorro, inversiones: 1000000, costeInversiones: 800000 }
    const p = proyectar(b, cfg, { ...p0, extra: 10000 }, 12)
    expect(p[0].impuestos).toBe(impuestoAhorro(200000))
    expect(p[12].costeInversiones).toBe(800000 + 120000)
    expect(p[12].impuestos).toBe(impuestoAhorro(200000))
  })

  it('invertir lo que sobra lo mueve de la cuenta de gastos a inversiones', () => {
    expect(sobranteMes(b0)).toBe(10000)
    const p = proyectar(b0, cfg, { ...p0, invertirSobrante: true }, 12)
    expect(p[12].gastos).toBe(b0.gastos)
    expect(p[12].inversiones).toBe(1000000 + 12 * 40000)
    expect(p[12].total).toBe(1600000 + 12 * 50000)
  })
})

describe('Futuro: tus planes', () => {
  it('un gasto puntual sale de la cuenta de gastos, luego de la remunerada y luego de inversiones', () => {
    const p = proyectar(sinAhorro, cfg, { ...p0, eventos: [ev({ tipo: 'gasto_unico', importe: 700000, desde: '2027-02-01' })] }, 6)
    expect(p[2].total).toBe(1600000) // aún no ha pasado (el punto 2 es el final de enero)
    expect(p[3].gastos).toBe(0)
    expect(p[3].remunerada).toBe(0)
    expect(p[3].inversiones).toBe(1000000 - 100000)
    expect(p[3].costeInversiones).toBe(900000) // vende una parte proporcional de lo aportado
    expect(p[3].aportado).toBe(-700000)
  })

  it('los cambios mensuales cuentan entre «desde» y «hasta», actualizados con la inflación', () => {
    const e = ev({ tipo: 'gasto_fin', importe: 10000, desde: '2027-01-01', hasta: '2027-03-01' })
    const p = proyectar(sinAhorro, cfg, { ...p0, eventos: [e] }, 6)
    expect(p[6].gastos - p[0].gastos).toBe(3 * 10000)
    const conInf = proyectar(sinAhorro, cfg, { ...p0, inflacion: 12, eventos: [ev({ tipo: 'pension', importe: 10000, desde: '2027-12-01' })] }, 13)
    expect(conInf[13].gastos - conInf[12].gastos).toBe(11200)
    const baja = proyectar(sinAhorro, cfg, { ...p0, eventos: [ev({ tipo: 'sueldo', importe: -5000, desde: '2026-12-01' })] }, 2)
    expect(baja[2].gastos - baja[0].gastos).toBe(-10000)
  })

  it('libertad financiera: la pensión y el fin de un gasto bajan lo que necesitas desde esa fecha', () => {
    const d = datosIniciales()
    const c = calcular(d)
    const b = base(c, d)
    const plan = [ev({ tipo: 'pension', importe: 50000, desde: '2028-01-01' })]
    const sin = libertadFinanciera(c, d, proyectar(b, d.config, { ...p0, rentabilidad: 5 }, 600))!
    const con = libertadFinanciera(c, d, proyectar(b, d.config, { ...p0, rentabilidad: 5, eventos: plan }, 600), { eventos: plan })!
    expect(con.numero).toBe(sin.numero) // hoy, igual
    expect(con.meses!).toBeLessThan(sin.meses!)
    expect(con.numeroLlegada).not.toBeNull()
    expect(con.numeroLlegada!).toBeLessThan(sin.numero)
  })

  it('libertad financiera con impuestos: hay que sacar más para que quede lo mismo', () => {
    expect(brutoParaNeto(0, 0.5)).toBe(0)
    expect(brutoParaNeto(100000, 0)).toBe(100000)
    const bruto = brutoParaNeto(3000000, 0.5)
    expect(bruto - impuestoAhorro(Math.round(bruto * 0.5))).toBeGreaterThanOrEqual(3000000)
    expect(bruto - 1 - impuestoAhorro(Math.round((bruto - 1) * 0.5))).toBeLessThan(3000000)
    const d = datosIniciales()
    const c = calcular(d)
    const b = base(c, d)
    const p = proyectar(b, d.config, { ...p0, rentabilidad: 5 }, 600)
    const sin = libertadFinanciera(c, d, p)!
    const con = libertadFinanciera(c, d, p, { impuestos: true })!
    expect(con.numero).toBeGreaterThan(sin.numero)
    expect(con.impuestosAnual).toBeGreaterThan(0)
    expect(sin.impuestosAnual).toBe(0)
  })

  it('edad por años', () => {
    expect(edadEn({ anio_nacimiento: 1990 }, '2036-11-01')).toBe(46)
    expect(edadEn({ anio_nacimiento: null }, '2036-11-01')).toBeNull()
  })
})

describe('Futuro: simulación con altibajos', () => {
  const b: Base = { ...b0, netoMedio: 50000, aInversiones: 50000, aRemunerada: 0 }
  const p = { rentabilidad: 6, extra: 0, inflacion: 2 }

  it('sin altibajos todas las simulaciones son la proyección normal', () => {
    const s = simular(b, cfg, p, 120, { volatilidad: 0, n: 20 })
    const n = proyectar(b, cfg, p, 120)
    expect(Math.abs(s.p10[120] - n[120].total)).toBeLessThanOrEqual(120)
    expect(Math.abs(s.p90[120] - n[120].total)).toBeLessThanOrEqual(120)
  })

  it('con altibajos hay una banda alrededor de la normal, y siempre sale lo mismo', () => {
    const s = simular(b, cfg, p, 240, { volatilidad: 15, n: 400 })
    const n = proyectar(b, cfg, p, 240)
    expect(s.p10[240]).toBeLessThan(n[240].total)
    expect(s.p90[240]).toBeGreaterThan(n[240].total)
    expect(Math.abs(s.p50[240] - n[240].total) / n[240].total).toBeLessThan(0.08)
    expect(s.p10Real[240]).toBeLessThan(s.p10[240])
    expect(simular(b, cfg, p, 240, { volatilidad: 15, n: 400 }).p10[240]).toBe(s.p10[240])
  })

  it('cuándo llega cada simulación a una meta', () => {
    const meta = 3000000
    const s = simular(b, cfg, p, 600, { volatilidad: 15, n: 200, meta: (pt) => pt.totalReal >= meta })
    const mitad = llegadaPercentil(s, 0.5)!
    const casiTodas = llegadaPercentil(s, 0.9)!
    expect(mitad).toBeLessThanOrEqual(casiTodas)
    expect(probabilidadAntesDe(s, mitad)).toBeGreaterThanOrEqual(0.5)
    expect(probabilidadAntesDe(s, 0)).toBe(0)
  })
})

describe('Futuro: lo que cuesta una compra', () => {
  const d = datosIniciales()
  const c = calcular(d)

  it('invertido crecería, y retrasa la libertad financiera', () => {
    const f = costeFuturo(c, d, { pagoAhora: 2000000 })
    expect(f.en10).toBeGreaterThan(2000000)
    expect(f.en20).toBeGreaterThan(f.en10)
    expect(f.retraso).not.toBeNull()
    expect(f.retraso!).toBeGreaterThan(0)
    expect(costeFuturo(c, d, { pagoAhora: 0 }).retraso).toBe(0)
  })

  it('a plazos cuenta la entrada y las cuotas', () => {
    const contado = costeFuturo(c, d, { pagoAhora: 1200000 })
    const plazos = costeFuturo(c, d, { pagoAhora: 0, cuota: 100000, plazos: 12 })
    expect(plazos.en10).toBe(contado.en10)
    expect(plazos.retraso!).toBeGreaterThan(0)
  })
})

describe('Futuro: lo que inviertes al mes', () => {
  const d = datosIniciales()
  const c = calcular(d)

  it('nunca es negativo ni, con la remunerada, más de lo que ahorras', () => {
    const b = base(c, d)
    expect(b.aInversiones).toBeGreaterThanOrEqual(0)
    expect(b.aRemunerada).toBeGreaterThanOrEqual(0)
    expect(b.aInversiones + b.aRemunerada).toBeLessThanOrEqual(Math.max(0, b.netoMedio))
    expect(b.inversionManual).toBe(false)
  })

  it('un traspaso puntual de la remunerada a la cuenta de gastos para invertir no se repite cada mes', () => {
    const conTraspaso = { ...d, savings: [...d.savings,
      { id: 't1', month_id: d.months[1].id, fecha: null, importe: 800000, tipo: 'Cuenta de gastos' as const, origen: 'Cuenta remunerada' as const },
      { id: 't2', month_id: d.months[1].id, fecha: null, importe: 800000, tipo: 'Inversiones' as const, origen: 'Ingresos mensuales' as const },
    ] }
    const b = base(calcular(conTraspaso), conTraspaso)
    expect(b.aRemunerada).toBeGreaterThanOrEqual(0)
    expect(b.aInversiones + b.aRemunerada).toBeLessThanOrEqual(Math.max(0, b.netoMedio))
    const p = proyectar(b, conTraspaso.config, { rentabilidad: 0, extra: 0, inflacion: 0 }, 120)
    expect(p.every((x) => x.remunerada >= 0)).toBe(true)
  })

  it('si lo escribes tú, se usa esa cantidad', () => {
    const manual = { ...d, config: { ...d.config, inversion_mensual: 120000 } }
    const b = base(c, manual)
    expect(b.aInversiones).toBe(120000)
    expect(b.inversionManual).toBe(true)
  })

  it('«Cambias lo que inviertes» cambia la aportación desde su fecha (lo que deja de invertirse se queda en la cuenta de gastos)', () => {
    const b: Base = { ...b0, netoMedio: 150000, aInversiones: 120000, aRemunerada: 0 }
    const plan = [ev({ tipo: 'inversion', importe: 50000, desde: '2027-12-01' })]
    const p = proyectar(b, cfg, { ...p0, eventos: plan }, 24)
    expect(p[12].inversiones - p[11].inversiones).toBe(120000)
    expect(p[13].inversiones - p[12].inversiones).toBe(50000)
    expect(p[13].gastos - p[12].gastos).toBe(100000)
    expect(p[24].total - p[0].total).toBe(24 * 150000) // ahorras lo mismo, solo cambia dónde va
  })
})
