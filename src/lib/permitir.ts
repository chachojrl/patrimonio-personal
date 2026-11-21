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
  cuota: Cents
  /** Lo que ahorras de media al mes (ingresos − gastos de los últimos meses, hasta 6). */
  ahorroMedio: Cents
  mesesUsados: number
  /** Cuántos meses de ahorro supone la compra (null si no ahorras de media). */
  mesesDeAhorro: number | null
  /** Parte del patrimonio que supone (0–1). */
  pctPatrimonio: number | null
  colchonAntes: number | null
  /** Pagando de una vez, el colchón baja; a plazos se queda igual. */
  colchonDespues: number | null
  liquido: Cents
  gastoMedio: Cents
  veredicto: Veredicto
  motivo: string
}

const fmtMeses = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })} ${n >= 0.95 && n < 1.05 ? 'mes' : 'meses'}`

export function simular(c: Calculo, importe: Cents, plazos = 1): Simulacion {
  const col = colchon(c)
  const recientes = c.meses.filter((m) => m.conMovimientos).slice(-6)
  const ahorroMedio = recientes.length ? Math.round(recientes.reduce((a, m) => a + m.neto, 0) / recientes.length) : 0
  const cuota = Math.ceil(importe / Math.max(1, plazos))
  const mesesDeAhorro = ahorroMedio > 0 ? importe / ahorroMedio : null
  const patrimonio = c.kpis.dineroTotalActual
  const colchonAntes = col.meses
  const colchonDespues = col.gastoMedio > 0 ? Math.max(0, col.liquido - (plazos > 1 ? 0 : importe)) / col.gastoMedio : null

  let veredicto: Veredicto
  let motivo: string
  if (plazos > 1) {
    // A plazos: lo que importa es si la cuota cabe en lo que ahorras cada mes
    if (ahorroMedio <= 0) {
      veredicto = 'esperar'
      motivo = 'De media no te sobra dinero a final de mes, así que la cuota saldría de tus ahorros.'
    } else if (cuota <= ahorroMedio * 0.5) {
      veredicto = 'si'
      motivo = `La cuota es menos de la mitad de lo que ahorras al mes (${Math.round((cuota / ahorroMedio) * 100)} %).`
    } else if (cuota <= ahorroMedio) {
      veredicto = 'cuidado'
      motivo = `La cuota se come el ${Math.round((cuota / ahorroMedio) * 100)} % de lo que ahorras al mes durante ${plazos} meses.`
    } else {
      veredicto = 'esperar'
      motivo = 'La cuota es más de lo que ahorras al mes: tendrías que tirar de ahorros cada mes.'
    }
  } else if (importe > col.liquido) {
    veredicto = 'esperar'
    motivo = 'Cuesta más de lo que tienes disponible ahora (saldo + cuenta remunerada).'
  } else if (colchonDespues !== null && colchonDespues < 3) {
    veredicto = 'esperar'
    motivo = `Tu colchón bajaría a ${fmtMeses(colchonDespues)}: por debajo de 3 meses es arriesgado.`
  } else if ((colchonDespues !== null && colchonDespues < 6) || (mesesDeAhorro !== null && mesesDeAhorro > 3)) {
    veredicto = 'cuidado'
    motivo = colchonDespues !== null && colchonDespues < 6
      ? `Puedes, pero tu colchón bajaría a ${fmtMeses(colchonDespues)} (lo recomendable son 6).`
      : `Puedes, pero equivale a ${fmtMeses(mesesDeAhorro!)} de ahorro.`
  } else {
    veredicto = 'si'
    motivo = colchonDespues !== null ? `Tu colchón seguiría en ${fmtMeses(colchonDespues)}.` : 'Tienes dinero disponible de sobra.'
  }

  return {
    importe,
    plazos,
    cuota,
    ahorroMedio,
    mesesUsados: recientes.length,
    mesesDeAhorro,
    pctPatrimonio: patrimonio > 0 ? importe / patrimonio : null,
    colchonAntes,
    colchonDespues,
    liquido: col.liquido,
    gastoMedio: col.gastoMedio,
    veredicto,
    motivo,
  }
}
