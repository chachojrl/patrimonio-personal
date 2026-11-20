import { describe, expect, it } from 'vitest'
import { describir, etiquetaDia, limpiar, type Cambio } from './actividad'
import { formatEUR } from './money'

const eur = (c: number) => formatEUR(c, { dash: false })
let n = 0
const cambio = (p: Partial<Cambio>): Cambio => ({ id: ++n, user_id: 'u1', tabla: 'expenses', fila_id: 'f', accion: 'cambio', detalle: {}, creado_en: '2026-11-20T10:00:00Z', ...p })

describe('Historial: frases', () => {
  it.each([
    [cambio({ tabla: 'months', accion: 'alta', detalle: { mes: '2026-12-01' } }), 'creó el mes Diciembre-2026'],
    [cambio({ tabla: 'months', detalle: { mes: '2026-11-01', cambios: { estado: ['Abierto', 'Cerrado'] } } }), 'cerró el mes Noviembre-2026'],
    [cambio({ tabla: 'expenses', accion: 'alta', detalle: { nombre: 'Super', mes: '2026-11-01', importe: 50 } }), 'añadió el gasto «Super» (50,00 €) en Noviembre-2026'],
    [cambio({ detalle: { nombre: 'Supermercado', mes: '2026-11-01', cambios: { importe: [300, 345.5] } } }), 'cambió «Supermercado»: 300,00 € → 345,50 € en Noviembre-2026'],
    [cambio({ detalle: { nombre: 'Luz', cambios: { concepto: ['Luz', 'Luz y agua'] } } }), 'renombró «Luz» a «Luz y agua»'],
    [cambio({ tabla: 'expense_entries', accion: 'alta', detalle: { nombre: 'Luz', importe: 12.5, nota: 'factura' } }), 'sumó 12,50 € a «Luz» (factura)'],
    [cambio({ tabla: 'incomes', accion: 'baja', detalle: { nombre: 'Extra' } }), 'borró el ingreso «Extra»'],
    [cambio({ tabla: 'debts', accion: 'alta', detalle: { nombre: 'Juan', importe: 30, concepto: 'cena' } }), 'apuntó que Juan debe 30,00 € (cena)'],
    [cambio({ tabla: 'debts', detalle: { nombre: 'Juan', cambios: { devuelto_en: [null, '2026-11-20'] } } }), 'marcó como devuelto lo de Juan'],
  ])('%#', (c, frase) => {
    expect(describir(c, eur)).toBe(frase)
  })
})

describe('Historial: limpieza', () => {
  it('oculta el cambio de importe que acompaña a un apunte, pero no uno hecho a mano', () => {
    const apunte = cambio({ tabla: 'expense_entries', accion: 'alta', detalle: { nombre: 'Luz', mes: '2026-11-01', importe: 12.5 }, creado_en: '2026-11-20T10:00:00Z' })
    const eco = cambio({ detalle: { nombre: 'Luz', mes: '2026-11-01', cambios: { importe: [40, 52.5] } }, creado_en: '2026-11-20T10:00:01Z' })
    const aMano = cambio({ detalle: { nombre: 'Luz', mes: '2026-11-01', cambios: { importe: [52.5, 60] } }, creado_en: '2026-11-20T10:00:05Z' })
    const deOtro = cambio({ user_id: 'u2', detalle: { nombre: 'Luz', mes: '2026-11-01', cambios: { importe: [40, 52.5] } }, creado_en: '2026-11-20T10:00:01Z' })
    expect(limpiar([aMano, eco, apunte, deOtro]).map((c) => c.id)).toEqual([aMano.id, apunte.id, deOtro.id])
  })
})

describe('Historial: días', () => {
  it('Hoy, Ayer y fechas', () => {
    const ahora = new Date('2026-11-20T12:00:00')
    expect(etiquetaDia('2026-11-20T08:00:00', ahora)).toBe('Hoy')
    expect(etiquetaDia('2026-11-19T23:00:00', ahora)).toBe('Ayer')
    expect(etiquetaDia('2026-11-02T10:00:00', ahora)).toMatch(/2 de noviembre/)
  })
})

import { enSegundaPersona } from './actividad'
describe('Historial: segunda persona', () => {
  it('conjuga los cambios hechos por ti', () => {
    expect(enSegundaPersona('marcó «Alquiler» como gasto fijo')).toBe('marcaste «Alquiler» como gasto fijo')
    expect(enSegundaPersona('deshizo un apunte')).toBe('deshiciste un apunte')
    expect(enSegundaPersona('puso el saldo real')).toBe('pusiste el saldo real')
  })
  it('todas las frases empiezan por un verbo que sabe conjugar', () => {
    const frases = ['creó', 'borró', 'cerró', 'reabrió', 'actualizó', 'quitó', 'puso', 'cambió', 'modificó', 'añadió', 'renombró', 'marcó', 'sumó', 'deshizo', 'apuntó', 'volvió', 'hizo']
    for (const v of frases) expect(enSegundaPersona(`${v} algo`)).not.toBe(`${v} algo`)
  })
})
