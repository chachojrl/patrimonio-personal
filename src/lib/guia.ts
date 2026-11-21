// Recorrido guiado: si está en marcha y si ya se ha ofrecido en este dispositivo.
import { useSyncExternalStore } from 'react'

const CLAVE = 'presupuesto-guia-vista'
const oyentes = new Set<() => void>()
let activo = false

function avisar() {
  oyentes.forEach((f) => f())
}

export function empezarRecorrido() {
  marcarGuiaVista()
  activo = true
  avisar()
}

export function terminarRecorrido() {
  activo = false
  avisar()
}

export function useRecorrido(): boolean {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f)
      return () => oyentes.delete(f)
    },
    () => activo,
    () => false,
  )
}

/** ¿Ya se ha ofrecido (o hecho) el recorrido en este dispositivo? */
export function guiaVista(): boolean {
  try {
    return localStorage.getItem(CLAVE) === '1'
  } catch {
    return true // sin almacenamiento: mejor no insistir
  }
}

export function marcarGuiaVista() {
  try {
    localStorage.setItem(CLAVE, '1')
  } catch {
    /* sin almacenamiento */
  }
}
