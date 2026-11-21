// Preferencias de este dispositivo (como el tema o el modo discreto): se guardan en el navegador
// y no afectan a los datos ni a las exportaciones.
import { useSyncExternalStore } from 'react'

export type Acento = 'marino' | 'verde' | 'grafito' | 'ciruela' | 'teja'

export interface Preferencias {
  /** Color principal de la app. */
  acento: Acento
  /** Mostrar los importes sin céntimos en pantalla (1.234 € en vez de 1.234,56 €). */
  redondear: boolean
  /** Saldos positivos en verde (donde la app los resalta). */
  positivosVerde: boolean
  /** Importes negativos en rojo. */
  negativosRojo: boolean
  /** Empezar con las cifras ocultas cada vez que se abre la app. */
  discretoAlAbrir: boolean
  /** Avisar en Inicio si queda un mes pasado sin cerrar. */
  recordarCierre: boolean
}

export const PREFERENCIAS_INICIALES: Preferencias = {
  acento: 'marino',
  redondear: false,
  positivosVerde: true,
  negativosRojo: true,
  discretoAlAbrir: false,
  recordarCierre: true,
}

export const ACENTOS: { id: Acento; nombre: string; color: string }[] = [
  { id: 'marino', nombre: 'Marino', color: '#1F3864' },
  { id: 'verde', nombre: 'Verde', color: '#1D7A45' },
  { id: 'grafito', nombre: 'Grafito', color: '#3A3A3C' },
  { id: 'ciruela', nombre: 'Ciruela', color: '#7A2E5C' },
  { id: 'teja', nombre: 'Teja', color: '#A94A1F' },
]

const CLAVE = 'presupuesto-preferencias'
const oyentes = new Set<() => void>()

/** Lee y valida lo guardado: cualquier valor raro vuelve al de por defecto. */
export function interpretar(texto: string | null): Preferencias {
  let crudo: Record<string, unknown> = {}
  try {
    const v = texto ? JSON.parse(texto) : {}
    if (v && typeof v === 'object' && !Array.isArray(v)) crudo = v
  } catch {
    /* JSON roto: valores por defecto */
  }
  const p = { ...PREFERENCIAS_INICIALES }
  if (ACENTOS.some((a) => a.id === crudo.acento)) p.acento = crudo.acento as Acento
  for (const k of ['redondear', 'positivosVerde', 'negativosRojo', 'discretoAlAbrir', 'recordarCierre'] as const) {
    if (typeof crudo[k] === 'boolean') p[k] = crudo[k] as boolean
  }
  return p
}

function leer(): Preferencias {
  try {
    return interpretar(localStorage.getItem(CLAVE))
  } catch {
    return { ...PREFERENCIAS_INICIALES }
  }
}

let actuales = leer()

/** Aplica el color de la app a la página (index.html lo hace también al arrancar, sin parpadeo). */
function aplicarAcento(a: Acento) {
  if (typeof document === 'undefined') return
  if (a === 'marino') delete document.documentElement.dataset.acento
  else document.documentElement.dataset.acento = a
}
aplicarAcento(actuales.acento)

export function leerPreferencias(): Preferencias {
  return actuales
}

export function setPreferencias(cambios: Partial<Preferencias>) {
  actuales = { ...actuales, ...cambios }
  try {
    localStorage.setItem(CLAVE, JSON.stringify(actuales))
  } catch {
    /* sin almacenamiento: dura hasta recargar */
  }
  aplicarAcento(actuales.acento)
  oyentes.forEach((f) => f())
}

function suscribir(f: () => void) {
  oyentes.add(f)
  return () => oyentes.delete(f)
}

export function usePreferencias(): Preferencias {
  return useSyncExternalStore(suscribir, () => actuales, () => PREFERENCIAS_INICIALES)
}

// ---------- Última copia de seguridad descargada en este dispositivo ----------

const CLAVE_COPIA = 'presupuesto-ultima-copia'

export function guardarFechaCopia(d = new Date()) {
  try {
    localStorage.setItem(CLAVE_COPIA, d.toISOString())
  } catch {
    /* sin almacenamiento */
  }
}

export function leerFechaCopia(): Date | null {
  try {
    const v = localStorage.getItem(CLAVE_COPIA)
    const d = v ? new Date(v) : null
    return d && !Number.isNaN(d.getTime()) ? d : null
  } catch {
    return null
  }
}

/** «hoy», «ayer», «hace 3 días», «hace 2 meses»… */
export function haceCuanto(d: Date, ahora = new Date()): string {
  const dia = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())
  const dias = Math.round((dia(ahora) - dia(d)) / 86_400_000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 31) return `hace ${dias} días`
  const meses = Math.floor(dias / 30)
  return meses < 12 ? `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}` : 'hace más de un año'
}

// ---------- Recordatorio: meses pasados que siguen abiertos ----------

/** Meses anteriores al mes en curso que siguen abiertos (fechas «AAAA-MM-01»), del más antiguo al más reciente. */
export function mesesSinCerrar(meses: { fecha: string; estado: 'Abierto' | 'Cerrado' }[], hoy = new Date()): string[] {
  const actual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
  return meses
    .filter((m) => m.estado === 'Abierto' && m.fecha.slice(0, 10) < actual)
    .map((m) => m.fecha.slice(0, 10))
    .sort()
}
