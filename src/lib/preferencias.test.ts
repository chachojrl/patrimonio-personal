import { describe, expect, it } from 'vitest'
import { PREFERENCIAS_INICIALES, haceCuanto, interpretar, mesesSinCerrar } from './preferencias'
import { formatEUR } from './money'

describe('Preferencias: lo guardado se valida', () => {
  it('sin nada guardado, o con JSON roto, usa los valores por defecto', () => {
    expect(interpretar(null)).toEqual(PREFERENCIAS_INICIALES)
    expect(interpretar('{roto')).toEqual(PREFERENCIAS_INICIALES)
    expect(interpretar('[1,2]')).toEqual(PREFERENCIAS_INICIALES)
  })
  it('respeta los valores válidos e ignora los raros', () => {
    const p = interpretar(JSON.stringify({ acento: 'teja', redondear: true, negativosRojo: 'no', otra: 1 }))
    expect(p.acento).toBe('teja')
    expect(p.redondear).toBe(true)
    expect(p.negativosRojo).toBe(true)
    expect(interpretar(JSON.stringify({ acento: 'fucsia' })).acento).toBe('marino')
  })
})

describe('Recordatorio de cerrar el mes', () => {
  const hoy = new Date(2026, 10, 21) // 21 de noviembre de 2026
  it('avisa solo de meses pasados que siguen abiertos', () => {
    const meses = [
      { fecha: '2026-11-01', estado: 'Abierto' as const },
      { fecha: '2026-10-01', estado: 'Abierto' as const },
      { fecha: '2026-09-01', estado: 'Cerrado' as const },
      { fecha: '2026-08-01', estado: 'Abierto' as const },
    ]
    expect(mesesSinCerrar(meses, hoy)).toEqual(['2026-08-01', '2026-10-01'])
  })
  it('el mes en curso abierto no cuenta', () => {
    expect(mesesSinCerrar([{ fecha: '2026-11-01', estado: 'Abierto' }], hoy)).toEqual([])
  })
})

describe('Hace cuánto', () => {
  const ahora = new Date(2026, 10, 21, 9)
  it.each([
    [new Date(2026, 10, 21, 1), 'hoy'],
    [new Date(2026, 10, 20, 23), 'ayer'],
    [new Date(2026, 10, 18), 'hace 3 días'],
    [new Date(2026, 8, 1), 'hace 2 meses'],
    [new Date(2025, 0, 1), 'hace más de un año'],
  ])('%s → %s', (d, txt) => expect(haceCuanto(d, ahora)).toBe(txt))
})

describe('Céntimos redondeados', () => {
  it.each([
    [123456, '1.235 €'],
    [123449, '1.234 €'],
    [-8437, '−84 €'],
    [40, '0 €'],
    [0, '–'],
  ])('%i → %s', (c, txt) => expect(formatEUR(c, { redondear: true })).toBe(txt))
  it('sin la opción, todo sigue igual', () => expect(formatEUR(123456)).toBe('1.234,56 €'))
})
