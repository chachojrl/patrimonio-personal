import { describe, expect, it } from 'vitest'
import { calcular } from './calculos'
import { aplicarPlan, datosIniciales, planMesNuevo } from './operaciones'
import { logros, nuevosLogros, racha, rachas } from './logros'
import type { Datos } from './tipos'

/** Datos con n meses más después de noviembre de 2026, todos cerrados salvo el último, con ahorro «ahorro(i)». */
function conMeses(n: number, ahorro: (i: number) => number, ingreso = 200000): Datos {
  let d = datosIniciales()
  for (let i = 0; i < n; i++) d = aplicarPlan(d, planMesNuevo(d, true))
  const nuevos = d.months.filter((m) => m.fecha > '2026-11-01').sort((a, b) => a.fecha.localeCompare(b.fecha))
  nuevos.forEach((m, i) => {
    d.incomes.push({ id: `i${i}`, month_id: m.id, concepto: 'Nomina', importe: ingreso, orden: 99 })
    const a = ahorro(i)
    if (a > 0) d.savings.push({ id: `s${i}`, month_id: m.id, fecha: m.fecha, importe: a, tipo: 'Inversiones', origen: 'Ingresos mensuales' })
  })
  d.months = d.months.map((m) => ({ ...m, estado: m.fecha === nuevos.at(-1)?.fecha ? 'Abierto' : 'Cerrado' }))
  return d
}

describe('Rachas', () => {
  it('cuenta meses seguidos ahorrando; un mes sin ahorro la rompe', () => {
    // octubre y noviembre (datos iniciales) ahorran; luego 3 sí, 1 no, 2 sí
    const d = conMeses(6, (i) => (i === 3 ? 0 : 10000))
    const r = rachas(calcular(d), d).find((x) => x.id === 'ahorro')!
    expect(r.mejor).toBe(5)
    expect(r.actual).toBe(2)
  })

  it('el mes en curso sin ahorro todavía no rompe la racha', () => {
    const d = conMeses(3, (i) => (i === 2 ? 0 : 10000))
    const r = rachas(calcular(d), d).find((x) => x.id === 'ahorro')!
    expect(r.actual).toBe(4) // oct, nov, dic, ene; febrero está abierto y aún sin ahorro
  })

  it('presupuesto: pasarse rompe la racha aunque el mes siga abierto', () => {
    const d = conMeses(2, () => 10000)
    const meses = d.months.filter((m) => m.fecha > '2026-11-01')
    for (const m of meses) {
      const g = d.expenses.find((x) => x.month_id === m.id)!
      g.presupuesto = 10000
      g.importe = 5000
    }
    const c = calcular(d)
    expect(racha(c, d, (m) => (meses.some((x) => x.id === m.mes.id) ? true : null)).actual).toBe(2)
    expect(rachas(c, d).find((x) => x.id === 'presupuesto')!.actual).toBe(1) // el abierto aún no suma
    d.expenses.find((x) => x.month_id === meses[1].id)!.importe = 20000
    expect(rachas(calcular(d), d).find((x) => x.id === 'presupuesto')!.actual).toBe(0)
  })
})

describe('Logros', () => {
  it('se consiguen con fecha y los pendientes tienen progreso', () => {
    const d = conMeses(3, () => 10000) // octubre … febrero: 5 meses ahorrando
    const l = logros(calcular(d), d)
    const por = (id: string) => l.find((x) => x.id === id)!
    expect(por('primer-mes').conseguido).toBe('2026-10-01')
    // Ahorro: oct, nov, dic → 3 seguidos en diciembre
    expect(por('ahorro-3').conseguido).toBe('2026-12-01')
    expect(por('ahorro-6').conseguido).toBeNull()
    expect(por('ahorro-6').progreso).toBeCloseTo(5 / 6)
    expect(por('ahorro-6').textoProgreso).toBe('5 de 6 meses seguidos')
    expect(por('un-anio').progreso).toBeCloseTo(5 / 12)
    // Patrimonio: 10k y 25k conseguidos (unos 30.800 €), el siguiente (50k) pendiente y no se enseñan más
    expect(por('patrimonio-10000').conseguido).not.toBeNull()
    expect(por('patrimonio-50000').conseguido).toBeNull()
    expect(l.find((x) => x.id === 'patrimonio-100000')).toBeUndefined()
    expect(por('patrimonio-1000000')).toBeUndefined()
  })

  it('hucha conseguida', () => {
    const d = conMeses(1, () => 0)
    d.huchas = [{ id: 'h', nombre: 'X', emoji: 'hucha', objetivo: 10000, fecha_objetivo: null, aportacion_mensual: null, cuenta: null, orden: 0, conseguida_en: null }]
    d.hucha_movimientos = [{ id: 'm', hucha_id: 'h', fecha: '2026-11-01', importe: 5000, nota: null, mes: null }]
    expect(logros(calcular(d), d).find((x) => x.id === 'hucha')!.progreso).toBeCloseTo(0.5)
    d.huchas[0].conseguida_en = '2026-11-20'
    expect(logros(calcular(d), d).find((x) => x.id === 'hucha')!.conseguido).toBe('2026-11-20')
  })

  it('nuevos: solo los conseguidos no vistos, y nada la primera vez', () => {
    const d = conMeses(4, () => 10000)
    const l = logros(calcular(d), d)
    expect(nuevosLogros(l, null)).toEqual([])
    const conseguidos = l.filter((x) => x.conseguido).map((x) => x.id)
    expect(nuevosLogros(l, conseguidos)).toEqual([])
    expect(nuevosLogros(l, conseguidos.filter((x) => x !== 'ahorro-3')).map((x) => x.id)).toEqual(['ahorro-3'])
  })
})
