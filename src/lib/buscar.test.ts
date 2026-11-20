import { describe, expect, it } from 'vitest'
import { buscar, conceptosGasto, normalizar } from './buscar'
import { datosIniciales, planMesNuevo, aplicarPlan } from './operaciones'
import { exportarJSON, importarJSON } from './exportar'
import { normalizarDatos, type Datos } from './tipos'

function conDiciembre(): Datos {
  const d = datosIniciales()
  const conDic = aplicarPlan(d, planMesNuevo(d, false))
  const dic = conDic.months.find((m) => m.fecha === '2026-12-01')!
  return {
    ...conDic,
    expenses: conDic.expenses.map((g) => (g.month_id === dic.id && g.concepto === 'Restaurantes' ? { ...g, importe: 3000 } : g)),
  }
}

describe('Buscador', () => {
  it('normaliza mayúsculas y tildes', () => {
    expect(normalizar('  Teléfono Móvil ')).toBe('telefono movil')
  })

  it('suma un concepto por meses y calcula el total', () => {
    const r = buscar(conDiciembre(), 'restaur', 2026)
    expect(r.gastos.grupos).toHaveLength(1)
    const g = r.gastos.grupos[0]
    expect(g.concepto).toBe('Restaurantes')
    expect(g.meses).toEqual([
      { fecha: '2026-11-01', importe: 6200 },
      { fecha: '2026-12-01', importe: 3000 },
    ])
    expect(r.gastos.total).toBe(9200)
    expect(r.gastos.meses).toBe(2)
  })

  it('no distingue tildes y agrupa varios conceptos que coinciden', () => {
    const r = buscar(datosIniciales(), 'telefono', null)
    expect(r.gastos.grupos[0].concepto).toBe('Teléfono móvil/WiFi')
    const varios = buscar(datosIniciales(), 'o', 2026) // muchos conceptos contienen "o"
    expect(varios.gastos.grupos.length).toBeGreaterThan(1)
    expect(varios.gastos.total).toBe(varios.gastos.grupos.reduce((a, g) => a + g.total, 0))
    // de mayor a menor
    expect(varios.gastos.grupos[0].total).toBeGreaterThanOrEqual(varios.gastos.grupos[1].total)
  })

  it('filtra por año y busca en ingresos', () => {
    expect(buscar(datosIniciales(), 'restaurantes', 2025).gastos.grupos).toHaveLength(0)
    const r = buscar(datosIniciales(), 'nomina', null)
    expect(r.ingresos.total).toBe(259300 + 179091)
  })

  it('encuentra deudas por persona o concepto', () => {
    const d: Datos = { ...datosIniciales(), debts: [
      { id: 'a', persona: 'Juan', concepto: 'Cena', importe: 3000, fecha: '2026-11-10', devuelto_en: null },
      { id: 'b', persona: 'Ana', concepto: 'Entradas concierto', importe: 4500, fecha: '2026-11-12', devuelto_en: '2026-11-15' },
    ] }
    expect(buscar(d, 'juan', null).deudas.map((x) => x.id)).toEqual(['a'])
    expect(buscar(d, 'concierto', null).deudas.map((x) => x.id)).toEqual(['b'])
  })

  it('texto vacío no devuelve nada', () => {
    const r = buscar(datosIniciales(), '   ', null)
    expect(r.gastos.grupos).toHaveLength(0)
    expect(r.deudas).toHaveLength(0)
  })

  it('sugerencias: conceptos con importe, los más recientes primero', () => {
    const s = conceptosGasto(datosIniciales())
    expect(s).toContain('Restaurantes')
    expect(s).not.toContain('Gas') // siempre a 0
    expect(s.indexOf('Golf')).toBeLessThan(s.indexOf('Pendiente de desglosar')) // noviembre antes que octubre
  })
})

describe('Te deben', () => {
  it('datos antiguos sin deudas se completan con una lista vacía', () => {
    const { debts: _omitida, ...antiguo } = datosIniciales()
    expect(normalizarDatos(antiguo as Datos).debts).toEqual([])
  })

  it('la copia JSON conserva las deudas y sus importes', () => {
    const d: Datos = { ...datosIniciales(), debts: [{ id: 'a', persona: 'Juan', concepto: 'Cena', importe: 3050, fecha: '2026-11-10', devuelto_en: null }] }
    const r = importarJSON(exportarJSON(d))
    expect(r.debts).toEqual(d.debts)
  })
})

describe('Cuenta compartida', () => {
  it('crear mes nuevo no copia las aportaciones automáticas (las recrea el servidor)', () => {
    const d = datosIniciales()
    const nov = d.months.find((m) => m.fecha === '2026-11-01')!
    d.incomes.push({ id: 'ap-i', month_id: nov.id, concepto: 'Aportación Ana', importe: 15000, orden: 9, aportacion_de: 'u-ana' })
    d.expenses.push({ id: 'ap-g', month_id: nov.id, concepto: 'Aportación Casa', importe: 21000, orden: 99, fijo: false, presupuesto: null, fecha_vencimiento: null, aportacion_cuenta: 'c-casa' })
    const plan = planMesNuevo(d, false)
    expect(plan.incomes.map((x) => x.concepto)).not.toContain('Aportación Ana')
    expect(plan.expenses.map((x) => x.concepto)).not.toContain('Aportación Casa')
    expect(plan.expenses.map((x) => x.concepto)).toContain('Restaurantes')
  })
})
