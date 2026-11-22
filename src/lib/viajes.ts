// Modo viaje: cálculos puros (en céntimos) y tipo de cambio.
import type { Cents } from './money'
import type { CategoriaViaje, GastoViaje, Viaje } from './tipos'

export const CATEGORIAS: { id: CategoriaViaje; txt: string }[] = [
  { id: 'alojamiento', txt: 'Alojamiento' },
  { id: 'transporte', txt: 'Transporte' },
  { id: 'comida', txt: 'Comida' },
  { id: 'ocio', txt: 'Ocio' },
  { id: 'compras', txt: 'Compras' },
  { id: 'otros', txt: 'Otros' },
]

export const MONEDAS: { id: string; txt: string }[] = [
  { id: 'EUR', txt: 'Euro (€)' },
  { id: 'USD', txt: 'Dólar estadounidense ($)' },
  { id: 'GBP', txt: 'Libra esterlina (£)' },
  { id: 'CHF', txt: 'Franco suizo' },
  { id: 'JPY', txt: 'Yen japonés (¥)' },
  { id: 'MXN', txt: 'Peso mexicano' },
  { id: 'CAD', txt: 'Dólar canadiense' },
  { id: 'AUD', txt: 'Dólar australiano' },
  { id: 'SEK', txt: 'Corona sueca' },
  { id: 'NOK', txt: 'Corona noruega' },
  { id: 'DKK', txt: 'Corona danesa' },
  { id: 'PLN', txt: 'Esloti polaco' },
  { id: 'CZK', txt: 'Corona checa' },
  { id: 'HUF', txt: 'Forinto húngaro' },
  { id: 'TRY', txt: 'Lira turca' },
  { id: 'BRL', txt: 'Real brasileño' },
  { id: 'CNY', txt: 'Yuan chino' },
  { id: 'THB', txt: 'Baht tailandés' },
  { id: 'ISK', txt: 'Corona islandesa' },
]

/** Importe de un gasto pasado a euros (céntimos). */
export function enEuros(g: Pick<GastoViaje, 'importe' | 'cambio'>): Cents {
  return Math.round(g.importe * g.cambio)
}

/** «12,50 £»: importe en su moneda (sin conversión). */
export function formatMoneda(c: Cents, moneda: string): string {
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: moneda, currencyDisplay: 'narrowSymbol' }).format(c / 100)
  } catch {
    return `${(c / 100).toFixed(2).replace('.', ',')} ${moneda}`
  }
}

export interface ResumenViaje {
  total: Cents // en euros
  porCategoria: { id: CategoriaViaje; total: Cents }[] // de mayor a menor, solo las que tienen gasto
  dias: number
  mediaDiaria: Cents
  queda: Cents | null // presupuesto - total (null sin presupuesto)
  pct: number | null // gastado / presupuesto
}

function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1
}

export function resumenViaje(v: Viaje, gastos: GastoViaje[]): ResumenViaje {
  const propios = gastos.filter((g) => g.viaje_id === v.id)
  const total = propios.reduce((a, g) => a + enEuros(g), 0)
  const porCat = new Map<CategoriaViaje, Cents>()
  for (const g of propios) porCat.set(g.categoria, (porCat.get(g.categoria) ?? 0) + enEuros(g))
  const porCategoria = [...porCat.entries()].map(([id, t]) => ({ id, total: t })).sort((a, b) => b.total - a.total)
  // Días: los del viaje si tiene fechas; si no, del primer al último gasto
  const fechas = propios.map((g) => g.fecha).sort()
  const ini = v.fecha_inicio ?? fechas[0]
  const fin = v.fecha_fin ?? fechas.at(-1)
  const dias = ini && fin && fin >= ini ? diasEntre(ini, fin) : propios.length ? 1 : 0
  return {
    total,
    porCategoria,
    dias,
    mediaDiaria: dias ? Math.round(total / dias) : 0,
    queda: v.presupuesto === null ? null : v.presupuesto - total,
    pct: v.presupuesto ? total / v.presupuesto : null,
  }
}

/**
 * Euros por 1 unidad de `moneda`, con los tipos de referencia del Banco Central Europeo
 * (servicio público Frankfurter; solo se envía el código de la moneda).
 */
export async function obtenerCambio(moneda: string, f: typeof fetch = fetch): Promise<number> {
  if (moneda === 'EUR') return 1
  const r = await f(`https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(moneda)}&symbols=EUR`)
  if (!r.ok) throw new Error(`No hay tipo de cambio para ${moneda}.`)
  const j = (await r.json()) as { rates?: { EUR?: number } }
  const v = j.rates?.EUR
  if (typeof v !== 'number' || !(v > 0)) throw new Error(`No hay tipo de cambio para ${moneda}.`)
  return v
}

/** «1 GBP = 1,1700 €» */
export function textoCambio(moneda: string, cambio: number): string {
  return `1 ${moneda} = ${cambio.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} €`
}
