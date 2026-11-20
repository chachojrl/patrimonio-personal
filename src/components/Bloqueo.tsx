import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { bloqueoActivo, desactivarBloqueo, MINUTOS_EN_SEGUNDO_PLANO, verificarBloqueo } from '../lib/bloqueo'
import { supabase } from '../data/supabase'
import { Boton } from './ui'

// Estado del bloqueo mientras la app está abierta (sobrevive a cambiar de cuenta, que vuelve a montar la app)
let bloqueadaAhora = bloqueoActivo()

/** Pide que se bloquee ya (botón «Bloquear ahora»). */
export function bloquearAhora() {
  window.dispatchEvent(new Event('presupuesto-bloquear'))
}

/**
 * Si el bloqueo está activo en este dispositivo, tapa la app al abrirla y tras estar más de
 * MINUTOS_EN_SEGUNDO_PLANO en segundo plano, hasta pasar Face ID / huella.
 * Mientras está bloqueada no se muestra (ni se monta) nada con datos.
 */
export function Bloqueo({ children }: { children: ReactNode }) {
  const [bloqueada, setBloqueadaEstado] = useState(() => bloqueadaAhora && bloqueoActivo())
  const setBloqueada = useCallback((v: boolean) => {
    bloqueadaAhora = v
    setBloqueadaEstado(v)
  }, [])
  const [error, setError] = useState<string | null>(null)
  const [comprobando, setComprobando] = useState(false)
  const oculta = useRef<number | null>(null)

  /** auto = intento al aparecer la pantalla: si el navegador no lo deja sin pulsar, no es un error. */
  const desbloquear = useCallback(async (auto = false) => {
    setComprobando(true)
    setError(null)
    try {
      if (await verificarBloqueo()) setBloqueada(false)
      else setError('No se ha podido verificar. Inténtalo otra vez.')
    } catch (e) {
      if (auto) return
      const n = (e as Error).name
      setError(n === 'NotAllowedError' ? 'Cancelado. Pulsa el botón para intentarlo otra vez.' : `No se ha podido verificar (${(e as Error).message}).`)
    } finally {
      setComprobando(false)
    }
  }, [setBloqueada])

  // Volver de segundo plano tras más de un minuto → bloquear
  useEffect(() => {
    const fn = () => {
      if (!bloqueoActivo()) return
      if (document.visibilityState === 'hidden') oculta.current = Date.now()
      else if (oculta.current && Date.now() - oculta.current > MINUTOS_EN_SEGUNDO_PLANO * 60_000) setBloqueada(true)
    }
    const ahora = () => bloqueoActivo() && setBloqueada(true)
    document.addEventListener('visibilitychange', fn)
    window.addEventListener('presupuesto-bloquear', ahora)
    return () => {
      document.removeEventListener('visibilitychange', fn)
      window.removeEventListener('presupuesto-bloquear', ahora)
    }
  }, [setBloqueada])

  // Al bloquearse con la app visible, se pide Face ID directamente (si el navegador lo permite)
  useEffect(() => {
    if (bloqueada && document.visibilityState === 'visible') desbloquear(true).catch(() => undefined)
  }, [bloqueada, desbloquear])

  if (!bloqueada) return <>{children}</>
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <div className="w-full max-w-xs space-y-4 text-center">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="mx-auto h-14 w-14" />
        <div>
          <h1 className="text-xl font-bold text-marino dark:text-sky-300">Presupuesto bloqueado</h1>
          <p className="mt-1 text-sm text-slate-500">Desbloquea con Face ID, tu huella o el código de tu móvil.</p>
        </div>
        <Boton variante="primario" className="w-full py-3 text-base" onClick={() => desbloquear()} disabled={comprobando}>
          🔓 {comprobando ? 'Comprobando…' : 'Desbloquear'}
        </Boton>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        {supabase && (
          <button
            type="button"
            className="text-xs text-slate-500 underline"
            onClick={() => {
              // Entrar con la contraseña ya demuestra quién eres: el bloqueo se desactiva en este dispositivo
              desactivarBloqueo()
              supabase!.auth.signOut()
            }}
          >
            ¿No funciona? Cerrar sesión y entrar con tu contraseña
          </button>
        )}
      </div>
    </div>
  )
}
