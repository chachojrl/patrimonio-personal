import { describe, expect, it } from 'vitest'
import { calcular } from './calculos'
import { datosIniciales } from './operaciones'
import { datosInforme, escalaBonita, textoPdf } from './informe'
import { nombreArchivoInforme } from './informePdf'

describe('Informe PDF: datos', () => {
  const d = datosIniciales()
  const c = calcular(d)
  const inf = datosInforme(d, c, { cuenta: 'Mi cuenta', compartida: false, titular: '  Rodrigo ', generado: new Date('2026-11-20T10:00:00Z') })

  it('periodo, titular y totales coinciden con los cálculos de la app', () => {
    expect(inf.titular).toBe('Rodrigo')
    expect(inf.desde).toBe('2026-10-01')
    expect(inf.hasta).toBe('2026-11-01')
    expect(inf.kpis.dineroTotal).toBe(3080007)
    expect(inf.kpis.ingresos).toBe(259300 + 182570)
    expect(inf.kpis.gastos).toBe(42855 + 25387)
    expect(inf.kpis.ahorroDesdeIngresos).toBe(150000 + 119900)
    expect(inf.kpis.variacion).toBe(3080007 - 2749679)
  })

  it('gastos por concepto: suman el total y van de mayor a menor', () => {
    const total = inf.gastosPorConcepto.reduce((a, g) => a + g.total, 0)
    expect(total).toBe(inf.kpis.gastos)
    const valores = inf.gastosPorConcepto.map((g) => g.total)
    expect(valores).toEqual([...valores].sort((a, b) => b - a))
    expect(inf.gastosPorConcepto.every((g) => g.total !== 0)).toBe(true)
  })

  it('agrupa conceptos sin distinguir mayúsculas ni tildes', () => {
    const d2 = datosIniciales()
    const [m1, m2] = d2.months
    d2.expenses.push({ id: 'a', month_id: m1.id, concepto: 'Peluquería', importe: 1000, orden: 99, fijo: false, presupuesto: null, fecha_vencimiento: null })
    d2.expenses.push({ id: 'b', month_id: m2.id, concepto: 'peluqueria', importe: 1500, orden: 99, fijo: false, presupuesto: null, fecha_vencimiento: null })
    const g = datosInforme(d2, calcular(d2), { cuenta: 'x', compartida: false }).gastosPorConcepto.find((x) => x.concepto === 'Peluquería')
    expect(g).toEqual({ concepto: 'Peluquería', total: 2500, meses: 2 })
  })

  it('el ajuste negativo del saldo real aparece como gasto no apuntado', () => {
    const d2 = datosIniciales()
    const nov = d2.months.find((m) => m.fecha === '2026-11-01')!
    nov.saldo_real_cuenta = 70932 - 5000
    const inf2 = datosInforme(d2, calcular(d2), { cuenta: 'x', compartida: false })
    expect(inf2.gastosPorConcepto.find((g) => g.concepto.startsWith('Gastos no apuntados'))?.total).toBe(5000)
    expect(inf2.gastosPorConcepto.reduce((a, g) => a + g.total, 0)).toBe(inf2.kpis.gastos)
  })

  it('sin meses no falla', () => {
    const d2 = datosIniciales()
    d2.months = []; d2.incomes = []; d2.expenses = []; d2.savings = []; d2.expense_entries = []
    const inf2 = datosInforme(d2, calcular(d2), { cuenta: 'x', compartida: false })
    expect(inf2.meses).toEqual([])
    expect(inf2.desde).toBeNull()
    expect(inf2.destacados).toEqual([])
  })
})

describe('Informe PDF: utilidades', () => {
  it('escalaBonita incluye el 0 y usa pasos redondos', () => {
    expect(escalaBonita(0, 4300)).toEqual({ min: 0, max: 5000, paso: 1000 })
    const e = escalaBonita(-1200, 3100)
    expect(e.min).toBeLessThanOrEqual(-1200)
    expect(e.max).toBeGreaterThanOrEqual(3100)
    expect(e.min % e.paso).toBeCloseTo(0)
    expect(escalaBonita(0, 0).max).toBeGreaterThan(0)
  })

  it('textoPdf cambia o quita lo que no existe en las fuentes del PDF', () => {
    expect(textoPdf('−1.234,56 €')).toBe('-1.234,56 €')
    expect(textoPdf('Cena 🎂 cumpleaños')).toBe('Cena cumpleaños')
    expect(textoPdf('Ahorro → Inversiones')).toBe('Ahorro -> Inversiones')
    expect(textoPdf('Octubre – Noviembre · ½')).toBe('Octubre – Noviembre · ½')
  })

  it('nombre del archivo sin tildes ni espacios', () => {
    expect(nombreArchivoInforme('Ana López', new Date('2026-11-20T10:00:00Z'))).toBe('informe-ana-lopez-2026-11-20.pdf')
    expect(nombreArchivoInforme('Cuenta común 🏠', new Date('2026-11-20T10:00:00Z'))).toBe('informe-cuenta-comun-2026-11-20.pdf')
  })
})

describe('Informe PDF: periodo', () => {
  const d = datosIniciales()
  const c = calcular(d)
  const [oct, nov] = c.meses

  it('de mes a mes: solo entran esos meses y las cifras son las del final del periodo', () => {
    const inf = datosInforme(d, c, { cuenta: 'x', compartida: false, periodo: { desde: '2026-11-01', hasta: '2026-11-01' } })
    expect(inf.meses.map((m) => m.mes.fecha)).toEqual(['2026-11-01'])
    expect(inf.kpis.ingresos).toBe(nov.ingresosTotales)
    expect(inf.kpis.gastos).toBe(nov.gastosTotales)
    expect(inf.kpis.dineroTotal).toBe(nov.dineroTotal)
    expect(inf.kpis.variacion).toBe(nov.dineroTotal - oct.dineroTotal)
    expect(inf.gastosPorConcepto.reduce((a, g) => a + g.total, 0)).toBe(nov.gastosTotales)
    expect(inf.anios.map((a) => a.total.ingresos)).toEqual([nov.ingresosTotales])
    expect(inf.periodo).toBe('noviembre 2026 – noviembre 2026')
  })

  it('un año entero, y un periodo sin meses', () => {
    const anio = datosInforme(d, c, { cuenta: 'x', compartida: false, periodo: { desde: '2026-01-01', hasta: '2026-12-01' } })
    expect(anio.periodo).toBe('Año 2026')
    expect(anio.kpis.ingresos).toBe(oct.ingresosTotales + nov.ingresosTotales)
    const vacio = datosInforme(d, c, { cuenta: 'x', compartida: false, periodo: { desde: '2024-01-01', hasta: '2024-12-01' } })
    expect(vacio.meses).toEqual([])
  })

  it('«todo» es lo de siempre', () => {
    const todo = datosInforme(d, c, { cuenta: 'x', compartida: false })
    expect(todo.periodo).toBe('Todo')
    expect(todo.kpis.dineroTotal).toBe(c.kpis.dineroTotalActual)
  })

  it('el nombre del archivo lleva el periodo', () => {
    const f = new Date('2026-11-21T10:00:00Z')
    expect(nombreArchivoInforme('Mi cuenta', f, { desde: '2026-01-01', hasta: '2026-12-01' })).toBe('informe-mi-cuenta-2026-2026-11-21.pdf')
    expect(nombreArchivoInforme('Mi cuenta', f, { desde: '2025-11-01', hasta: '2026-12-01' })).toBe('informe-mi-cuenta-2025-11_2026-12-2026-11-21.pdf')
    expect(nombreArchivoInforme('Mi cuenta', f)).toBe('informe-mi-cuenta-2026-11-21.pdf')
  })
})
