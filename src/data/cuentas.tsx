// Cuentas del usuario (personal y, si existe, compartida) y cuál está abierta.
import { createContext, useContext, type ReactNode } from 'react'
import type { Cuenta } from '../lib/tipos'

export interface CuentasCtx {
  /** null = sin cuentas (modo local o base de datos sin la migración 0005). */
  cuentas: Cuenta[] | null
  activa: Cuenta | null
  /** id del usuario de la sesión (null en modo local). */
  userId: string | null
  cambiar(id: string): void
  recargarCuentas(): Promise<void>
}

const SIN_CUENTAS: CuentasCtx = { cuentas: null, activa: null, userId: null, cambiar: () => undefined, recargarCuentas: async () => undefined }
const Ctx = createContext<CuentasCtx>(SIN_CUENTAS)

export function CuentasProvider({ valor, children }: { valor: CuentasCtx; children: ReactNode }) {
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useCuentas(): CuentasCtx {
  return useContext(Ctx)
}

const CLAVE = 'presupuesto-cuenta-activa'

/** Última cuenta abierta en este dispositivo. */
export function cuentaGuardada(): string | null {
  try {
    return localStorage.getItem(CLAVE)
  } catch {
    return null
  }
}

export function guardarCuenta(id: string) {
  try {
    localStorage.setItem(CLAVE, id)
  } catch {
    /* sin almacenamiento */
  }
}

/** Nombre corto de un miembro para mostrar. */
export function nombreMiembro(m: { nombre: string; email: string }): string {
  return m.nombre.trim() || m.email.split('@')[0]
}

/** Avisos que tienen que sobrevivir a un cambio de cuenta (se muestran al cargar la siguiente). */
export const CLAVE_AVISO = 'presupuesto-aviso-pendiente'
