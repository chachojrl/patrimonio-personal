// Todos los importes se manejan en CÉNTIMOS ENTEROS para evitar errores de coma flotante.
export type Cents = number

/** Convierte un numeric de Postgres (número o cadena "123.45") a céntimos. */
export function toCents(v: number | string | null | undefined): Cents {
  if (v === null || v === undefined || v === '') return 0
  const s = typeof v === 'number' ? v.toFixed(2) : String(v).trim()
  const neg = s.startsWith('-')
  const [ent, dec = ''] = s.replace('-', '').split('.')
  const c = Number(ent) * 100 + Number((dec + '00').slice(0, 2))
  return neg ? -c : c
}

export function toCentsOrNull(v: number | string | null | undefined): Cents | null {
  return v === null || v === undefined || v === '' ? null : toCents(v)
}

/** Céntimos → cadena decimal "1234.56" para guardar en NUMERIC(12,2). */
export function centsToDecimal(c: Cents): string {
  const neg = c < 0
  const a = Math.abs(Math.round(c))
  return `${neg ? '-' : ''}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`
}

/**
 * Interpreta lo que escribe el usuario. Acepta coma o punto decimal, separador de miles,
 * espacios y el símbolo €. Devuelve null si no es un número válido.
 */
export function parseImporte(input: string): Cents | null {
  let s = input.replace(/[\s€ ]/g, '')
  if (s === '') return null
  let neg = false
  if (s.startsWith('-')) {
    neg = true
    s = s.slice(1)
  } else if (s.startsWith('+')) {
    s = s.slice(1)
  }
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let ent: string
  let dec = ''
  if (lastComma >= 0 && lastDot >= 0) {
    const sep = lastComma > lastDot ? ',' : '.'
    const other = sep === ',' ? '.' : ','
    const i = s.lastIndexOf(sep)
    ent = s.slice(0, i).split(other).join('')
    dec = s.slice(i + 1)
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? ',' : '.'
    const parts = s.split(sep)
    if (parts.length > 2) {
      // "1.234.567" → separadores de miles
      if (!parts.slice(1).every((p) => p.length === 3)) return null
      ent = parts.join('')
    } else {
      ent = parts[0]
      dec = parts[1]
    }
  } else {
    ent = s
  }
  if (ent === '') ent = '0'
  if (!/^\d+$/.test(ent) || !/^\d*$/.test(dec)) return null
  // Redondeo a 2 decimales (mitad hacia arriba) usando solo enteros
  const d3 = (dec + '000').slice(0, 3)
  let cents = Number(ent) * 100 + Math.floor(Number(d3) / 10)
  if (Number(d3) % 10 >= 5) cents += 1
  if (!Number.isSafeInteger(cents)) return null
  return neg ? -cents : cents
}

function agrupar(n: string): string {
  return n.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** 123456 → "1.234,56 €" (o "1.235 €" con redondear). Con dash=true, 0 se muestra como "–" (como en Excel). */
export function formatEUR(c: Cents | null | undefined, opts: { dash?: boolean; simbolo?: boolean; redondear?: boolean } = {}): string {
  const { dash = true, simbolo = true, redondear = false } = opts
  if (c === null || c === undefined) return ''
  if (c === 0 && dash) return '–'
  if (redondear) {
    // Al euro más cercano (la mitad, hacia arriba en valor absoluto)
    const e = Math.round(Math.abs(c) / 100)
    if (e === 0) return `0${simbolo ? ' €' : ''}`
    return `${c < 0 ? '−' : ''}${agrupar(String(e))}${simbolo ? ' €' : ''}`
  }
  const neg = c < 0
  const a = Math.abs(Math.round(c))
  const s = `${agrupar(String(Math.floor(a / 100)))},${String(a % 100).padStart(2, '0')}`
  return `${neg ? '−' : ''}${s}${simbolo ? ' €' : ''}`
}

/** Para inputs: 123456 → "1234,56" (sin miles para que sea fácil de editar). */
export function formatInput(c: Cents | null | undefined): string {
  if (c === null || c === undefined) return ''
  const neg = c < 0
  const a = Math.abs(c)
  return `${neg ? '-' : ''}${Math.floor(a / 100)},${String(a % 100).padStart(2, '0')}`
}

/** 0.1653 → "16,5 %" */
export function formatPct(p: number | null | undefined, decimales = 1): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return ''
  return `${(p * 100).toFixed(decimales).replace('.', ',')} %`
}
