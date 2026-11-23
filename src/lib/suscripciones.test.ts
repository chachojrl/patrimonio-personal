import { describe, expect, it } from 'vitest'
import { detectarSuscripciones, resumenSuscripciones } from './suscripciones'
import { datosVacios, type Datos, type Gasto } from './tipos'

/** n meses (desde enero de 2026) con los gastos que devuelva «gastos(i)». */
function datos(n: number, gastos: (i: number) => [string, number, Partial<Gasto>?][]): Datos {
  const d = datosVacios()
  for (let i = 0; i < n; i++) {
    const id = `m${i}`
    d.months.push({ id, fecha: `2026-${String(i + 1).padStart(2, '0')}-01`, titulo: '', estado: 'Cerrado', ultimo_cambio: null, saldo_real_cuenta: null, valor_real_inversiones: null, intereses_cuenta_rem: null, saldo_real_remunerada: null })
    gastos(i).forEach(([concepto, importe, extra], j) => d.expenses.push({ id: `${id}g${j}`, month_id: id, concepto, fecha_vencimiento: null, importe, orden: j, fijo: false, presupuesto: null, ...extra }))
  }
  return d
}

describe('Suscripciones', () => {
  it('detecta nombres conocidos, fijos pequeños y repetidos; no los gastos grandes o variables', () => {
    const d = datos(4, (i) => [
      ['Netflix', 1299],
      ['Gimnasio', 3990],
      ['Seguro móvil', 800, { fijo: true }],
      ['iCloud', 99],
      ['Revista', 500], // repetida 4 meses igual
      ['Supermercado', 20000 + i * 3000], // variable y grande
      ['Alquiler', 80000, { fijo: true }], // fijo pero grande
      ['Restaurantes', i % 2 ? 4000 : 9000], // pequeño pero variable
    ])
    const s = detectarSuscripciones(d)
    expect(s.map((x) => x.nombre).sort()).toEqual(['Apple', 'Gimnasio', 'Netflix', 'Revista', 'Seguro móvil'])
    expect(s.find((x) => x.nombre === 'Netflix')!.motivo).toBe('nombre')
    expect(s.find((x) => x.nombre === 'Seguro móvil')!.motivo).toBe('fijo')
    expect(s.find((x) => x.nombre === 'Revista')!.motivo).toBe('repetido')
    const r = resumenSuscripciones(s)
    expect(r.alMes).toBe(1299 + 3990 + 800 + 99 + 500)
    expect(r.alAnio).toBe(r.alMes * 12)
  })

  it('avisa de subidas de precio', () => {
    const d = datos(4, (i) => [['Spotify', i < 3 ? 1099 : 1199]])
    const [s] = detectarSuscripciones(d)
    expect(s.subida).toEqual({ de: 1099, a: 1199, mes: '2026-04-01' })
    expect(s.importeMes).toBe(1199)
  })

  it('también en las notas de los apuntes, y las que dejaste de pagar no cuentan', () => {
    const d = datos(5, (i) => [['Otros', 2000], ['Disney+', i < 2 ? 899 : 0]])
    d.expense_entries = d.months.map((m, i) => ({ id: `a${i}`, expense_id: `${m.id}g0`, importe: 1299, creado_en: `${m.fecha}T10:00:00`, nota: 'Netflix' }))
    const s = detectarSuscripciones(d)
    const netflix = s.find((x) => x.nombre === 'Netflix')!
    expect(netflix.meses).toBe(5)
    expect(s.find((x) => x.nombre === 'Otros')).toBeUndefined()
    const disney = s.find((x) => x.nombre === 'Disney+')!
    expect(disney.activa).toBe(false)
    expect(resumenSuscripciones(s).activas.map((x) => x.nombre)).toEqual(['Netflix'])
  })

  it('«no es una suscripción» la quita', () => {
    const d = datos(3, () => [['Netflix', 1299]])
    d.config.no_suscripciones = ['netflix']
    expect(detectarSuscripciones(d)).toEqual([])
  })
})
