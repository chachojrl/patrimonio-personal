// Módulo PURO de cálculo: réplica exacta de las fórmulas del Excel.
// Todo en céntimos enteros. Nada de lo que se calcula aquí se guarda en la base de datos.
import type { Cents } from './money'
import type { Datos, Mes } from './tipos'
import { fechaDesdeIndice, indiceMes, nombreMes, partes } from './fechas'

const suma = (xs: Cents[]) => xs.reduce((a, b) => a + b, 0)

export interface MesCalculado {
  mes: Mes
  nombre: string
  // Sumas base
  sumIngresos: Cents
  sumGastos: Cents
  ahorroTotal: Cents
  invDesdeCtaRem: Cents
  invMes: Cents
  ctaRemMes: Cents
  // 4.1
  anterior: Cents
  saldoCalculado: Cents
  ajuste: Cents
  ingresosTotales: Cents
  gastosTotales: Cents
  saldoDisponible: Cents
  pctGastado: number
  pctDisponible: number
  // 4.2
  neto: Cents
  inversionesAcum: Cents
  cuentaRemAcum: Cents
  ahorroAcumulado: Cents
  dineroTotal: Cents
  // 4.4
  ahorroDesdeIngresos: Cents
  pctAhorro: number | null
  conMovimientos: boolean
}

export interface FilaHistorial {
  fecha: string
  nombre: string
  registrado: boolean
  calc: MesCalculado | null
}

export interface Kpis {
  dineroTotalActual: Cents
  saldoInicialTotal: Cents
  ultimoMes: string | null
  totalInversiones: Cents
  totalInvertido: Cents
  gananciaInversiones: Cents
  cuentaRemInicial: Cents
  totalCuentaRem: Cents
}

export interface Calculo {
  meses: MesCalculado[] // solo meses existentes, orden cronológico
  porId: Map<string, MesCalculado>
  historial: FilaHistorial[] // consecutivo desde mes_inicio hasta el último mes
  kpis: Kpis
}

export function calcular(d: Datos): Calculo {
  const cfg = d.config
  const meses = [...d.months].sort((a, b) => a.fecha.localeCompare(b.fecha))

  const ingresosPorMes = agrupar(d.incomes, (x) => x.month_id)
  const gastosPorMes = agrupar(d.expenses, (x) => x.month_id)
  const ahorrosPorMes = agrupar(d.savings, (x) => x.month_id)

  const resultado: MesCalculado[] = []
  let anterior = cfg.ajuste_cuenta_gastos_inicial
  let acumCtaRem = 0 // Σ ctaRemMes − Σ invDesdeCtaRem
  let invEstimada = cfg.inversiones_iniciales // última valoración real (o inicial) + aportaciones posteriores

  for (const mes of meses) {
    const ing = ingresosPorMes.get(mes.id) ?? []
    const gas = gastosPorMes.get(mes.id) ?? []
    const aho = ahorrosPorMes.get(mes.id) ?? []

    const sumIngresos = suma(ing.map((x) => x.importe))
    const sumGastos = suma(gas.map((x) => x.importe))
    const ahorroTotal = suma(aho.map((x) => x.importe))
    const invDesdeCtaRem = suma(aho.filter((x) => x.tipo === 'Inversiones' && x.origen === 'Cuenta remunerada').map((x) => x.importe))
    const invMes = suma(aho.filter((x) => x.tipo === 'Inversiones').map((x) => x.importe))
    const ctaRemMes = suma(aho.filter((x) => x.tipo === 'Cuenta remunerada').map((x) => x.importe))

    // 4.1
    const saldoCalculado = anterior + sumIngresos - sumGastos - (ahorroTotal - invDesdeCtaRem)
    const ajuste = mes.saldo_real_cuenta === null ? 0 : mes.saldo_real_cuenta - saldoCalculado
    const ingresosTotales = sumIngresos + Math.max(0, ajuste)
    const gastosTotales = sumGastos + Math.max(0, -ajuste)
    const saldoDisponible = saldoCalculado + ajuste
    const pctGastado = ingresosTotales === 0 ? 0 : Math.min(gastosTotales / ingresosTotales, 1)

    // 4.2 Inversiones acumuladas: la valoración real sustituye a la estimación.
    if (mes.valor_real_inversiones !== null) invEstimada = mes.valor_real_inversiones
    else invEstimada += invMes
    const inversionesAcum = invEstimada

    acumCtaRem += ctaRemMes - invDesdeCtaRem
    const cuentaRemAcum = cfg.cuenta_remunerada_inicial + acumCtaRem
    const ahorroAcumulado = inversionesAcum + cuentaRemAcum
    const dineroTotal = ahorroAcumulado + saldoDisponible

    const ahorroDesdeIngresos = ahorroTotal - invDesdeCtaRem

    resultado.push({
      mes,
      nombre: nombreMes(mes.fecha),
      sumIngresos, sumGastos, ahorroTotal, invDesdeCtaRem, invMes, ctaRemMes,
      anterior, saldoCalculado, ajuste, ingresosTotales, gastosTotales, saldoDisponible,
      pctGastado, pctDisponible: 1 - pctGastado,
      neto: ingresosTotales - gastosTotales,
      inversionesAcum, cuentaRemAcum, ahorroAcumulado, dineroTotal,
      ahorroDesdeIngresos,
      pctAhorro: ingresosTotales === 0 ? null : ahorroDesdeIngresos / ingresosTotales,
      conMovimientos: ingresosTotales + gastosTotales + ahorroTotal !== 0,
    })
    anterior = saldoDisponible
  }

  const porId = new Map(resultado.map((m) => [m.mes.id, m]))

  // Historial consecutivo desde mes_inicio (o el primer mes si es anterior) hasta el último mes.
  const historial: FilaHistorial[] = []
  if (resultado.length > 0) {
    const porFecha = new Map(resultado.map((m) => [m.mes.fecha, m]))
    const desde = Math.min(indiceMes(cfg.mes_inicio), indiceMes(resultado[0].mes.fecha))
    const hasta = indiceMes(resultado[resultado.length - 1].mes.fecha)
    for (let i = desde; i <= hasta; i++) {
      const fecha = fechaDesdeIndice(i)
      const calc = porFecha.get(fecha) ?? null
      historial.push({ fecha, nombre: nombreMes(fecha), registrado: calc !== null, calc })
    }
  }

  const ultimo = resultado[resultado.length - 1]
  const saldoInicialTotal = cfg.inversiones_iniciales + cfg.cuenta_remunerada_inicial + cfg.ajuste_cuenta_gastos_inicial
  const totalInversiones = ultimo ? ultimo.inversionesAcum : cfg.inversiones_iniciales
  const totalInvertido = cfg.aportado_inicial_inversiones + suma(resultado.map((m) => m.invMes))
  const kpis: Kpis = {
    dineroTotalActual: ultimo ? ultimo.dineroTotal : saldoInicialTotal,
    saldoInicialTotal,
    ultimoMes: ultimo ? ultimo.nombre : null,
    totalInversiones,
    totalInvertido,
    gananciaInversiones: totalInversiones - totalInvertido,
    cuentaRemInicial: cfg.cuenta_remunerada_inicial,
    totalCuentaRem: ultimo ? ultimo.cuentaRemAcum : cfg.cuenta_remunerada_inicial,
  }

  return { meses: resultado, porId, historial, kpis }
}

// ---------- Resumen anual ----------

export interface FilaResumen {
  mes: number // 1..12
  calc: MesCalculado | null
}

export interface ResumenAnual {
  anio: number
  filas: FilaResumen[]
  total: {
    ingresos: Cents
    gastos: Cents
    neto: Cents
    ahorroDesdeIngresos: Cents
    pctAhorro: number | null
    saldoDisponible: Cents | null
    dineroTotal: Cents | null
  }
}

export function resumenAnual(c: Calculo, anio: number): ResumenAnual {
  const delAnio = c.meses.filter((m) => partes(m.mes.fecha).anio === anio)
  const filas: FilaResumen[] = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    calc: delAnio.find((m) => partes(m.mes.fecha).mes === i + 1) ?? null,
  }))
  const ingresos = suma(delAnio.map((m) => m.ingresosTotales))
  const gastos = suma(delAnio.map((m) => m.gastosTotales))
  const ahorroDesdeIngresos = suma(delAnio.map((m) => m.ahorroDesdeIngresos))
  const ultimo = delAnio[delAnio.length - 1]
  return {
    anio,
    filas,
    total: {
      ingresos,
      gastos,
      neto: ingresos - gastos,
      ahorroDesdeIngresos,
      pctAhorro: ingresos === 0 ? null : ahorroDesdeIngresos / ingresos,
      saldoDisponible: ultimo ? ultimo.saldoDisponible : null,
      dineroTotal: ultimo ? ultimo.dineroTotal : null,
    },
  }
}

export function aniosConMeses(c: Calculo): number[] {
  return [...new Set(c.meses.map((m) => partes(m.mes.fecha).anio))].sort((a, b) => a - b)
}

function agrupar<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of xs) {
    const k = key(x)
    const arr = m.get(k)
    if (arr) arr.push(x)
    else m.set(k, [x])
  }
  return m
}
