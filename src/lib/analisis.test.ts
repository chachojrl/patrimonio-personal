import { describe, expect, it } from 'vitest'
import { calcular } from './calculos'
import { colchon, gastosRaros, reparto503020, repartoCompartida } from './analisis'
import { aplicarPlan, datosIniciales, planMesNuevo } from './operaciones'
import type { Datos, Gasto } from './tipos'

describe('Colchón de emergencia', () => {
  it('saldo + cuenta remunerada entre la media de gastos', () => {
    const d = datosIniciales()
    const c = calcular(d)
    const r = colchon(c)
    expect(r.liquido).toBe(70932 + 1248875) // saldo de noviembre + cuenta remunerada
    expect(r.gastoMedio).toBe(Math.round((42855 + 25387) / 2))
    expect(r.mesesUsados).toBe(2)
    expect(r.meses).toBeCloseTo(r.liquido / r.gastoMedio)
    expect(r.nivel).toBe('bueno')
  })
  it('sin gastos no se puede calcular', () => {
    const d = datosIniciales()
    d.expenses = d.expenses.map((g) => ({ ...g, importe: 0 }))
    expect(colchon(calcular(d)).meses).toBeNull()
  })
})

describe('Necesidades / caprichos / ahorro', () => {
  it('reparte según la clasificación y lista lo pendiente', () => {
    const d = datosIniciales()
    d.config.clasificacion = { 'telefono movil/wifi': 'necesidad', supermercado: 'necesidad', restaurantes: 'capricho', golf: 'capricho' }
    const nov = d.months.find((m) => m.fecha === '2026-11-01')!
    const r = reparto503020(d, calcular(d), nov.id)!
    expect(r.necesidades).toBe(4788 + 540)
    expect(r.caprichos).toBe(6200 + 2500)
    expect(r.sinClasificar).toBe(25387 - 4788 - 540 - 6200 - 2500)
    expect(r.ahorro).toBe(119900)
    expect(r.pendientes).toEqual(expect.arrayContaining(['Comida oficina', 'Otros', 'Entretenimiento']))
    expect(r.pct!.ahorro).toBeCloseTo(119900 / 182570)
  })
  it('la aportación a la cuenta compartida cuenta como necesidad', () => {
    const d = datosIniciales()
    const nov = d.months.find((m) => m.fecha === '2026-11-01')!
    d.expenses.push({ id: 'ap', month_id: nov.id, concepto: 'Aportación Casa', importe: 20000, orden: 99, fijo: false, presupuesto: null, fecha_vencimiento: null, aportacion_cuenta: 'c' })
    expect(reparto503020(d, calcular(d), nov.id)!.necesidades).toBe(20000)
  })
})

describe('Gastos raros', () => {
  function conMeses(n: number): Datos {
    let d = datosIniciales()
    for (let i = 0; i < n; i++) d = aplicarPlan(d, planMesNuevo(d, false))
    return d
  }
  it('avisa si un concepto va muy por encima de su media (con al menos 3 meses de historia)', () => {
    let d = conMeses(3) // oct, nov, dic, ene, feb
    const meses = [...d.months].sort((a, b) => a.fecha.localeCompare(b.fecha))
    const poner = (i: number, imp: number) => {
      d = { ...d, expenses: d.expenses.map((g) => (g.month_id === meses[i].id && g.concepto === 'Restaurantes' ? { ...g, importe: imp } : g)) }
    }
    poner(1, 6000); poner(2, 5000); poner(3, 7000); poner(4, 20000)
    const avisos = gastosRaros(d, meses[4].id)
    expect(avisos).toEqual([expect.objectContaining({ tipo: 'por-encima', concepto: 'Restaurantes', importe: 20000, media: 6000 })])
    poner(4, 14000) // 2,3 veces: no avisa
    expect(gastosRaros(d, meses[4].id)).toEqual([])
  })
  it('avisa de dos apuntes iguales seguidos', () => {
    const d = datosIniciales()
    const nov = d.months.find((m) => m.fecha === '2026-11-01')!
    const g = d.expenses.find((x) => x.month_id === nov.id && x.concepto === 'Supermercado') as Gasto
    d.expense_entries.push(
      { id: 'a', expense_id: g.id, importe: 4788, creado_en: '2026-11-10T10:00:00Z', nota: null },
      { id: 'b', expense_id: g.id, importe: 4788, creado_en: '2026-11-10T10:02:00Z', nota: null },
      { id: 'c', expense_id: g.id, importe: 4788, creado_en: '2026-11-20T10:00:00Z', nota: null }, // días después: no
    )
    expect(gastosRaros(d, nov.id)).toEqual([expect.objectContaining({ tipo: 'duplicado', concepto: 'Supermercado', importe: 4788 })])
  })
})

describe('Reparto por concepto (cuenta compartida)', () => {
  it('cada uno pone, además de su aportación, su mitad y sus gastos propios', () => {
    const d = datosIniciales()
    const nov = d.months.find((m) => m.fecha === '2026-11-01')!
    const gasto = (id: string, importe: number, reparto: string | null): Gasto => ({ id, month_id: nov.id, concepto: id, importe, orden: 0, fijo: false, presupuesto: null, fecha_vencimiento: null, reparto })
    d.expenses = [gasto('luz', 5000, null), gasto('cena', 6001, 'mitad'), gasto('gym', 4000, 'u:ana')]
    d.incomes = [
      { id: 'i1', month_id: nov.id, concepto: 'Aportación Rodrigo', importe: 21000, orden: 0, aportacion_de: 'rod' },
      { id: 'i2', month_id: nov.id, concepto: 'Aportación Ana', importe: 15000, orden: 1, aportacion_de: 'ana' },
    ]
    const r = repartoCompartida(d, nov.id, ['rod', 'ana'])
    expect(r.proporcional).toBe(5000)
    expect(r.aMedias).toBe(6001)
    expect(r.miembros).toEqual([
      { user_id: 'rod', aportacion: 21000, aMedias: 3001, propios: 0, extra: 3001 },
      { user_id: 'ana', aportacion: 15000, aMedias: 3000, propios: 4000, extra: 7000 },
    ])
  })
})
