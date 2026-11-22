import { describe, expect, it } from 'vitest'
import { calcular } from './calculos'
import { datosIniciales } from './operaciones'
import { dineroLibre, estadoHucha, problemaAlMeter, propuestasCierre } from './huchas'
import type { Datos, Hucha, MovimientoHucha } from './tipos'

const hucha = (h: Partial<Hucha> = {}): Hucha => ({
  id: 'h1', nombre: 'Japón', emoji: '🗾', objetivo: 300000, fecha_objetivo: null, aportacion_mensual: null, cuenta: null, orden: 0, conseguida_en: null, ...h,
})
const mov = (importe: number, m: Partial<MovimientoHucha> = {}): MovimientoHucha => ({
  id: `m${Math.random()}`, hucha_id: 'h1', fecha: '2026-11-10', importe, nota: null, mes: null, ...m,
})

describe('Huchas: estado', () => {
  it('saldo, lo que falta y el porcentaje', () => {
    const e = estadoHucha(hucha(), [mov(150000), mov(-20000), mov(5000, { hucha_id: 'otra' })], '2026-11-01')
    expect(e.saldo).toBe(130000)
    expect(e.falta).toBe(170000)
    expect(e.pct).toBeCloseTo(130000 / 300000)
    expect(e.llena).toBe(false)
    expect(e.movimientos).toHaveLength(2)
  })

  it('llena cuando llega al objetivo', () => {
    const e = estadoHucha(hucha(), [mov(300000)], '2026-11-01')
    expect(e.llena).toBe(true)
    expect(e.falta).toBe(0)
    expect(e.mesEstimado).toBeNull()
  })

  it('fecha estimada con la aportación mensual (este mes cuenta si aún no se ha metido)', () => {
    // Faltan 1.700 €; con 200 €/mes son 9 meses: de noviembre de 2026 a julio de 2027
    const h = hucha({ aportacion_mensual: 20000 })
    expect(estadoHucha(h, [mov(130000)], '2026-11-01').mesEstimado).toBe('2027-07-01')
    // Si la de noviembre ya está metida, empieza a contar en diciembre
    expect(estadoHucha(h, [mov(110000), mov(20000, { mes: '2026-11-01' })], '2026-11-01').mesEstimado).toBe('2027-08-01')
  })

  it('con fecha límite: cuánto hay que meter al mes y si se llega', () => {
    // Faltan 1.700 € y la fecha es marzo de 2027: nov, dic, ene, feb, mar = 5 meses → 340 €/mes
    const h = hucha({ fecha_objetivo: '2027-03-15', aportacion_mensual: 20000 })
    const e = estadoHucha(h, [mov(130000)], '2026-11-01')
    expect(e.mesesHastaLimite).toBe(5)
    expect(e.necesarioAlMes).toBe(34000)
    expect(e.noLlega).toBe(true)
    expect(estadoHucha({ ...h, aportacion_mensual: 34000 }, [mov(130000)], '2026-11-01').noLlega).toBe(false)
    // Sin aportación mensual tampoco se llega
    expect(estadoHucha({ ...h, aportacion_mensual: null }, [mov(130000)], '2026-11-01').noLlega).toBe(true)
    // Fecha ya pasada: lo que falta, de golpe
    expect(estadoHucha(h, [mov(130000)], '2027-06-01').necesarioAlMes).toBe(170000)
  })
})

describe('Huchas: dinero libre', () => {
  // datosIniciales: noviembre deja 709,32 € disponibles, 12.488,75 € en la remunerada y 17.602,00 € en inversiones
  const base = (): Datos => datosIniciales()

  it('las huchas reservan dinero sin cambiar el total', () => {
    const d = base()
    d.huchas = [hucha({ cuenta: 'remunerada' }), hucha({ id: 'h2', cuenta: null })]
    d.hucha_movimientos = [mov(100000), mov(5000, { hucha_id: 'h2' })]
    const c = calcular(d)
    const l = dineroLibre(c, d)
    expect(l.total).toBe(c.kpis.dineroTotalActual)
    expect(l.reservado).toBe(105000)
    expect(l.libre).toBe(c.kpis.dineroTotalActual - 105000)
    expect(l.porCuenta.remunerada).toEqual({ hay: 1248875, reservado: 100000, libre: 1148875 })
    expect(l.sinCuenta).toBe(5000)
  })

  it('no deja reservar más de lo que hay (en total o en la cuenta de la hucha)', () => {
    const d = base()
    const h = hucha({ cuenta: 'gastos' })
    d.huchas = [h]
    const c = calcular(d)
    expect(problemaAlMeter(c, d, h, 70000)).toBeNull()
    expect(problemaAlMeter(c, d, h, 80000)).toMatch(/cuenta de gastos solo quedan 709,32 €/)
    const sinCuenta = { ...h, cuenta: null }
    expect(problemaAlMeter(c, d, sinCuenta, 80000)).toBeNull()
    expect(problemaAlMeter(c, d, sinCuenta, c.kpis.dineroTotalActual + 1)).toMatch(/Solo tienes/)
    // Sacar siempre se puede
    expect(problemaAlMeter(c, d, h, -99999999)).toBeNull()
  })
})

describe('Huchas: propuestas al cerrar el mes', () => {
  it('propone la aportación mensual de las huchas que no la tienen ese mes, sin pasarse del objetivo', () => {
    const d = { huchas: [
      hucha({ aportacion_mensual: 20000 }),
      hucha({ id: 'h2', aportacion_mensual: 50000, objetivo: 60000 }),
      hucha({ id: 'h3', aportacion_mensual: 10000 }),
      hucha({ id: 'h4', aportacion_mensual: null }),
      hucha({ id: 'h5', aportacion_mensual: 10000, conseguida_en: '2026-10-01' }),
    ], hucha_movimientos: [
      mov(30000, { hucha_id: 'h2' }),
      mov(10000, { hucha_id: 'h3', mes: '2026-11-01' }),
    ] }
    const p = propuestasCierre(d, '2026-11-01', '2026-11-01')
    expect(p.map((x) => [x.hucha.id, x.importe])).toEqual([['h1', 20000], ['h2', 30000]])
  })
})
