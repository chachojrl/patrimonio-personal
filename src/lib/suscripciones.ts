// Detector de suscripciones. Módulo PURO.
// Busca gastos que se repiten cada mes con un importe pequeño y parecido, gastos fijos pequeños y
// nombres conocidos (Netflix, Spotify, el gimnasio…) en los conceptos y en las notas de los apuntes.
import type { Cents } from './money'
import type { Datos } from './tipos'
import { normalizar } from './buscar'

/** Nombres conocidos: clave normalizada → nombre bonito. Se buscan como palabra en conceptos y notas. */
const CONOCIDAS: [RegExp, string][] = [
  [/netflix/, 'Netflix'], [/spotify/, 'Spotify'], [/\bhbo\b|\bhbo ?max\b|\bmax\b/, 'HBO Max'], [/disney/, 'Disney+'],
  [/prime video|amazon prime|\bprime\b/, 'Amazon Prime'], [/apple ?(tv|music|one)|icloud/, 'Apple'], [/youtube/, 'YouTube Premium'],
  [/google ?one/, 'Google One'], [/dazn/, 'DAZN'], [/filmin/, 'Filmin'], [/movistar ?\+|movistar plus/, 'Movistar Plus+'],
  [/skyshowtime/, 'SkyShowtime'], [/crunchyroll/, 'Crunchyroll'], [/audible/, 'Audible'], [/kindle/, 'Kindle Unlimited'],
  [/deezer/, 'Deezer'], [/tidal/, 'Tidal'], [/chatgpt|openai/, 'ChatGPT'], [/claude/, 'Claude'], [/microsoft ?365|office ?365/, 'Microsoft 365'],
  [/adobe/, 'Adobe'], [/dropbox/, 'Dropbox'], [/patreon/, 'Patreon'], [/xbox|game ?pass/, 'Xbox Game Pass'],
  [/playstation|ps ?plus/, 'PlayStation Plus'], [/nintendo/, 'Nintendo Switch Online'], [/twitch/, 'Twitch'],
  [/gimnasio|\bgym\b|basic ?fit|altafit|mcfit|duet ?fit|go ?fit|anytime ?fitness|crossfit/, 'Gimnasio'],
  [/strava/, 'Strava'], [/duolingo/, 'Duolingo'], [/nordvpn|expressvpn|\bvpn\b/, 'VPN'],
]

/** Por encima de esto no se considera suscripción salvo que el nombre sea conocido. */
const MAX_IMPORTE = 10000 // 100 €
/** Variación máxima entre meses para considerar «el mismo importe». */
const TOLERANCIA = 0.12
const MESES_SEGUIDOS = 3

export interface Suscripcion {
  clave: string
  nombre: string
  /** Lo que pagas al mes ahora (lo del último mes en que aparece). */
  importeMes: Cents
  anual: Cents
  /** Meses en que aparece. */
  meses: number
  /** Último mes en que aparece (primer día). */
  ultimoMes: string
  /** ¿Sigue activa? (aparece en alguno de los dos últimos meses apuntados). */
  activa: boolean
  /** Subida de precio más reciente. */
  subida: { de: Cents; a: Cents; mes: string } | null
  motivo: 'nombre' | 'fijo' | 'repetido'
  /** Lo que llevas pagado en total en los meses apuntados. */
  total: Cents
}

function conocida(texto: string): string | null {
  const t = normalizar(texto)
  for (const [re, nombre] of CONOCIDAS) if (re.test(t)) return nombre
  return null
}

const parecido = (a: Cents, b: Cents) => Math.abs(a - b) <= Math.max(a, b) * TOLERANCIA

/** Serie mes a mes (fecha → importe) de un posible gasto recurrente. */
type Serie = Map<string, Cents>

export function detectarSuscripciones(d: Pick<Datos, 'months' | 'expenses' | 'expense_entries' | 'config'>): Suscripcion[] {
  const meses = [...d.months].sort((a, b) => a.fecha.localeCompare(b.fecha))
  if (meses.length === 0) return []
  const fechaDe = new Map(meses.map((m) => [m.id, m.fecha]))
  const ultimos = new Set(meses.slice(-2).map((m) => m.fecha))
  const ignoradas = new Set(d.config.no_suscripciones ?? [])

  const candidatos = new Map<string, { nombre: string; serie: Serie; motivo: Suscripcion['motivo'] }>()
  const anadir = (clave: string, nombre: string, fecha: string, importe: Cents, motivo: Suscripcion['motivo']) => {
    const c = candidatos.get(clave) ?? { nombre, serie: new Map(), motivo }
    c.serie.set(fecha, (c.serie.get(fecha) ?? 0) + importe)
    if (motivo === 'nombre') c.motivo = 'nombre'
    candidatos.set(clave, c)
  }

  // 1) Conceptos de gasto
  const gastoDe = new Map(d.expenses.map((g) => [g.id, g]))
  const conApuntesConocidos = new Set<string>() // gastos cuyas notas ya son suscripciones (no se cuenta el concepto entero)
  for (const a of d.expense_entries) {
    const g = gastoDe.get(a.expense_id)
    const fecha = g && fechaDe.get(g.month_id)
    if (!g || !fecha || !a.nota || a.importe <= 0) continue
    const n = conocida(a.nota)
    if (n) {
      anadir(`nota:${normalizar(n)}`, n, fecha, a.importe, 'nombre')
      conApuntesConocidos.add(g.id)
    }
  }
  for (const g of d.expenses) {
    const fecha = fechaDe.get(g.month_id)
    if (!fecha || g.aportacion_cuenta || g.importe <= 0 || conApuntesConocidos.has(g.id)) continue
    const n = conocida(g.concepto)
    const clave = normalizar(g.concepto)
    if (!clave) continue
    anadir(clave, n ?? g.concepto.trim(), fecha, g.importe, n ? 'nombre' : g.fijo && g.importe <= MAX_IMPORTE ? 'fijo' : 'repetido')
  }

  const res: Suscripcion[] = []
  for (const [clave, c] of candidatos) {
    if (ignoradas.has(clave)) continue
    const fechas = meses.map((m) => m.fecha).filter((f) => c.serie.has(f))
    if (fechas.length === 0) continue
    const importes = fechas.map((f) => c.serie.get(f)!)
    const ultimo = importes[importes.length - 1]
    if (c.motivo !== 'nombre') {
      if (ultimo > MAX_IMPORTE) continue
      if (c.motivo === 'repetido') {
        // Al menos 3 meses seguidos (de los apuntados) con casi el mismo importe, terminando en los últimos
        const todas = meses.map((m) => m.fecha)
        let seguidos = 1
        let mejor = 1
        for (let i = 1; i < fechas.length; i++) {
          const consecutivo = todas.indexOf(fechas[i]) === todas.indexOf(fechas[i - 1]) + 1
          seguidos = consecutivo && parecido(importes[i], importes[i - 1]) ? seguidos + 1 : 1
          mejor = Math.max(mejor, seguidos)
        }
        if (mejor < MESES_SEGUIDOS || seguidos < MESES_SEGUIDOS) continue
      } else if (fechas.length < 2) continue
    }
    // Subida más reciente: el último cambio a más (pequeños cambios incluidos: 10,99 → 11,99)
    let subida: Suscripcion['subida'] = null
    for (let i = importes.length - 1; i > 0; i--) {
      if (importes[i] !== importes[i - 1]) {
        if (importes[i] > importes[i - 1] && (parecido(importes[i], importes[i - 1]) || c.motivo === 'nombre')) {
          subida = { de: importes[i - 1], a: importes[i], mes: fechas[i] }
        }
        break
      }
    }
    res.push({
      clave, nombre: c.nombre, importeMes: ultimo, anual: ultimo * 12, meses: fechas.length, ultimoMes: fechas[fechas.length - 1],
      activa: ultimos.has(fechas[fechas.length - 1]), subida, motivo: c.motivo, total: importes.reduce((a, b) => a + b, 0),
    })
  }
  return res.sort((a, b) => Number(b.activa) - Number(a.activa) || b.importeMes - a.importeMes)
}

export function resumenSuscripciones(lista: Suscripcion[]) {
  const activas = lista.filter((s) => s.activa)
  const alMes = activas.reduce((a, s) => a + s.importeMes, 0)
  return { activas, alMes, alAnio: alMes * 12 }
}
