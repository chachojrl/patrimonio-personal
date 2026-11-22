import { describe, expect, it } from 'vitest'
import { gastosDelMes, mediaPorDiaSemana, semanasDelMes, ultimoDia } from './calendario'
import { datosVacios, type Datos } from './tipos'

function datos(): Datos {
  const d = datosVacios()
  d.months = [{ id: 'm', fecha: '2026-11-01', titulo: '', estado: 'Abierto', ultimo_cambio: null, saldo_real_cuenta: null, valor_real_inversiones: null, intereses_cuenta_rem: null }]
  d.expenses = [
    { id: 'super', month_id: 'm', concepto: 'Supermercado', fecha_vencimiento: null, importe: 9000, orden: 0, fijo: false, presupuesto: null },
    { id: 'luz', month_id: 'm', concepto: 'Luz', fecha_vencimiento: '2026-11-05', importe: 4500, orden: 1, fijo: true, presupuesto: null },
    { id: 'otros', month_id: 'm', concepto: 'Otros', fecha_vencimiento: null, importe: 2000, orden: 2, fijo: false, presupuesto: null },
  ]
  d.expense_entries = [
    { id: 'a1', expense_id: 'super', importe: 5000, creado_en: '2026-11-06T18:00:00', nota: 'Mercadona' }, // viernes
    { id: 'a2', expense_id: 'super', importe: 4000, creado_en: '2026-11-13T10:00:00', nota: null }, // viernes
  ]
  return d
}

describe('Calendario de gastos', () => {
  it('pone cada apunte en su día y los gastos con vencimiento sin apuntes en su fecha', () => {
    const { dias, conDia, total } = gastosDelMes(datos(), '2026-11-01')
    expect(dias.get('2026-11-06')!.total).toBe(5000)
    expect(dias.get('2026-11-06')!.apuntes[0]).toMatchObject({ concepto: 'Supermercado', nota: 'Mercadona', origen: 'apunte' })
    expect(dias.get('2026-11-05')!.apuntes[0]).toMatchObject({ concepto: 'Luz', origen: 'vencimiento' })
    // «Otros» se escribió en la casilla: no tiene día
    expect(conDia).toBe(13500)
    expect(total).toBe(15500)
  })

  it('semanas empezando en lunes', () => {
    const s = semanasDelMes('2026-11-01') // el 1 de noviembre de 2026 es domingo
    expect(s[0]).toEqual([null, null, null, null, null, null, '2026-11-01'])
    expect(s.at(-1)!.filter(Boolean).at(-1)).toBe('2026-11-30')
    expect(ultimoDia('2026-02-01')).toBe('2026-02-28')
  })

  it('media por día de la semana sobre los días transcurridos', () => {
    const m = mediaPorDiaSemana(datos(), ['2026-11-01'], '2026-11-15')
    const viernes = m.find((x) => x.dia === 'Viernes')!
    expect(viernes.total).toBe(9000)
    expect(viernes.media).toBe(4500) // dos viernes hasta el 15 (6 y 13)
    expect(m.find((x) => x.dia === 'Jueves')!.media).toBe(2250) // el 5 (luz) y el 12
    // Un mes sin nada con día no baja la media
    const d = datos()
    d.months.push({ ...d.months[0], id: 'oct', fecha: '2026-10-01' })
    expect(mediaPorDiaSemana(d, ['2026-10-01', '2026-11-01'], '2026-11-15').find((x) => x.dia === 'Viernes')!.media).toBe(4500)
  })
})
