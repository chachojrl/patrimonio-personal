import { describe, expect, it } from 'vitest'
import { enEuros, formatMoneda, obtenerCambio, resumenViaje, textoCambio } from './viajes'
import type { GastoViaje, Viaje } from './tipos'

const viaje: Viaje = { id: 'v', nombre: 'Londres', moneda: 'GBP', cambio: 1.17, presupuesto: 90000, fecha_inicio: '2026-12-04', fecha_fin: '2026-12-07', cerrado: false }
const g = (p: Partial<GastoViaje>): GastoViaje => ({ id: Math.random().toString(), viaje_id: 'v', fecha: '2026-12-04', concepto: '', categoria: 'otros', importe: 0, moneda: 'GBP', cambio: 1.17, ...p })

describe('Modo viaje', () => {
  it('pasa a euros con el cambio de cada gasto', () => {
    expect(enEuros({ importe: 30000, cambio: 1.17 })).toBe(35100) // 300 £ → 351 €
    expect(enEuros({ importe: 1999, cambio: 1 })).toBe(1999)
  })

  it('resumen: total, categorías, días, media y lo que queda', () => {
    const r = resumenViaje(viaje, [
      g({ categoria: 'alojamiento', importe: 30000 }), // 351 €
      g({ categoria: 'comida', importe: 4000 }), // 46,80 €
      g({ categoria: 'comida', importe: 2000, moneda: 'EUR', cambio: 1 }), // 20 €
      g({ viaje_id: 'otro', importe: 99999 }), // de otro viaje: no cuenta
    ])
    expect(r.total).toBe(35100 + 4680 + 2000)
    expect(r.porCategoria).toEqual([{ id: 'alojamiento', total: 35100 }, { id: 'comida', total: 6680 }])
    expect(r.dias).toBe(4)
    expect(r.mediaDiaria).toBe(Math.round(41780 / 4))
    expect(r.queda).toBe(90000 - 41780)
    expect(r.pct).toBeCloseTo(41780 / 90000)
  })

  it('sin fechas usa del primer al último gasto; sin presupuesto no hay «queda»', () => {
    const r = resumenViaje({ ...viaje, fecha_inicio: null, fecha_fin: null, presupuesto: null }, [g({ fecha: '2026-12-10', importe: 100 }), g({ fecha: '2026-12-12', importe: 100 })])
    expect(r.dias).toBe(3)
    expect(r.queda).toBeNull()
  })

  it('tipo de cambio: euro directo, servicio y errores', async () => {
    expect(await obtenerCambio('EUR')).toBe(1)
    const ok = (async () => ({ ok: true, json: async () => ({ rates: { EUR: 1.1712 } }) })) as unknown as typeof fetch
    expect(await obtenerCambio('GBP', ok)).toBe(1.1712)
    const ko = (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch
    await expect(obtenerCambio('XXX', ko)).rejects.toThrow(/XXX/)
  })

  it('formatos', () => {
    expect(formatMoneda(1250, 'GBP')).toMatch(/12,50\s?£/)
    expect(textoCambio('GBP', 1.17)).toBe('1 GBP = 1,17 €')
  })
})
