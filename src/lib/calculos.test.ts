import { describe, expect, it } from 'vitest'
import { calcular, interesesEstimados, resumenAnual } from './calculos'
import { anadirGasto, aplicarPlan, borrarMes, datosIniciales, deshacerApunte, estadoPresupuesto, planMesNuevo, reordenar, sumarUnMes, validarAhorro } from './operaciones'
import { formatEUR, formatPct, parseImporte, toCents, centsToDecimal } from './money'
import type { Datos } from './tipos'
import { datosVacios, normalizarDatos } from './tipos'

const eur = (c: number | null | undefined) => formatEUR(c ?? 0, { dash: false })

function mesPorNombre(d: Datos, fecha: string) {
  const c = calcular(d)
  const m = c.meses.find((x) => x.mes.fecha === fecha)
  if (!m) throw new Error('mes no encontrado ' + fecha)
  return m
}

describe('Tests de aceptación (sección 9)', () => {
  const d = datosIniciales()
  const c = calcular(d)
  const oct = c.meses[0]
  const nov = c.meses[1]

  it('comprobación de la fórmula de saldo de Octubre', () => {
    // −327,96 + 2.593,00 − 428,55 − (7.500,00 − 6.000,00) = 336,49
    expect(oct.anterior).toBe(-32796)
    expect(oct.saldoCalculado).toBe(33649)
  })

  it.each([
    ['ingresosTotales', '2.593,00 €', '1.825,70 €'],
    ['gastosTotales', '428,55 €', '253,87 €'],
    ['ahorroTotal', '7.500,00 €', '1.199,00 €'],
    ['saldoDisponible', '336,49 €', '709,32 €'],
    ['neto', '2.164,45 €', '1.571,83 €'],
    ['inversionesAcum', '16.836,00 €', '17.602,00 €'],
    ['cuentaRemAcum', '12.488,75 €', '12.488,75 €'],
    ['ahorroAcumulado', '29.324,75 €', '30.090,75 €'],
    ['dineroTotal', '29.661,24 €', '30.800,07 €'],
    ['ahorroDesdeIngresos', '1.500,00 €', '1.199,00 €'],
  ] as const)('%s', (campo, vOct, vNov) => {
    expect(eur(oct[campo] as number)).toBe(vOct)
    expect(eur(nov[campo] as number)).toBe(vNov)
  })

  it('% gastado y % ahorro', () => {
    expect(formatPct(oct.pctGastado)).toBe('16,5 %')
    expect(formatPct(nov.pctGastado)).toBe('13,9 %')
    expect(formatPct(oct.pctAhorro)).toBe('57,8 %')
    expect(formatPct(nov.pctAhorro)).toBe('65,7 %')
  })

  it('"Calculado" de Noviembre', () => {
    expect(eur(nov.saldoCalculado)).toBe('709,32 €')
    expect(nov.ajuste).toBe(0)
  })

  it('KPIs generales', () => {
    const k = c.kpis
    expect(eur(k.dineroTotalActual)).toBe('30.800,07 €')
    expect(eur(k.saldoInicialTotal)).toBe('27.496,79 €')
    expect(eur(k.totalInversiones)).toBe('17.602,00 €')
    expect(eur(k.totalInvertido)).toBe('20.269,00 €')
    expect(eur(k.gananciaInversiones)).toBe('−2.667,00 €')
    expect(eur(k.totalCuentaRem)).toBe('12.488,75 €')
    expect(k.ultimoMes).toBe('Noviembre-2026')
  })

  it('Resumen 2026', () => {
    const r = resumenAnual(c, 2026)
    expect(eur(r.total.ingresos)).toBe('4.418,70 €')
    expect(eur(r.total.gastos)).toBe('682,42 €')
    expect(eur(r.total.ahorroDesdeIngresos)).toBe('2.699,00 €')
    expect(formatPct(r.total.pctAhorro)).toBe('61,1 %')
    expect(r.total.saldoDisponible).toBe(70932)
    expect(r.total.dineroTotal).toBe(3080007)
    expect(r.filas[0].calc).toBeNull() // Enero sin datos → vacío, no 0
    expect(r.filas[9].calc?.nombre).toBe('Octubre-2026')
  })

  it('Historial consecutivo desde mes_inicio', () => {
    expect(c.historial.map((h) => h.nombre)).toEqual(['Octubre-2026', 'Noviembre-2026'])
    expect(c.historial.every((h) => h.registrado)).toBe(true)
  })
})

describe('Ajuste de saldo', () => {
  it('saldo real mayor que el calculado → suma a ingresos totales', () => {
    const d = datosIniciales()
    d.months[1].saldo_real_cuenta = 80000 // calculado 709,32 → ajuste +90,68
    const nov = mesPorNombre(d, '2026-11-01')
    expect(nov.ajuste).toBe(9068)
    expect(nov.ingresosTotales).toBe(182570 + 9068)
    expect(nov.gastosTotales).toBe(25387)
    expect(nov.saldoDisponible).toBe(80000)
  })

  it('saldo real menor → suma a gastos totales', () => {
    const d = datosIniciales()
    d.months[1].saldo_real_cuenta = 70000 // ajuste −9,32
    const nov = mesPorNombre(d, '2026-11-01')
    expect(nov.ajuste).toBe(-932)
    expect(nov.ingresosTotales).toBe(182570)
    expect(nov.gastosTotales).toBe(25387 + 932)
    expect(nov.saldoDisponible).toBe(70000)
  })

  it('el saldo real del mes anterior encadena con el siguiente', () => {
    const d = datosIniciales()
    d.months[0].saldo_real_cuenta = 40000
    const nov = mesPorNombre(d, '2026-11-01')
    expect(nov.anterior).toBe(40000)
  })
})

describe('Casos límite', () => {
  it('ingresos = 0 → % gastado 0 y % ahorro vacío', () => {
    const d = aplicarPlan(datosVacios(), planMesNuevo(datosVacios(), true))
    const m = calcular(d).meses[0]
    expect(m.pctGastado).toBe(0)
    expect(m.pctAhorro).toBeNull()
    expect(m.conMovimientos).toBe(false)
  })

  it('sin meses → KPIs con valores iniciales', () => {
    const c = calcular(datosVacios())
    expect(c.kpis.dineroTotalActual).toBe(2749679)
    expect(c.kpis.totalInversiones).toBe(933600)
    expect(c.historial).toEqual([])
  })

  it('% gastado se limita a 100 %', () => {
    const d = datosIniciales()
    d.expenses.find((x) => x.month_id === d.months[1].id && x.concepto === 'Otros')!.importe = 500000
    expect(mesPorNombre(d, '2026-11-01').pctGastado).toBe(1)
  })

  it('borrar un mes intermedio → los siguientes se recalculan', () => {
    let d = datosIniciales()
    d = aplicarPlan(d, planMesNuevo(d, true)) // Diciembre-2026
    const dic = d.months.find((m) => m.fecha === '2026-12-01')!
    d.incomes.find((x) => x.month_id === dic.id && x.concepto === 'Nomina')!.importe = 100000
    expect(mesPorNombre(d, '2026-12-01').saldoDisponible).toBe(70932 + 100000)

    const sinNov = borrarMes(d, d.months[1].id)
    const c = calcular(sinNov)
    // Diciembre encadena ahora con Octubre
    expect(c.meses.map((m) => m.nombre)).toEqual(['Octubre-2026', 'Diciembre-2026'])
    expect(c.meses[1].anterior).toBe(33649)
    expect(c.meses[1].saldoDisponible).toBe(33649 + 100000)
    // Inversiones: sin la valoración real de Noviembre vuelve a la estimación
    expect(c.meses[1].inversionesAcum).toBe(1683600)
    expect(c.historial.map((h) => [h.nombre, h.registrado])).toEqual([
      ['Octubre-2026', true], ['Noviembre-2026', false], ['Diciembre-2026', true],
    ])
  })

  it('valoración real + aportaciones posteriores', () => {
    let d = datosIniciales()
    d = aplicarPlan(d, planMesNuevo(d, true))
    const dic = d.months.find((m) => m.fecha === '2026-12-01')!
    d.savings.push({ id: 'x', month_id: dic.id, fecha: '2026-12-05', importe: 50000, tipo: 'Inversiones', origen: 'Ingresos mensuales' })
    expect(mesPorNombre(d, '2026-12-01').inversionesAcum).toBe(1760200 + 50000)
  })

  it('traspaso de cuenta remunerada a inversiones no sale del saldo', () => {
    let d = datosIniciales()
    d = aplicarPlan(d, planMesNuevo(d, true))
    const dic = d.months.find((m) => m.fecha === '2026-12-01')!
    d.savings.push({ id: 'y', month_id: dic.id, fecha: '2026-12-05', importe: 100000, tipo: 'Inversiones', origen: 'Cuenta remunerada' })
    d.savings.push({ id: 'z', month_id: dic.id, fecha: '2026-12-06', importe: 20000, tipo: 'Cuenta remunerada', origen: 'Ingresos mensuales' })
    const m = mesPorNombre(d, '2026-12-01')
    expect(m.saldoDisponible).toBe(70932 - 20000)
    expect(m.cuentaRemAcum).toBe(1248875 + 20000 - 100000)
    expect(m.ahorroDesdeIngresos).toBe(20000)
  })
})

describe('Traspasos entre cuentas', () => {
  // Diciembre parte de: saldo 709,32 €, cuenta rem. 12.488,75 €, inversiones 17.602,00 €, dinero total 30.800,07 €
  function diciembre(movs: [number, Datos['savings'][number]['origen'], Datos['savings'][number]['tipo']][]) {
    let d = datosIniciales()
    d = aplicarPlan(d, planMesNuevo(d, true))
    const dic = d.months.find((m) => m.fecha === '2026-12-01')!
    movs.forEach(([importe, origen, tipo], i) => d.savings.push({ id: `t${i}`, month_id: dic.id, fecha: '2026-12-10', importe, origen, tipo }))
    return mesPorNombre(d, '2026-12-01')
  }

  it('de la cuenta remunerada a la cuenta de gastos: sube el saldo, baja la remunerada, el total no cambia', () => {
    const m = diciembre([[50000, 'Cuenta remunerada', 'Cuenta de gastos']])
    expect(m.saldoDisponible).toBe(70932 + 50000)
    expect(m.cuentaRemAcum).toBe(1248875 - 50000)
    expect(m.inversionesAcum).toBe(1760200)
    expect(m.dineroTotal).toBe(3080007)
    // No es un ingreso ni un gasto, pero sí «desahorro»
    expect(m.ingresosTotales).toBe(0)
    expect(m.gastosTotales).toBe(0)
    expect(m.ahorroDesdeIngresos).toBe(-50000)
    expect(m.ahorroTotal).toBe(-50000)
    expect(m.ctaRemMes).toBe(-50000)
    expect(m.traspasoGastos).toBe(50000)
  })

  it('con el saldo real del banco puesto, el traspaso no se cuenta como ajuste', () => {
    let d = datosIniciales()
    d = aplicarPlan(d, planMesNuevo(d, true))
    const dic = d.months.find((m) => m.fecha === '2026-12-01')!
    d.savings.push({ id: 't', month_id: dic.id, fecha: '2026-12-10', importe: 50000, origen: 'Cuenta remunerada', tipo: 'Cuenta de gastos' })
    dic.saldo_real_cuenta = 70932 + 50000
    expect(mesPorNombre(d, '2026-12-01').ajuste).toBe(0)
  })

  it('vender inversiones a la cuenta de gastos', () => {
    const m = diciembre([[30000, 'Inversiones', 'Cuenta de gastos']])
    expect(m.saldoDisponible).toBe(70932 + 30000)
    expect(m.inversionesAcum).toBe(1760200 - 30000)
    expect(m.invMes).toBe(-30000)
    expect(m.dineroTotal).toBe(3080007)
  })

  it('de inversiones a la cuenta remunerada: el saldo disponible no cambia', () => {
    const m = diciembre([[10000, 'Inversiones', 'Cuenta remunerada']])
    expect(m.saldoDisponible).toBe(70932)
    expect(m.inversionesAcum).toBe(1760200 - 10000)
    expect(m.cuentaRemAcum).toBe(1248875 + 10000)
    expect(m.ahorroDesdeIngresos).toBe(0)
    expect(m.dineroTotal).toBe(3080007)
  })

  it('ahorrar y sacar en el mismo mes se compensa', () => {
    const m = diciembre([[20000, 'Ingresos mensuales', 'Cuenta remunerada'], [5000, 'Cuenta remunerada', 'Cuenta de gastos']])
    expect(m.saldoDisponible).toBe(70932 - 15000)
    expect(m.cuentaRemAcum).toBe(1248875 + 15000)
    expect(m.ahorroDesdeIngresos).toBe(15000)
    expect(m.ahorroTotal).toBe(15000)
  })

  it('el saldo del mes siguiente parte del saldo con el traspaso', () => {
    let d = datosIniciales()
    d = aplicarPlan(d, planMesNuevo(d, true))
    const dic = d.months.find((m) => m.fecha === '2026-12-01')!
    d.savings.push({ id: 't', month_id: dic.id, fecha: '2026-12-10', importe: 50000, origen: 'Cuenta remunerada', tipo: 'Cuenta de gastos' })
    d = aplicarPlan(d, planMesNuevo(d, true))
    const ene = mesPorNombre(d, '2027-01-01')
    expect(ene.anterior).toBe(70932 + 50000)
    expect(ene.cuentaRemAcum).toBe(1248875 - 50000)
  })
})

describe('Crear mes nuevo', () => {
  it('copia conceptos con importe 0, cierra el anterior, título "Presupuesto personal"', () => {
    const d = datosIniciales()
    const p = planMesNuevo(d, true)
    expect(p.mes.fecha).toBe('2026-12-01')
    expect(p.mes.titulo).toBe('Presupuesto personal')
    expect(p.mes.ultimo_cambio).toBeNull()
    expect(p.cerrarMesId).toBe(d.months[1].id)
    expect(p.expenses.map((x) => x.concepto)).toContain('Golf')
    expect(p.expenses.every((x) => x.importe === 0 && x.fecha_vencimiento === null)).toBe(true)
    expect(p.incomes.map((x) => x.concepto)).toEqual(['Nomina', 'Fuente de ingresos 2', 'Fuente de ingresos 3', 'Fuente de ingresos 4', 'Otros'])
    expect(p.nuevoResumen).toBeNull()
  })

  it('sin cerrar el anterior si se desmarca', () => {
    const d = datosIniciales()
    expect(planMesNuevo(d, false).cerrarMesId).toBeNull()
  })

  it('primer mes usa mes_inicio y la plantilla', () => {
    const p = planMesNuevo(datosVacios(), true)
    expect(p.mes.fecha).toBe('2026-10-01')
    expect(p.expenses).toHaveLength(14)
    expect(p.nuevoResumen).toBe(2026)
  })

  it('desde Diciembre crea Enero del año siguiente y su resumen', () => {
    let d = datosIniciales()
    d = aplicarPlan(d, planMesNuevo(d, true))
    const p = planMesNuevo(d, true)
    expect(p.mes.fecha).toBe('2027-01-01')
    expect(p.nuevoResumen).toBe(2027)
  })

  it('nunca crea huecos: siempre el siguiente al último', () => {
    let d = datosIniciales()
    for (let i = 0; i < 14; i++) d = aplicarPlan(d, planMesNuevo(d, true))
    const fechas = d.months.map((m) => m.fecha).sort()
    expect(new Set(fechas).size).toBe(fechas.length)
    expect(fechas[fechas.length - 1]).toBe('2028-01-01')
    expect(calcular(d).historial.every((h) => h.registrado)).toBe(true)
  })
})

describe('Añadir gasto (macro SumarGasto)', () => {
  it('10,10 + 0,20 sobre 5,40 → 15,70 exacto, con apuntes', () => {
    const d0 = datosIniciales()
    const g = d0.expenses.find((x) => x.month_id === d0.months[1].id && x.concepto === 'Supermercado')!
    const r1 = anadirGasto(d0, g.id, parseImporte('10,10')!)
    const r2 = anadirGasto(r1.datos, g.id, parseImporte('0.2')!)
    expect(r2.gasto.importe).toBe(1570)
    expect(formatEUR(r2.gasto.importe)).toBe('15,70 €')
    expect(r2.datos.expense_entries).toHaveLength(2)
    const r3 = deshacerApunte(r2.datos, r2.apunte.id)
    expect(r3.gasto?.importe).toBe(1550)
    expect(r3.datos.expense_entries).toHaveLength(1)
  })

  it('valor no numérico → sin cambios', () => {
    expect(parseImporte('abc')).toBeNull()
    const d0 = datosIniciales()
    expect(() => anadirGasto(d0, d0.expenses[0].id, 0)).toThrow('Introduce un importe numérico.')
  })
})

describe('Validaciones', () => {
  it('Cuenta remunerada → Cuenta remunerada bloqueado', () => {
    expect(validarAhorro({ tipo: 'Cuenta remunerada', origen: 'Cuenta remunerada', importe: 100 })).not.toBeNull()
    expect(validarAhorro({ tipo: 'Inversiones', origen: 'Cuenta remunerada', importe: 100 })).toBeNull()
  })

  it('origen y destino no pueden ser la misma cuenta', () => {
    expect(validarAhorro({ tipo: 'Cuenta de gastos', origen: 'Ingresos mensuales', importe: 100 })).not.toBeNull()
    expect(validarAhorro({ tipo: 'Inversiones', origen: 'Inversiones', importe: 100 })).not.toBeNull()
    expect(validarAhorro({ tipo: 'Cuenta de gastos', origen: 'Cuenta remunerada', importe: 100 })).toBeNull()
    expect(validarAhorro({ tipo: 'Cuenta remunerada', origen: 'Inversiones', importe: 100 })).toBeNull()
  })
})

describe('Importes', () => {
  it('parseImporte acepta coma, punto y miles', () => {
    expect(parseImporte('1.234,56')).toBe(123456)
    expect(parseImporte('1,234.56')).toBe(123456)
    expect(parseImporte('1234,5')).toBe(123450)
    expect(parseImporte('1234.5')).toBe(123450)
    expect(parseImporte('12')).toBe(1200)
    expect(parseImporte('12 €')).toBe(1200)
    expect(parseImporte('1.234.567')).toBe(123456700)
    expect(parseImporte('0,005')).toBe(1)
    expect(parseImporte(',5')).toBe(50)
    expect(parseImporte('-3,2')).toBe(-320)
    expect(parseImporte('')).toBeNull()
    expect(parseImporte('1,2,3')).toBeNull()
  })

  it('formatEUR', () => {
    expect(formatEUR(0)).toBe('–')
    expect(formatEUR(123456)).toBe('1.234,56 €')
    expect(formatEUR(-266700)).toBe('−2.667,00 €')
    expect(formatEUR(5)).toBe('0,05 €')
    expect(formatEUR(123456789)).toBe('1.234.567,89 €')
  })

  it('conversión con Postgres NUMERIC', () => {
    expect(toCents('18488.75')).toBe(1848875)
    expect(toCents('-327.96')).toBe(-32796)
    expect(toCents(0.1 + 0.2)).toBe(30)
    expect(toCents('5.4')).toBe(540)
    expect(centsToDecimal(-32796)).toBe('-327.96')
    expect(centsToDecimal(5)).toBe('0.05')
  })
})

describe('Gastos fijos y presupuestos', () => {
  it('al crear el mes, los fijos copian importe y vencimiento +1 mes; el resto a 0; el presupuesto se mantiene', () => {
    const d = datosIniciales()
    const nov = d.months[1].id
    const tel = d.expenses.find((x) => x.month_id === nov && x.concepto === 'Teléfono móvil/WiFi')!
    tel.fijo = true
    tel.fecha_vencimiento = '2026-11-30'
    const sup = d.expenses.find((x) => x.month_id === nov && x.concepto === 'Supermercado')!
    sup.presupuesto = 20000
    const p = planMesNuevo(d, true)
    const tel2 = p.expenses.find((x) => x.concepto === 'Teléfono móvil/WiFi')!
    expect(tel2).toMatchObject({ fijo: true, importe: 4788, fecha_vencimiento: '2026-12-30' })
    const sup2 = p.expenses.find((x) => x.concepto === 'Supermercado')!
    expect(sup2).toMatchObject({ fijo: false, importe: 0, presupuesto: 20000, fecha_vencimiento: null })
    // El saldo del mes nuevo ya descuenta el gasto fijo
    const dic = calcular(aplicarPlan(d, p)).meses[2]
    expect(dic.sumGastos).toBe(4788)
  })

  it('sumarUnMes ajusta a fin de mes y cambia de año', () => {
    expect(sumarUnMes('2026-01-31')).toBe('2026-02-28')
    expect(sumarUnMes('2028-01-31')).toBe('2028-02-29')
    expect(sumarUnMes('2026-12-15')).toBe('2027-01-15')
  })

  it('estadoPresupuesto', () => {
    expect(estadoPresupuesto({ importe: 5000, presupuesto: null })).toBeNull()
    expect(estadoPresupuesto({ importe: 5000, presupuesto: 20000 })).toEqual({ pct: 0.25, exceso: 0 })
    expect(estadoPresupuesto({ importe: 25000, presupuesto: 20000 })).toEqual({ pct: 1.25, exceso: 5000 })
  })
})

describe('Reordenar filas', () => {
  const filas = ['a', 'b', 'c', 'd'].map((id, orden) => ({ id, orden }))
  it('mover hacia abajo y hacia arriba solo cambia las filas afectadas', () => {
    expect(reordenar(filas, 0, 2)).toEqual([{ id: 'b', orden: 0 }, { id: 'c', orden: 1 }, { id: 'a', orden: 2 }])
    expect(reordenar(filas, 3, 1)).toEqual([{ id: 'd', orden: 1 }, { id: 'b', orden: 2 }, { id: 'c', orden: 3 }])
    expect(reordenar(filas, 1, 1)).toEqual([])
  })
  it('funciona aunque los órdenes no sean consecutivos', () => {
    const f = [{ id: 'x', orden: 0 }, { id: 'y', orden: 10 }, { id: 'z', orden: 20 }]
    expect(reordenar(f, 2, 0)).toEqual([{ id: 'z', orden: 0 }, { id: 'x', orden: 1 }, { id: 'y', orden: 2 }])
  })
})

describe('Copias antiguas', () => {
  it('normalizarDatos rellena fijo y presupuesto', () => {
    const d = datosIniciales() as unknown as { expenses: Record<string, unknown>[] }
    for (const g of d.expenses) { delete g.fijo; delete g.presupuesto }
    const n = normalizarDatos(d as unknown as Datos)
    expect(n.expenses.every((g) => g.fijo === false && g.presupuesto === null)).toBe(true)
  })
})

describe('Intereses de la cuenta remunerada (TAE)', () => {
  // Octubre deja la cuenta remunerada en 12.488,75 € y noviembre no la mueve
  const conTae = (tae: Datos['config']['tae_cuenta_rem'], retencion = 19, pago: Datos['config']['pago_intereses'] = 'mismo-mes') => {
    const d = datosIniciales()
    d.config = { ...d.config, tae_cuenta_rem: tae, retencion_intereses: retencion, pago_intereses: pago }
    return d
  }

  it('sin TAE no hay intereses y todo queda como antes', () => {
    const c = calcular(datosIniciales())
    expect(c.meses.every((m) => m.interesesCtaRem === 0)).toBe(true)
    expect(c.kpis.interesesTotales).toBe(0)
  })

  it('interesesEstimados: TAE mensual equivalente y retención', () => {
    // 10.000 € al 2 % TAE: (1,02^(1/12) − 1) × 10.000 = 16,5158 € brutos; netos al 19 % = 13,38 €
    expect(interesesEstimados(1000000, 2, 0)).toBe(1652)
    expect(interesesEstimados(1000000, 2, 19)).toBe(1338)
    expect(interesesEstimados(0, 2, 19)).toBe(0)
    expect(interesesEstimados(-5000, 2, 19)).toBe(0)
    expect(interesesEstimados(1000000, 0, 19)).toBe(0)
    // 12 meses seguidos reinvirtiendo, sin retención, dan la TAE
    let saldo = 1000000
    for (let i = 0; i < 12; i++) saldo += interesesEstimados(saldo, 2, 0)
    expect(Math.abs(saldo - 1020000)).toBeLessThanOrEqual(6)
  })

  it('se suman a la cuenta remunerada y al dinero total, con el saldo al empezar el mes', () => {
    const base = mesPorNombre(datosIniciales(), '2026-11-01')
    const d = conTae([{ desde: '2026-11-01', tae: 2.5 }])
    const nov = mesPorNombre(d, '2026-11-01')
    const esperado = interesesEstimados(1248875, 2.5, 19)
    expect(esperado).toBeGreaterThan(0)
    expect(nov.interesesCtaRem).toBe(esperado)
    expect(nov.interesesReales).toBe(false)
    expect(nov.tae).toBe(2.5)
    expect(nov.cuentaRemAcum).toBe(base.cuentaRemAcum + esperado)
    expect(nov.dineroTotal).toBe(base.dineroTotal + esperado)
    // No cuenta como ahorro ni como movimiento del mes, ni toca el saldo disponible
    expect(nov.ahorroTotal).toBe(base.ahorroTotal)
    expect(nov.ctaRemMes).toBe(base.ctaRemMes)
    expect(nov.saldoDisponible).toBe(base.saldoDisponible)
    // Octubre es anterior a la TAE: sin intereses
    expect(mesPorNombre(d, '2026-10-01').interesesCtaRem).toBe(0)
    expect(calcular(d).kpis.interesesTotales).toBe(esperado)
  })

  it('cada mes usa la TAE de su tramo y los intereses se acumulan', () => {
    let d = conTae([{ desde: '2026-10-01', tae: 3 }, { desde: '2026-12-01', tae: 1 }], 0)
    d = aplicarPlan(d, planMesNuevo(d, true))
    const c = calcular(d)
    expect(c.meses.map((m) => m.tae)).toEqual([3, 3, 1])
    const [oct, nov, dic] = c.meses
    expect(nov.interesesCtaRem).toBe(interesesEstimados(oct.cuentaRemAcum, 3, 0))
    expect(dic.interesesCtaRem).toBe(interesesEstimados(nov.cuentaRemAcum, 1, 0))
  })

  it('los intereses reales del banco sustituyen a la estimación', () => {
    const d = conTae([{ desde: '2026-10-01', tae: 2.5 }])
    const nov = d.months.find((m) => m.fecha === '2026-11-01')!
    nov.intereses_cuenta_rem = 2000
    const m = mesPorNombre(d, '2026-11-01')
    expect(m.interesesCtaRem).toBe(2000)
    expect(m.interesesReales).toBe(true)
    const oct = mesPorNombre(d, '2026-10-01')
    expect(m.cuentaRemAcum).toBe(oct.cuentaRemAcum + 2000)
  })

  it('pago el día 1 del mes siguiente: lo de noviembre se suma en diciembre', () => {
    let d = conTae([{ desde: '2026-11-01', tae: 2.5 }], 19, 'mes-siguiente')
    const sinTae = calcular(datosIniciales()).meses[1]
    let c = calcular(d)
    const nov = c.meses[1]
    // Noviembre no cobra nada (octubre no tenía TAE), pero genera lo que se cobrará el 1 de diciembre
    expect(nov.interesesCtaRem).toBe(0)
    expect(nov.cuentaRemAcum).toBe(sinTae.cuentaRemAcum)
    expect(nov.interesesGenerados).toBe(interesesEstimados(sinTae.cuentaRemAcum, 2.5, 19))
    expect(c.kpis.interesesPendientes).toBe(nov.interesesGenerados)
    // Al crear diciembre, se cobra lo generado en noviembre
    d = aplicarPlan(d, planMesNuevo(d, true))
    c = calcular(d)
    const dic = c.meses[2]
    expect(dic.interesesCtaRem).toBe(nov.interesesGenerados)
    expect(dic.tae).toBe(2.5)
    expect(dic.cuentaRemAcum).toBe(nov.cuentaRemAcum + nov.interesesGenerados)
    // Diciembre genera sobre el saldo ya con lo cobrado el día 1
    expect(dic.interesesGenerados).toBe(interesesEstimados(nov.cuentaRemAcum + nov.interesesGenerados, 2.5, 19))
  })

  it('pago el día 1: lo que escribes como cobrado sustituye a la estimación de ese mes', () => {
    let d = conTae([{ desde: '2026-10-01', tae: 2.5 }], 19, 'mes-siguiente')
    d = aplicarPlan(d, planMesNuevo(d, true))
    d.months.find((m) => m.fecha === '2026-12-01')!.intereses_cuenta_rem = 2500
    const c = calcular(d)
    expect(c.meses[2].interesesCtaRem).toBe(2500)
    expect(c.meses[2].interesesReales).toBe(true)
    expect(c.meses[1].interesesCtaRem).toBe(c.meses[0].interesesGenerados) // noviembre cobra lo de octubre
  })

  it('por defecto el banco paga el día 1 del mes siguiente', () => {
    expect(datosIniciales().config.pago_intereses).toBe('mes-siguiente')
  })

  it('datos antiguos sin TAE se normalizan', () => {
    const d = datosIniciales() as unknown as { config: Record<string, unknown>; months: Record<string, unknown>[] }
    delete d.config.tae_cuenta_rem
    delete d.config.retencion_intereses
    delete d.config.pago_intereses
    d.months.forEach((m) => delete m.intereses_cuenta_rem)
    const n = normalizarDatos(d as unknown as Datos)
    expect(n.config.tae_cuenta_rem).toEqual([])
    expect(n.config.retencion_intereses).toBe(19)
    expect(n.config.pago_intereses).toBe('mes-siguiente')
    expect(n.months.every((m) => m.intereses_cuenta_rem === null)).toBe(true)
  })
})

describe('Saldo real de la cuenta remunerada', () => {
  it('ajusta la diferencia con lo calculado y los meses siguientes parten de ahí', () => {
    let d = datosIniciales()
    d.config = { ...d.config, tae_cuenta_rem: [{ desde: '2026-10-01', tae: 2.5 }], pago_intereses: 'mismo-mes' }
    d = aplicarPlan(d, planMesNuevo(d, true))
    const antes = calcular(d)
    const nov = d.months.find((m) => m.fecha === '2026-11-01')!
    // El banco dice 12.488,75 € aunque la app haya calculado intereses
    nov.saldo_real_remunerada = 1248875
    const c = calcular(d)
    const n = c.meses[1]
    expect(n.cuentaRemAcum).toBe(1248875)
    expect(n.cuentaRemCalculada).toBe(antes.meses[1].cuentaRemAcum)
    expect(n.ajusteCtaRem).toBe(1248875 - antes.meses[1].cuentaRemAcum)
    expect(n.dineroTotal).toBe(antes.meses[1].dineroTotal + n.ajusteCtaRem)
    // No es un ingreso ni toca la cuenta de gastos
    expect(n.ingresosTotales).toBe(antes.meses[1].ingresosTotales)
    expect(n.saldoDisponible).toBe(antes.meses[1].saldoDisponible)
    // Diciembre parte de 12.488,75 € (y genera sus intereses sobre esa cifra)
    const dic = c.meses[2]
    expect(dic.cuentaRemAcum).toBe(1248875 + dic.interesesCtaRem)
    expect(dic.interesesCtaRem).toBe(interesesEstimados(1248875, 2.5, 19))
  })

  it('vacío no cambia nada', () => {
    const d = datosIniciales()
    const c = calcular(d)
    expect(c.meses.every((m) => m.ajusteCtaRem === 0 && m.cuentaRemCalculada === m.cuentaRemAcum)).toBe(true)
  })
})
