// Futuro: proyección del patrimonio y número de libertad financiera. Módulo PURO.
// Todo en céntimos. Nada de esto se guarda: se calcula con tus meses y tus ajustes.
import type { Cents } from './money'
import type { Calculo, MesCalculado } from './calculos'
import { interesesEstimados, taeDelMes } from './calculos'
import type { Config, Datos, EventoFuturo } from './tipos'

export type { EventoFuturo }
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
  /** Lo que has metido tú en las inversiones (para saber cuánto es ganancia al vender). Sin él, todo lo de hoy cuenta como aportado. */
  costeInversiones?: Cents
  /** Media mensual de ingresos − gastos. */
  netoMedio: Cents
  /** Media mensual que va a inversiones y a la cuenta remunerada (lo demás se queda en la cuenta de gastos). */
  aInversiones: Cents
  aRemunerada: Cents
  /** Meses con los que se han hecho las medias. */
  mesesMedia: number
  /** ¿Lo que va a inversiones lo escribiste tú (true) o es la media de los últimos meses? */
  inversionManual?: boolean
}

function ultimosConMovimientos(calc: Calculo, n = MESES_MEDIA): MesCalculado[] {
  return calc.meses.filter((m) => m.conMovimientos).slice(-n)
}

const media = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0)

/**
 * Punto de partida: lo que tienes hoy en cada cuenta y lo que sueles ahorrar al mes.
 * Lo que va a inversiones y a la remunerada es la media de los últimos meses, pero nunca negativa ni, entre las dos,
 * más de lo que ahorras (ingresos − gastos): un traspaso puntual (sacar de la remunerada para invertir) no es ahorro
 * que se repita cada mes. Si escribiste lo que inviertes al mes (config.inversion_mensual), se usa eso.
 */
export function base(calc: Calculo, d: Pick<Datos, 'config'>): Base {
  const u = calc.meses[calc.meses.length - 1]
  const ult = ultimosConMovimientos(calc)
  const netoMedio = media(ult.map((m) => m.neto))
  let aInv = Math.max(0, media(ult.map((m) => m.invMes)))
  // Lo que entra en la remunerada desde la cuenta de gastos (sin contar lo que pasa de la remunerada a inversiones)
  let aRem = Math.max(0, media(ult.map((m) => m.ctaRemMes - m.invDesdeCtaRem)))
  const tope = Math.max(0, netoMedio)
  if (aInv + aRem > tope) {
    const k = aInv + aRem > 0 ? tope / (aInv + aRem) : 0
    aInv = Math.round(aInv * k)
    aRem = Math.round(aRem * k)
  }
  const manual = d.config.inversion_mensual
  return {
    desde: u ? fechaDesdeIndice(indiceMes(u.mes.fecha) + 1) : d.config.mes_inicio,
    gastos: u ? u.saldoDisponible : d.config.ajuste_cuenta_gastos_inicial,
    remunerada: calc.kpis.totalCuentaRem,
    inversiones: calc.kpis.totalInversiones,
    costeInversiones: calc.kpis.totalInvertido,
    netoMedio,
    aInversiones: manual != null && manual >= 0 ? manual : aInv,
    aRemunerada: aRem,
    mesesMedia: ult.length,
    inversionManual: manual != null && manual >= 0,
  }
}

// ---------------- Cambios previstos ----------------

export type TipoEvento = EventoFuturo['tipo']

export const TIPOS_EVENTO: Record<TipoEvento, { texto: string; mensual: boolean; ejemplo: string }> = {
  gasto_unico: { texto: 'Compra o gasto puntual', mensual: false, ejemplo: 'Coche, reforma, boda…' },
  ingreso_unico: { texto: 'Ingreso puntual', mensual: false, ejemplo: 'Herencia, venta de un piso…' },
  gasto_nuevo: { texto: 'Gasto nuevo al mes', mensual: true, ejemplo: 'Guardería, alquiler…' },
  gasto_fin: { texto: 'Dejas de pagar algo', mensual: true, ejemplo: 'Fin de la hipoteca…' },
  sueldo: { texto: 'Cambio de sueldo', mensual: true, ejemplo: 'Subida, media jornada (en negativo)…' },
  pension: { texto: 'Pensión o renta', mensual: true, ejemplo: 'Pensión pública, alquiler que cobras…' },
  inversion: { texto: 'Cambias lo que inviertes', mensual: true, ejemplo: 'Invertir menos, de 1.200 € a 500 €…' },
}

const activo = (e: EventoFuturo, fecha: string) => e.desde <= fecha && (e.hasta == null || fecha <= e.hasta)

/** Cuánto cambia el ahorro de un mes por los cambios mensuales (en euros de hoy). */
function cambioAhorroMes(eventos: EventoFuturo[], fecha: string): Cents {
  let x = 0
  for (const e of eventos) {
    if (!TIPOS_EVENTO[e.tipo]?.mensual || e.tipo === 'inversion' || !activo(e, fecha) || e.fijo) continue
    x += e.tipo === 'gasto_nuevo' ? -e.importe : e.importe
  }
  return x
}

/** Lo que pasas a invertir cada mes según tus planes (en euros de hoy); null si ningún plan lo cambia ese mes. El más reciente manda. */
function inversionPlaneada(eventos: EventoFuturo[], fecha: string): Cents | null {
  let elegido: EventoFuturo | null = null
  for (const e of eventos) if (e.tipo === 'inversion' && activo(e, fecha) && (!elegido || e.desde >= elegido.desde)) elegido = e
  return elegido ? Math.max(0, elegido.importe) : null
}

/** Cuotas fijas (sin inflación) de ese mes. */
function cuotasFijas(eventos: EventoFuturo[], fecha: string): Cents {
  let x = 0
  for (const e of eventos) if (e.fijo && activo(e, fecha)) x += e.importe
  return x
}

/** Cuánto cambian los gastos que tendrías que cubrir al vivir de tus ahorros (al mes, en euros de hoy). Las pensiones restan. */
export function cambioNecesidadMes(eventos: EventoFuturo[], fecha: string): Cents {
  let x = 0
  for (const e of eventos) {
    if (!activo(e, fecha) || e.fijo) continue
    if (e.tipo === 'gasto_nuevo') x += e.importe
    else if (e.tipo === 'gasto_fin' || e.tipo === 'pension') x -= e.importe
  }
  return x
}

/** Los puntuales de ese mes (en euros de hoy, con signo). */
function puntualesMes(eventos: EventoFuturo[], fecha: string): Cents {
  let x = 0
  for (const e of eventos) {
    if (e.desde !== fecha) continue
    if (e.tipo === 'gasto_unico') x -= e.importe
    else if (e.tipo === 'ingreso_unico') x += e.importe
  }
  return x
}

// ---------------- Impuestos ----------------

/** Tramos del IRPF del ahorro (base del ahorro, desde 2025): hasta cada importe (céntimos), el %. */
export const TRAMOS_AHORRO: [number, number][] = [[600000, 19], [5000000, 21], [20000000, 23], [30000000, 27], [Infinity, 30]]

/** IRPF por una ganancia (céntimos) de una vez. */
export function impuestoAhorro(ganancia: Cents): Cents {
  if (ganancia <= 0) return 0
  let resto = ganancia
  let previo = 0
  let total = 0
  for (const [hasta, pct] of TRAMOS_AHORRO) {
    const tramo = Math.min(resto, hasta - previo)
    total += (tramo * pct) / 100
    resto -= tramo
    previo = hasta
    if (resto <= 0) break
  }
  return Math.round(total)
}

// ---------------- Proyección ----------------

export interface Parametros {
  /** Rentabilidad anual de las inversiones (%), antes de comisiones. */
  rentabilidad: number
  /** Ahorro extra al mes, que se invierte (céntimos, en euros de hoy). */
  extra: Cents
  /** Inflación anual (%) para pasar a euros de hoy y actualizar los cambios previstos. */
  inflacion: number
  /** Cuánto sube al año lo que ahorras cada mes (%), por ejemplo con las subidas de sueldo. 0 = siempre lo mismo. */
  crecimiento?: number
  /** Comisiones anuales de los fondos (%), que se restan de la rentabilidad. */
  comision?: number
  /** Lo que sobra cada mes (lo que no va a inversiones ni a la remunerada) se invierte en vez de quedarse en la cuenta de gastos. */
  invertirSobrante?: boolean
  eventos?: EventoFuturo[]
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
  /** Lo que habrás puesto en las inversiones en total (incluido lo de antes de hoy). */
  costeInversiones: Cents
  /** IRPF si vendieras todas las inversiones ese mes. */
  impuestos: Cents
}

/** Rentabilidad mensual equivalente, ya sin comisiones. */
export const rentMensual = (p: Pick<Parametros, 'rentabilidad' | 'comision'>) => Math.pow(1 + (p.rentabilidad - (p.comision ?? 0)) / 100, 1 / 12) - 1

/** Lo que no cambia entre simulaciones: fechas, intereses y aportaciones de cada mes (índice t − 1). */
interface Flujos {
  fechas: string[] // t = 0..meses
  tasaRem: Float64Array
  neto: Float64Array
  aInv: Float64Array
  aRem: Float64Array
  extra: Float64Array
  puntual: Float64Array
}

function prepararFlujos(b: Base, cfg: Pick<Config, 'tae_cuenta_rem' | 'retencion_intereses'>, p: Parametros, meses: number): Flujos {
  const infMes = Math.pow(1 + p.inflacion / 100, 1 / 12)
  const creMes = Math.pow(1 + (p.crecimiento ?? 0) / 100, 1 / 12)
  const eventos = p.eventos ?? []
  const i0 = indiceMes(b.desde)
  const f: Flujos = {
    fechas: [], tasaRem: new Float64Array(meses), neto: new Float64Array(meses), aInv: new Float64Array(meses),
    aRem: new Float64Array(meses), extra: new Float64Array(meses), puntual: new Float64Array(meses),
  }
  for (let t = 0; t <= meses; t++) f.fechas.push(fechaDesdeIndice(i0 + t))
  let cre = 1
  let inf = 1
  for (let k = 0; k < meses; k++) {
    const fecha = f.fechas[k]
    // Intereses netos de un mes sobre 1 céntimo (como interesesEstimados)
    f.tasaRem[k] = interesesEstimados(1e9, taeDelMes(cfg, fecha), cfg.retencion_intereses) / 1e9
    f.neto[k] = Math.round(b.netoMedio * cre) + (eventos.length ? Math.round(cambioAhorroMes(eventos, fecha) * inf) - cuotasFijas(eventos, fecha) : 0)
    const plan = eventos.length ? inversionPlaneada(eventos, fecha) : null
    f.aInv[k] = plan !== null ? Math.round(plan * inf) : Math.round(b.aInversiones * cre)
    f.aRem[k] = Math.round(b.aRemunerada * cre)
    f.extra[k] = Math.round(p.extra * cre)
    f.puntual[k] = eventos.length ? Math.round(puntualesMes(eventos, fecha) * inf) : 0
    cre *= creMes
    inf *= infMes
  }
  return f
}

/** Estado de las cuentas en un mes de una proyección (se reutiliza para no crear objetos en la simulación). */
interface Estado { t: number; gastos: number; remunerada: number; inversiones: number; coste: number; aportado: number }

/** Avanza la proyección mes a mes y llama a «cada» en cada mes (también en t = 0). */
function correr(b: Base, f: Flujos, meses: number, invertirSobrante: boolean, rendimiento: (k: number) => number, cada: (e: Estado) => boolean | void) {
  const e: Estado = { t: 0, gastos: b.gastos, remunerada: b.remunerada, inversiones: b.inversiones, coste: b.costeInversiones ?? b.inversiones, aportado: 0 }
  if (cada(e) === true) return
  for (let k = 0; k < meses; k++) {
    e.t = k + 1
    if (e.remunerada > 0 && f.tasaRem[k] > 0) e.remunerada += Math.round(e.remunerada * f.tasaRem[k])
    e.inversiones = Math.round(e.inversiones * (1 + rendimiento(k)))
    const resto = f.neto[k] - f.aInv[k] - f.aRem[k]
    e.inversiones += f.aInv[k] + f.extra[k]; e.coste += f.aInv[k] + f.extra[k]
    e.remunerada += f.aRem[k]
    // La remunerada no puede quedar en negativo: lo que falte sale de la cuenta de gastos
    if (e.remunerada < 0) { e.gastos += e.remunerada; e.remunerada = 0 }
    if (invertirSobrante && resto > 0) { e.inversiones += resto; e.coste += resto } else e.gastos += resto
    const puntual = f.puntual[k]
    e.aportado += f.neto[k] + f.extra[k] + puntual
    if (puntual > 0) {
      if (invertirSobrante) { e.inversiones += puntual; e.coste += puntual } else e.gastos += puntual
    } else if (puntual < 0) {
      // Se paga primero con la cuenta de gastos, luego con la remunerada y, si no basta, vendiendo inversiones
      let falta = -puntual
      const deGastos = Math.min(falta, Math.max(0, e.gastos)); e.gastos -= deGastos; falta -= deGastos
      const deRem = Math.min(falta, Math.max(0, e.remunerada)); e.remunerada -= deRem; falta -= deRem
      const deInv = Math.min(falta, Math.max(0, e.inversiones))
      if (deInv > 0) { e.coste = Math.round(e.coste * (1 - deInv / e.inversiones)); e.inversiones -= deInv; falta -= deInv }
      e.gastos -= falta
    }
    if (cada(e) === true) return
  }
}

/**
 * Proyección mes a mes durante «meses» meses:
 * - inversiones: crecen a la rentabilidad anual (menos comisiones) y reciben su aportación media + el extra;
 * - cuenta remunerada: genera los intereses netos con tu TAE y recibe su aportación media;
 * - cuenta de gastos: recibe el resto del ahorro, sin intereses (o se invierte, con «invertirSobrante»);
 * - lo que ahorras sube cada año un «crecimiento» %; los cambios previstos se actualizan con la inflación.
 */
export function proyectar(b: Base, cfg: Pick<Config, 'tae_cuenta_rem' | 'retencion_intereses'>, p: Parametros, meses: number): PuntoProyeccion[] {
  const f = prepararFlujos(b, cfg, p, meses)
  const rMes = rentMensual(p)
  const infMes = Math.pow(1 + p.inflacion / 100, 1 / 12)
  const puntos: PuntoProyeccion[] = []
  correr(b, f, meses, !!p.invertirSobrante, () => rMes, (e) => {
    const total = e.gastos + e.remunerada + e.inversiones
    puntos.push({
      t: e.t, fecha: f.fechas[e.t], gastos: e.gastos, remunerada: e.remunerada, inversiones: e.inversiones, total,
      totalReal: Math.round(total / Math.pow(infMes, e.t)), aportado: e.aportado, costeInversiones: e.coste,
      impuestos: impuestoAhorro(e.inversiones - e.coste),
    })
  })
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

/** Lo que se queda cada mes en la cuenta de gastos sin rentar (lo que ahorras y no va a inversiones ni a la remunerada). */
export const sobranteMes = (b: Base) => b.netoMedio - b.aInversiones - b.aRemunerada

// ---------------- Simulación con altibajos ----------------

/** Generador pseudoaleatorio con semilla (mulberry32): la misma semilla da siempre los mismos resultados. */
function aleatorio(semilla: number) {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Simulacion {
  /** Por mes (índice = t): percentiles 10, 50 y 90 del total, en euros corrientes y en euros de hoy. */
  p10: Cents[]; p50: Cents[]; p90: Cents[]
  p10Real: Cents[]; p50Real: Cents[]; p90Real: Cents[]
  /** Meses hasta llegar a la meta en cada simulación (null = no llega), ordenados de menos a más. */
  llegadas: (number | null)[]
}

const percentil = (ordenados: Float64Array, q: number) => Math.round(ordenados[Math.min(ordenados.length - 1, Math.floor(q * ordenados.length))])

/**
 * Muchas proyecciones en las que las inversiones suben y bajan cada mes al azar alrededor de la rentabilidad
 * (con la «volatilidad» anual, en %). La mediana coincide con la proyección normal.
 * «meta» (opcional): lo que necesitas cada mes en euros de hoy, para saber cuándo llegaría cada simulación.
 */
export function simular(
  b: Base, cfg: Pick<Config, 'tae_cuenta_rem' | 'retencion_intereses'>, p: Parametros, meses: number,
  { volatilidad, n = 300, semilla = 2026, meta }: { volatilidad: number; n?: number; semilla?: number; meta?: (pt: PuntoProyeccion) => boolean },
): Simulacion {
  const rnd = aleatorio(semilla)
  const f = prepararFlujos(b, cfg, p, meses)
  const mu = Math.log(1 + rentMensual(p))
  const sigma = volatilidad / 100 / Math.sqrt(12)
  const deflactor = new Float64Array(meses + 1)
  const infMes = Math.pow(1 + p.inflacion / 100, 1 / 12)
  for (let t = 0; t <= meses; t++) deflactor[t] = Math.pow(infMes, t)
  const tot = Array.from({ length: meses + 1 }, () => new Float64Array(n))
  const llegadas: (number | null)[] = []
  const r = new Float64Array(meses)
  // Punto que se pasa a «meta» (se reutiliza)
  const pt: PuntoProyeccion = { t: 0, fecha: '', gastos: 0, remunerada: 0, inversiones: 0, total: 0, totalReal: 0, aportado: 0, costeInversiones: 0, impuestos: 0 }
  for (let s = 0; s < n; s++) {
    for (let t = 0; t < meses; t += 2) {
      // Box-Muller: dos normales por cada par de uniformes
      const u = Math.max(rnd(), 1e-12)
      const v = rnd()
      const m = Math.sqrt(-2 * Math.log(u))
      r[t] = Math.exp(mu + sigma * m * Math.cos(2 * Math.PI * v)) - 1
      if (t + 1 < meses) r[t + 1] = Math.exp(mu + sigma * m * Math.sin(2 * Math.PI * v)) - 1
    }
    let llega: number | null = null
    correr(b, f, meses, !!p.invertirSobrante, (k) => r[k], (e) => {
      const total = e.gastos + e.remunerada + e.inversiones
      tot[e.t][s] = total
      if (meta && llega === null) {
        pt.t = e.t; pt.fecha = f.fechas[e.t]; pt.gastos = e.gastos; pt.remunerada = e.remunerada; pt.inversiones = e.inversiones
        pt.total = total; pt.totalReal = Math.round(total / deflactor[e.t]); pt.aportado = e.aportado; pt.costeInversiones = e.coste
        if (meta(pt)) llega = e.t
      }
    })
    llegadas.push(llega)
  }
  const out: Simulacion = { p10: [], p50: [], p90: [], p10Real: [], p50Real: [], p90Real: [], llegadas: llegadas.sort((a, c) => (a ?? Infinity) - (c ?? Infinity)) }
  for (let t = 0; t <= meses; t++) {
    tot[t].sort()
    const [a10, a50, a90] = [percentil(tot[t], 0.1), percentil(tot[t], 0.5), percentil(tot[t], 0.9)]
    out.p10.push(a10); out.p50.push(a50); out.p90.push(a90)
    out.p10Real.push(Math.round(a10 / deflactor[t])); out.p50Real.push(Math.round(a50 / deflactor[t])); out.p90Real.push(Math.round(a90 / deflactor[t]))
  }
  return out
}

/** Meses en que llega una fracción «q» de las simulaciones (null si no llegan tantas). */
export function llegadaPercentil(s: Simulacion, q: number): number | null {
  if (s.llegadas.length === 0) return null
  return s.llegadas[Math.min(s.llegadas.length - 1, Math.ceil(q * s.llegadas.length) - 1)] ?? null
}

/** Fracción de simulaciones que llegan como muy tarde en «meses». */
export function probabilidadAntesDe(s: Simulacion, meses: number): number {
  if (s.llegadas.length === 0) return 0
  return s.llegadas.filter((x) => x !== null && x <= meses).length / s.llegadas.length
}

/** Parámetros guardados en los ajustes (para usarlos fuera de la página Futuro). */
export function parametrosDeConfig(cfg: Config, extra: Cents = 0): Parametros {
  return { rentabilidad: cfg.rentabilidad_inversiones, extra, inflacion: cfg.inflacion, crecimiento: cfg.crecimiento_ahorro, comision: cfg.comision_inversiones, eventos: cfg.eventos_futuro }
}

/** Edad (aproximada, por años) en una fecha; null si no se sabe el año de nacimiento. */
export function edadEn(cfg: Pick<Config, 'anio_nacimiento'>, fecha: string): number | null {
  return cfg.anio_nacimiento ? Number(fecha.slice(0, 4)) - cfg.anio_nacimiento : null
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
  /** Patrimonio necesario hoy: lo que tendrías que sacar al año (con impuestos, si se cuentan) ÷ % de retirada. */
  numero: Cents
  /** Lo que se va en impuestos al año al sacar ese dinero (0 si no se cuentan). */
  impuestosAnual: Cents
  /** El número el mes en que llegas, si cambia por tus planes (pensión, fin de la hipoteca…); null si no llegas. */
  numeroLlegada: Cents | null
  /** Tu patrimonio de hoy. */
  patrimonio: Cents
  /** De 0 a 1 (puede pasar de 1). */
  progreso: number
  /** Mes estimado en que llegarías (en euros de hoy), según la proyección normal; null si no se llega en el plazo. */
  fecha: string | null
  /** Meses que faltan (null si no se llega en el plazo). */
  meses: number | null
  /** ¿Ese punto de una proyección ya llega? (para la simulación). */
  alcanza: (pt: PuntoProyeccion) => boolean
}

/** Lo que hay que sacar en bruto al año para que, tras el IRPF de la parte que es ganancia («g», de 0 a 1), quede «neto». */
export function brutoParaNeto(neto: Cents, g: number): Cents {
  if (neto <= 0 || g <= 0) return Math.max(0, neto)
  let lo = neto
  let hi = Math.ceil(neto / 0.65)
  for (let i = 0; i < 40 && hi - lo > 1; i++) {
    const mid = Math.floor((lo + hi) / 2)
    if (mid - impuestoAhorro(Math.round(mid * g)) >= neto) hi = mid
    else lo = mid
  }
  return hi
}

const fraccionGanancia = (pt: PuntoProyeccion) => (pt.total > 0 ? Math.min(1, Math.max(0, pt.inversiones - pt.costeInversiones) / pt.total) : 0)

export function libertadFinanciera(
  calc: Calculo, d: Pick<Datos, 'config' | 'expenses'>, proyeccion: PuntoProyeccion[],
  { eventos = [], impuestos = false }: { eventos?: EventoFuturo[]; impuestos?: boolean } = {},
): Libertad | null {
  const ult = ultimosConMovimientos(calc)
  if (ult.length === 0) return null
  const gastoMes = media(ult.map((m) => m.gastosTotales))
  const excluidos = new Set(d.config.fire_excluidos ?? [])
  const excluidoMes = conceptosRecientes(calc, d).filter((c) => excluidos.has(c.clave)).reduce((a, c) => a + c.medioMes, 0)
  const gastoAnual = Math.max(0, gastoMes - excluidoMes) * 12
  const pct = d.config.pct_retirada > 0 ? d.config.pct_retirada : 4
  const necesidad = (fecha: string) => Math.max(0, gastoMes - excluidoMes + cambioNecesidadMes(eventos, fecha)) * 12
  const numeroCon = (fecha: string, g: number) => Math.round((impuestos ? brutoParaNeto(necesidad(fecha), g) : necesidad(fecha)) / (pct / 100))
  const llegadaCon = (g: number) => proyeccion.find((p) => { const n = numeroCon(p.fecha, g); return n <= 0 || p.totalReal >= n }) ?? null

  // La parte de ganancia depende de cuándo llegas, y cuándo llegas depende del número: se ajusta unas veces
  let g = proyeccion[0] ? fraccionGanancia(proyeccion[0]) : 0
  let llegada = llegadaCon(g)
  if (impuestos) {
    for (let i = 0; i < 3 && llegada; i++) {
      g = fraccionGanancia(llegada)
      llegada = llegadaCon(g)
    }
  }
  const hoy = proyeccion[0]?.fecha ?? fechaDesdeIndice(indiceMes(d.config.mes_inicio))
  const numero = numeroCon(hoy, g)
  const brutoHoy = impuestos ? brutoParaNeto(necesidad(hoy), g) : necesidad(hoy)
  const patrimonio = calc.kpis.dineroTotalActual
  const numeroLlegada = llegada ? numeroCon(llegada.fecha, g) : null
  return {
    gastoAnual,
    excluidoAnual: excluidoMes * 12,
    numero,
    impuestosAnual: brutoHoy - necesidad(hoy),
    numeroLlegada: numeroLlegada !== null && numeroLlegada !== numero ? numeroLlegada : null,
    patrimonio,
    progreso: numero > 0 ? patrimonio / numero : 1,
    fecha: llegada ? llegada.fecha : null,
    meses: llegada ? llegada.t : null,
    alcanza: (pt) => { const n = numeroCon(pt.fecha, g); return n <= 0 || pt.totalReal >= n },
  }
}

/** Primer punto de la proyección que llega a una cantidad (en euros corrientes). */
export function cuandoLlega(proyeccion: PuntoProyeccion[], cantidad: Cents): PuntoProyeccion | null {
  return proyeccion.find((p) => p.total >= cantidad) ?? null
}

// ---------------- Lo que cuesta una compra en el futuro ----------------

export interface CosteFuturo {
  /** Lo que valdría lo que pagas si lo invirtieras, en euros de hoy: a 10 y a 20 años. */
  en10: Cents
  en20: Cents
  /** Meses que se retrasa la libertad financiera (null si no se puede calcular: no llegas o no hay meses). */
  retraso: number | null
}

/**
 * Qué supone una compra para tu futuro, con los ajustes guardados de Futuro.
 * «pagoAhora»: lo que pagas ya (todo, o la entrada); «cuota» y «plazos»: si es a plazos.
 */
export function costeFuturo(calc: Calculo, d: Pick<Datos, 'config' | 'expenses'>, { pagoAhora, cuota = 0, plazos = 1 }: { pagoAhora: Cents; cuota?: Cents; plazos?: number }): CosteFuturo {
  const cfg = d.config
  const p = parametrosDeConfig(cfg)
  const total = pagoAhora + (plazos > 1 ? cuota * plazos : 0)
  const real = (1 + (p.rentabilidad - (p.comision ?? 0)) / 100) / (1 + p.inflacion / 100)
  const en = (anios: number) => Math.round(total * Math.pow(real, anios))
  if (calc.meses.length === 0) return { en10: en(10), en20: en(20), retraso: null }
  const b = base(calc, d)
  const compra: EventoFuturo[] = []
  if (pagoAhora > 0) compra.push({ id: '_compra', nombre: 'Compra', tipo: 'gasto_unico', importe: pagoAhora, desde: b.desde, hasta: null })
  if (plazos > 1 && cuota > 0) compra.push({ id: '_cuota', nombre: 'Cuota', tipo: 'gasto_nuevo', importe: cuota, desde: b.desde, hasta: fechaDesdeIndice(indiceMes(b.desde) + plazos - 1), fijo: true })
  const opts = { impuestos: cfg.impuestos_futuro }
  const antes = libertadFinanciera(calc, d, proyectar(b, cfg, p, 600), { ...opts, eventos: p.eventos })
  const pc = { ...p, eventos: [...(p.eventos ?? []), ...compra] }
  const despues = libertadFinanciera(calc, d, proyectar(b, cfg, pc, 600), { ...opts, eventos: pc.eventos })
  const retraso = antes?.meses != null && despues?.meses != null ? despues.meses - antes.meses : null
  return { en10: en(10), en20: en(20), retraso }
}
