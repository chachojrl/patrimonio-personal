// Modo discreto: oculta las cifras en pantalla (•••• €). Es una preferencia de cada dispositivo:
// se guarda en el navegador y no afecta a los datos ni a las exportaciones.
import { useCallback, useSyncExternalStore } from 'react'
import { formatEUR, type Cents } from './money'

const CLAVE = 'presupuesto-discreto'
const oyentes = new Set<() => void>()

function leer(): boolean {
  try {
    return localStorage.getItem(CLAVE) === '1'
  } catch {
    return false
  }
}

let activo = leer()

export function setDiscreto(v: boolean) {
  activo = v
  try {
    localStorage.setItem(CLAVE, v ? '1' : '0')
  } catch {
    /* sin almacenamiento: dura hasta recargar */
  }
  oyentes.forEach((f) => f())
}

function suscribir(f: () => void) {
  oyentes.add(f)
  return () => oyentes.delete(f)
}

export function useDiscreto(): boolean {
  return useSyncExternalStore(suscribir, () => activo, () => false)
}

/** Texto que sustituye a un importe en modo discreto. */
export const OCULTO = '•••• €'

/** Como formatEUR, pero respeta el modo discreto. Solo para pantalla (nunca para exportar). */
export function useEur() {
  const d = useDiscreto()
  return useCallback(
    (c: Cents, opts?: { dash?: boolean }) => (d ? OCULTO : formatEUR(c, opts)),
    [d],
  )
}
