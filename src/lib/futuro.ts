// Futuro: proyección del patrimonio y número de libertad financiera. Módulo PURO.
// Todo en céntimos. Nada de esto se guarda: se calcula con tus meses y tus ajustes.
import type { Cents } from './money'
import type { Calculo, MesCalculado } from './calculos'
import { interesesEstimados, taeDelMes } from './calculos'
import type { Config, Datos } from './tipos'
import { fechaDesdeIndice, indiceMes } from './fechas'
import { normalizar } from './buscar'

/** Meses de historia que se usan para las medias (los últimos con movimientos). */
export const MESES_MEDIA = 12

export interface Base {
  /** Primer día del mes desde el que se proyecta (el siguiente al último registrado). */
  desde: string
  gastos: Cents
  remunerada: Cents
  inversiones: Cents
  /** Media mensual de ingresos − gastos. */
  netoMedio: Cents
  /** Media mensual que va a inversiones y a la cuenta remunerada (lo demás se queda en la cuenta de gastos). */
  aInversiones: Cents
  aRemunerada: Cents
  /** Meses con los que se han hecho las medias. */
  mesesMedia: number
}

function ultimosConMovimientos(calc: Calculo, n = MESES_MEDIA): MesCalculado[] {
  return calc.meses.filter((m) => m.conMovimientos).slice(-n)
}

const media = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0)

/** Punto de partida: lo que tienes hoy en cada cuenta y lo que sueles ahorrar al mes. */
export function base(calc: Calculo, d: Pick<Datos, 'config'>): Base {
  const u = calc.meses[calc.meses.length - 1]
  const ult = ultimosConMovimientos(calc)
  return {
    desde: u ? fechaDesdeIndice(indiceMes(u.mes.fecha) + 1) : d.config.mes_inicio,
    gastos: u ? u.saldoDisponible : d.config.ajuste_cuenta_gastos_inicial,
    remunerada: calc.kpis.totalCuentaRem,
    inversiones: calc.kpis.totalInversiones,
    netoMedio: media(ult.map((m) => m.neto)),
    aInversiones: media(ult.map((m) => m.invMes)),
    // Lo que entra en la remunerada desde la cuenta de gastos (sin contar lo que pasa de la remunerada a inversiones)
    aRemunerada: media(ult.map((m) => m.ctaRemMes - m.invDesdeCtaRem)),
    mesesMedia: ult.length,
  }
}

export interface Parametros {
  /** Rentabilidad anual de las inversiones (%). */
  rentabilidad: number
  /** Ahorro extra al mes, que se invierte (céntimos). */
  extra: Cents
  /** Inflación anual (%) para pasar a euros de hoy. */
  inflacion: number
}

export interface PuntoProyeccion {
  /** Meses desde hoy (0 = ahora). */
  t: number
  fecha: string
  gastos: Cents
  remunerada: Cents
  inversiones: Cents
  total: Cents
  /** El total en euros de hoy (descontando la inflación). */
  totalReal: Cents
  /** Lo que habrás metido tú desde hoy (sin rentabilidad). */
  aportado: Cents
}

/**
 * Proyección mes a mes durante «meses» meses:
 * - inversiones: crecen a la rentabilidad anual (equivalente mensual) y reciben su aportación media + el extra;
 * - cuenta remunerada: genera los intereses netos con tu TAE y recibe su aportación media;
 * - cuenta de gastos: recibe el resto del ahorro, sin intereses.
 */
export function proyectar(b: Base, cfg: Pick<Config, 'tae_cuenta_rem' | 'retencion_intereses'>, p: Parametros, meses: number): PuntoProyeccion[] {
  const rMes = Math.pow(1 + p.rentabilidad / 100, 1 / 12) - 1
  const infMes = Math.pow(1 + p.inflacion / 100, 1 / 12)
  const resto = b.netoMedio - b.aInversiones - b.aRemunerada
  let { gastos, remunerada, inversiones } = b
  let aportado = 0
  const puntos: PuntoProyeccion[] = []
  const punto = (t: number) => {
    const total = gastos + remunerada + inversiones
    puntos.push({ t, fecha: fechaDesdeIndice(indiceMes(b.desde) + t), gastos, remunerada, inversiones, total, totalReal: Math.round(total / Math.pow(infMes, t)), aportado })
  }
  punto(0)
  for (let t = 1; t <= meses; t++) {
    const fecha = fechaDesdeIndice(indiceMes(b.desde) + t - 1)
    remunerada += interesesEstimados(remunerada, taeDelMes(cfg, fecha), cfg.retencion_intereses)
    inversiones = Math.round(inversiones * (1 + rMes))
    inversiones += b.aInversiones + p.extra
    remunerada += b.aRemunerada
    gastos += resto
    aportado += b.netoMedio + p.extra
    punto(t)
  }
  return puntos
}

/** Escenarios: el normal con tu rentabilidad, y uno pesimista y otro optimista (2 puntos menos y más). */
export function escenarios(b: Base, cfg: Pick<Config, 'tae_cuenta_rem' | 'retencion_intereses'>, p: Parametros, meses: number) {
  return {
    pesimista: proyectar(b, cfg, { ...p, rentabilidad: p.rentabilidad - 2 }, meses),
    normal: proyectar(b, cfg, p, meses),
    optimista: proyectar(b, cfg, { ...p, rentabilidad: p.rentabilidad + 2 }, meses),
  }
}

// ---------------- Libertad financiera ----------------

export interface ConceptoGasto {
  clave: string // normalizado
  concepto: string
  /** Media al mes en los meses de la media. */
  medioMes: Cents
}

/** Conceptos de gasto de los últimos meses con su media mensual (de mayor a menor). */
export function conceptosRecientes(calc: Calculo, d: Pick<Datos, 'expenses'>): ConceptoGasto[] {
  const ult = ultimosConMovimientos(calc)
  if (ult.length === 0) return []
  const ids = new Set(ult.map((m) => m.mes.id))
  const porClave = new Map<string, { concepto: string; total: Cents }>()
  for (const g of d.expenses) {
    if (!ids.has(g.month_id) || g.aportacion_cuenta) continue
    const k = normalizar(g.concepto)
    if (!k) continue
    const x = porClave.get(k) ?? { concepto: g.concepto.trim(), total: 0 }
    x.total += g.importe
    porClave.set(k, x)
  }
  return [...porClave.entries()]
    .map(([clave, x]) => ({ clave, concepto: x.concepto, medioMes: Math.round(x.total / ult.length) }))
    .filter((x) => x.medioMes > 0)
    .sort((a, b) => b.medioMes - a.medioMes)
}

export interface Libertad {
  /** Lo que gastas al año (media de los últimos meses × 12), sin los conceptos que quitaste. */
  gastoAnual: Cents
  /** Lo que quitaste por conceptos excluidos (al año). */
  excluidoAnual: Cents
  /** Patrimonio necesario: gasto anual ÷ % de retirada. */
  numero: Cents
  /** Tu patrimonio de hoy. */
  patrimonio: Cents
  /** De 0 a 1 (puede pasar de 1). */
  progreso: number
  /** Mes estimado en que llegarías (en euros de hoy), según la proyección normal; null si no se llega en el plazo. */
  fecha: string | null
  /** Meses que faltan (null si no se llega en el plazo). */
  meses: number | null
}

export function libertadFinanciera(calc: Calculo, d: Pick<Datos, 'config' | 'expenses'>, proyeccion: PuntoProyeccion[]): Libertad | null {
  const ult = ultimosConMovimientos(calc)
  if (ult.length === 0) return null
  const gastoMes = media(ult.map((m) => m.gastosTotales))
  const excluidos = new Set(d.config.fire_excluidos ?? [])
  const excluidoMes = conceptosRecientes(calc, d).filter((c) => excluidos.has(c.clave)).reduce((a, c) => a + c.medioMes, 0)
  const gastoAnual = Math.max(0, gastoMes - excluidoMes) * 12
  const pct = d.config.pct_retirada > 0 ? d.config.pct_retirada : 4
  const numero = Math.round(gastoAnual / (pct / 100))
  const patrimonio = calc.kpis.dineroTotalActual
  const llegada = numero > 0 ? proyeccion.find((p) => p.totalReal >= numero) : proyeccion[0]
  return {
    gastoAnual,
    excluidoAnual: excluidoMes * 12,
    numero,
    patrimonio,
    progreso: numero > 0 ? patrimonio / numero : 1,
    fecha: llegada ? llegada.fecha : null,
    meses: llegada ? llegada.t : null,
  }
}

/** Primer punto de la proyección que llega a una cantidad (en euros corrientes). */
export function cuandoLlega(proyeccion: PuntoProyeccion[], cantidad: Cents): PuntoProyeccion | null {
  return proyeccion.find((p) => p.total >= cantidad) ?? null
}
