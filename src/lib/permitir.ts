// «¿Me lo puedo permitir?»: cómo quedaría todo si haces una compra. Es orientativo: usa tus medias
// de los últimos meses, igual que el colchón de emergencia.
import type { Cents } from './money'
import type { Calculo } from './calculos'
import { colchon } from './analisis'

export type Veredicto = 'si' | 'cuidado' | 'esperar'

export interface Simulacion {
  importe: Cents
  /** 1 = de una vez; más = a plazos (cuota mensual). */
  plazos: number
  /** Lo que pagas al principio (a plazos). */
  entrada: Cents
  /** Lo que se financia: importe − entrada. */
  financiado: Cents
  /** TAE en % (0 = sin intereses). */
  tae: number
  cuota: Cents
  /** Todo lo que acabas pagando: entrada + cuotas (o el importe, si es de una vez). */
  totalPagado: Cents
  intereses: Cents
  /** Lo que ahorras de media al mes (ingresos − gastos de los últimos meses, hasta 6). */
  ahorroMedio: Cents
  mesesUsados: number
  /** Cuántos meses de ahorro supone todo lo que pagas (null si no ahorras de media). */
  mesesDeAhorro: number | null
  /** Parte del patrimonio que supone (0–1). */
  pctPatrimonio: number | null
  colchonAntes: number | null
  /** Pagando de una vez baja todo el importe; a plazos, solo la entrada. */
  colchonDespues: number | null
  liquido: Cents
  gastoMedio: Cents
  veredicto: Veredicto
  motivo: string
}

const fmtMeses = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })} ${n >= 0.95 && n < 1.05 ? 'mes' : 'meses'}`

/**
 * Cuota mensual de un préstamo (sistema francés, el habitual en España). La TAE se pasa a interés
 * mensual equivalente: (1 + TAE)^(1/12) − 1. Sin intereses, es el importe entre los meses.
 */
export function cuotaMensual(financiado: Cents, meses: number, tae: number): Cents {
  if (financiado <= 0) return 0
  const n = Math.max(1, Math.round(meses))
  const i = Math.pow(1 + Math.max(0, tae) / 100, 1 / 12) - 1
  if (i === 0) return Math.ceil(financiado / n)
  return Math.round((financiado * i) / (1 - Math.pow(1 + i, -n)))
}

export interface OpcionesPago {
  /** TAE en % (por ejemplo, 7,5). */
  tae?: number
  /** Entrada en céntimos. */
  entrada?: Cents
}

export function simular(c: Calculo, importe: Cents, plazos = 1, { tae = 0, entrada = 0 }: OpcionesPago = {}): Simulacion {
  const col = colchon(c)
  const recientes = c.meses.filter((m) => m.conMovimientos).slice(-6)
  const ahorroMedio = recientes.length ? Math.round(recientes.reduce((a, m) => a + m.neto, 0) / recientes.length) : 0
  const aPlazos = plazos > 1
  const ent = aPlazos ? Math.min(Math.max(0, entrada), importe) : importe
  const financiado = aPlazos ? importe - ent : 0
  const cuota = aPlazos ? cuotaMensual(financiado, plazos, tae) : importe
  const totalPagado = aPlazos ? ent + cuota * Math.round(plazos) : importe
  const intereses = totalPagado - importe
  const mesesDeAhorro = ahorroMedio > 0 ? totalPagado / ahorroMedio : null
  const patrimonio = c.kpis.dineroTotalActual
  const colchonAntes = col.meses
  // Lo que sale ya de tus cuentas: todo (de una vez) o la entrada (a plazos)
  const salidaInicial = aPlazos ? ent : importe
  const colchonDespues = col.gastoMedio > 0 ? Math.max(0, col.liquido - salidaInicial) / col.gastoMedio : null
  const pctCuota = ahorroMedio > 0 ? Math.round((cuota / ahorroMedio) * 100) : null

  let veredicto: Veredicto
  let motivo: string
  if (salidaInicial > col.liquido) {
    veredicto = 'esperar'
    motivo = aPlazos
      ? 'La entrada es más de lo que tienes disponible ahora (saldo + cuenta remunerada).'
      : 'Cuesta más de lo que tienes disponible ahora (saldo + cuenta remunerada).'
  } else if (colchonDespues !== null && colchonDespues < 3) {
    veredicto = 'esperar'
    motivo = `Tu colchón bajaría a ${fmtMeses(colchonDespues)}${aPlazos ? ' al pagar la entrada' : ''}: por debajo de 3 meses es arriesgado.`
  } else if (aPlazos && financiado > 0 && ahorroMedio <= 0) {
    veredicto = 'esperar'
    motivo = 'De media no te sobra dinero a final de mes, así que la cuota saldría de tus ahorros.'
  } else if (aPlazos && financiado > 0 && cuota > ahorroMedio) {
    veredicto = 'esperar'
    motivo = 'La cuota es más de lo que ahorras al mes: tendrías que tirar de ahorros cada mes.'
  } else if (aPlazos && financiado > 0 && cuota > ahorroMedio * 0.5) {
    veredicto = 'cuidado'
    motivo = `La cuota se come el ${pctCuota} % de lo que ahorras al mes durante ${fmtMeses(plazos)}.`
  } else if (colchonDespues !== null && colchonDespues < 6) {
    veredicto = 'cuidado'
    motivo = `Puedes, pero tu colchón bajaría a ${fmtMeses(colchonDespues)} (lo recomendable son 6).`
  } else if (!aPlazos && mesesDeAhorro !== null && mesesDeAhorro > 3) {
    veredicto = 'cuidado'
    motivo = `Puedes, pero equivale a ${fmtMeses(mesesDeAhorro)} de ahorro.`
  } else {
    veredicto = 'si'
    motivo = aPlazos && financiado > 0
      ? `La cuota es el ${pctCuota} % de lo que ahorras al mes${colchonDespues !== null ? ` y tu colchón seguiría en ${fmtMeses(colchonDespues)}` : ''}.`
      : colchonDespues !== null ? `Tu colchón seguiría en ${fmtMeses(colchonDespues)}.` : 'Tienes dinero disponible de sobra.'
  }
  if (aPlazos && intereses > 0 && veredicto !== 'esperar' && mesesDeAhorro !== null && intereses > ahorroMedio) {
    motivo += ' Ojo: los intereses suman más de un mes de tu ahorro.'
  }

  return {
    importe,
    plazos,
    entrada: aPlazos ? ent : 0,
    financiado,
    tae: aPlazos ? tae : 0,
    cuota,
    totalPagado,
    intereses,
    ahorroMedio,
    mesesUsados: recientes.length,
    mesesDeAhorro,
    pctPatrimonio: patrimonio > 0 ? totalPagado / patrimonio : null,
    colchonAntes,
    colchonDespues,
    liquido: col.liquido,
    gastoMedio: col.gastoMedio,
    veredicto,
    motivo,
  }
}
