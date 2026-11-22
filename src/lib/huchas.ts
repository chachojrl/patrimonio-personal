// Huchas: objetivos de ahorro. Módulo PURO (sin React ni base de datos).
// Una hucha RESERVA parte de tu dinero: no lo mueve, así que el dinero total no cambia.
import type { Cents } from './money'
import type { Calculo } from './calculos'
import type { CuentaDinero, Datos, Hucha, MovimientoHucha } from './tipos'
import { fechaDesdeIndice, indiceMes } from './fechas'

export interface EstadoHucha {
  hucha: Hucha
  /** Lo que hay dentro ahora (suma de lo metido menos lo sacado). */
  saldo: Cents
  /** Lo que falta para el objetivo (0 si ya se llegó). */
  falta: Cents
  /** De 0 a 1 (puede pasar de 1 si se metió de más). null si el objetivo es 0. */
  pct: number | null
  /** ¿Ya hay lo del objetivo? */
  llena: boolean
  /** Mes en que se llegaría con la aportación mensual (primer día). null si no hay aportación o ya está llena. */
  mesEstimado: string | null
  /** Meses que faltan hasta la fecha límite (contando el actual). null sin fecha límite. */
  mesesHastaLimite: number | null
  /** Lo que habría que meter cada mes para llegar a la fecha límite. null sin fecha límite o si ya está llena. */
  necesarioAlMes: Cents | null
  /** ¿Con la aportación mensual prevista no se llega a la fecha límite? */
  noLlega: boolean
  movimientos: MovimientoHucha[]
}

const suma = (xs: Cents[]) => xs.reduce((a, b) => a + b, 0)

export function saldoHucha(id: string, movs: MovimientoHucha[]): Cents {
  return suma(movs.filter((m) => m.hucha_id === id).map((m) => m.importe))
}

/** Estado de una hucha. «hoy» es el primer día del mes en curso ("2026-11-01"). */
export function estadoHucha(h: Hucha, movs: MovimientoHucha[], hoy: string): EstadoHucha {
  const propios = movs.filter((m) => m.hucha_id === h.id).sort((a, b) => b.fecha.localeCompare(a.fecha))
  const saldo = suma(propios.map((m) => m.importe))
  const falta = Math.max(0, h.objetivo - saldo)
  const pct = h.objetivo > 0 ? Math.max(0, saldo) / h.objetivo : null
  const llena = h.objetivo > 0 && saldo >= h.objetivo

  // Con la aportación mensual: si este mes aún no se ha metido, cuenta desde este mes
  const yaEsteMes = propios.some((m) => m.mes === hoy)
  const ap = h.aportacion_mensual ?? 0
  let mesEstimado: string | null = null
  if (!llena && ap > 0) {
    const meses = Math.ceil(falta / ap)
    mesEstimado = fechaDesdeIndice(indiceMes(hoy) + meses - (yaEsteMes ? 0 : 1))
  }

  let mesesHastaLimite: number | null = null
  let necesarioAlMes: Cents | null = null
  let noLlega = false
  if (h.fecha_objetivo) {
    const limite = `${h.fecha_objetivo.slice(0, 7)}-01`
    // Meses en los que aún se puede meter dinero: desde este (si no se ha metido ya) hasta el de la fecha límite
    mesesHastaLimite = Math.max(0, indiceMes(limite) - indiceMes(hoy) + (yaEsteMes ? 0 : 1))
    if (!llena) {
      necesarioAlMes = mesesHastaLimite > 0 ? Math.ceil(falta / mesesHastaLimite) : falta
      noLlega = mesEstimado === null ? true : mesEstimado > limite
    }
  }

  return { hucha: h, saldo, falta, pct, llena, mesEstimado, mesesHastaLimite, necesarioAlMes, noLlega, movimientos: propios }
}

export function estadosHuchas(d: Pick<Datos, 'huchas' | 'hucha_movimientos'>, hoy: string): EstadoHucha[] {
  return [...d.huchas]
    .sort((a, b) => Number(!!a.conseguida_en) - Number(!!b.conseguida_en) || a.orden - b.orden || a.nombre.localeCompare(b.nombre))
    .map((h) => estadoHucha(h, d.hucha_movimientos, hoy))
}

export interface DineroLibre {
  total: Cents
  reservado: Cents
  libre: Cents
  /** Por cuenta: lo que hay, lo reservado en huchas de esa cuenta y lo libre. */
  porCuenta: Record<CuentaDinero, { hay: Cents; reservado: Cents; libre: Cents }>
  /** Reservado en huchas sin cuenta. */
  sinCuenta: Cents
}

/** Lo que hay en cada cuenta según el último mes (o el punto de partida si aún no hay meses). */
export function dineroPorCuenta(calc: Calculo, d: Pick<Datos, 'config'>): Record<CuentaDinero, Cents> {
  const u = calc.meses[calc.meses.length - 1]
  return {
    gastos: u ? u.saldoDisponible : d.config.ajuste_cuenta_gastos_inicial,
    remunerada: calc.kpis.totalCuentaRem,
    inversiones: calc.kpis.totalInversiones,
  }
}

/** Dinero libre = dinero total − lo reservado en huchas en curso (las conseguidas ya no reservan si están vacías). */
export function dineroLibre(calc: Calculo, d: Pick<Datos, 'config' | 'huchas' | 'hucha_movimientos'>): DineroLibre {
  const hay = dineroPorCuenta(calc, d)
  const res: Record<CuentaDinero, Cents> = { gastos: 0, remunerada: 0, inversiones: 0 }
  let sinCuenta = 0
  for (const h of d.huchas) {
    const s = Math.max(0, saldoHucha(h.id, d.hucha_movimientos))
    if (h.cuenta) res[h.cuenta] += s
    else sinCuenta += s
  }
  const reservado = res.gastos + res.remunerada + res.inversiones + sinCuenta
  const total = calc.kpis.dineroTotalActual
  const porCuenta = Object.fromEntries(
    (['gastos', 'remunerada', 'inversiones'] as const).map((c) => [c, { hay: hay[c], reservado: res[c], libre: hay[c] - res[c] }]),
  ) as DineroLibre['porCuenta']
  return { total, reservado, libre: total - reservado, porCuenta, sinCuenta }
}

/**
 * ¿Se puede meter este importe en la hucha sin reservar más de lo que hay?
 * Devuelve el texto del problema, o null si se puede.
 */
export function problemaAlMeter(calc: Calculo, d: Pick<Datos, 'config' | 'huchas' | 'hucha_movimientos'>, h: Hucha, importe: Cents): string | null {
  if (importe <= 0) return null
  const l = dineroLibre(calc, d)
  if (importe > l.libre) return `Solo tienes ${fmt(Math.max(0, l.libre))} sin reservar en otras huchas.`
  if (h.cuenta) {
    const c = l.porCuenta[h.cuenta]
    if (importe > c.libre) return `En ${NOMBRE_CUENTA[h.cuenta].toLowerCase()} solo quedan ${fmt(Math.max(0, c.libre))} sin reservar.`
  }
  return null
}

export const NOMBRE_CUENTA: Record<CuentaDinero, string> = {
  gastos: 'Cuenta de gastos',
  remunerada: 'Cuenta remunerada',
  inversiones: 'Inversiones',
}

const fmt = (c: Cents) => `${(c / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

export interface PropuestaCierre {
  hucha: Hucha
  importe: Cents
}

/** Huchas con aportación mensual que aún no tienen la de este mes (para «Cerrar mes…»). */
export function propuestasCierre(d: Pick<Datos, 'huchas' | 'hucha_movimientos'>, mes: string, hoy: string): PropuestaCierre[] {
  return d.huchas
    .filter((h) => !h.conseguida_en && (h.aportacion_mensual ?? 0) > 0)
    .filter((h) => !d.hucha_movimientos.some((m) => m.hucha_id === h.id && m.mes === mes))
    .map((h) => {
      const e = estadoHucha(h, d.hucha_movimientos, hoy)
      // No proponer más de lo que falta
      return { hucha: h, importe: Math.min(h.aportacion_mensual!, e.falta) }
    })
    .filter((p) => p.importe > 0)
    .sort((a, b) => a.hucha.orden - b.hucha.orden)
}
