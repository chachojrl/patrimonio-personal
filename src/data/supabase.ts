import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * ¿Se ha abierto la app desde el enlace de "He olvidado mi contraseña"?
 * Se mira ANTES de crear el cliente, porque el cliente limpia la URL al leer el token.
 */
export const vieneDeRecuperacion = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash + window.location.search)

/** null = modo local (sin Supabase configurado). */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url.trim().replace(/\/+$/, '').replace(/\/(rest|auth)\/v1$/, ''), key.trim(), {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
      })
    : null

/** Dirección a la que vuelve el enlace del email (la propia app). */
export function urlDeLaApp(): string {
  return window.location.origin + window.location.pathname
}
