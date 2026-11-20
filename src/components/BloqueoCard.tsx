import { useEffect, useState } from 'react'
import { activarBloqueo, bloqueoActivo, bloqueoDisponible, desactivarBloqueo, MINUTOS_EN_SEGUNDO_PLANO } from '../lib/bloqueo'
import { bloquearAhora } from './Bloqueo'
import { useStore } from '../data/store'
import { supabase } from '../data/supabase'
import { Boton, Card } from './ui'

/** Ajustes: activar o quitar el bloqueo con Face ID / huella en este dispositivo. */
export function BloqueoCard() {
  const { avisar } = useStore()
  const [disponible, setDisponible] = useState<boolean | null>(null)
  const [activo, setActivo] = useState(bloqueoActivo())
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    bloqueoDisponible().then(setDisponible)
  }, [])

  async function activar() {
    setOcupado(true)
    try {
      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
      await activarBloqueo(data.session?.user.email ?? 'presupuesto')
      setActivo(true)
      avisar({ texto: 'Bloqueo activado en este dispositivo.' })
    } catch (e) {
      const n = (e as Error).name
      avisar({ texto: n === 'NotAllowedError' ? 'Cancelado: no se ha activado el bloqueo.' : `No se pudo activar: ${(e as Error).message}`, tipo: 'error' })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Card titulo="Bloqueo con Face ID / huella">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Al abrir la app, y si vuelves a ella tras más de {MINUTOS_EN_SEGUNDO_PLANO} minuto, te pide Face ID, tu huella o el código del
        móvil. Es para este dispositivo: actívalo en cada uno donde lo quieras.
      </p>
      {disponible === false && !activo ? (
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-800/60">
          Este navegador o dispositivo no ofrece Face ID ni huella para páginas web.
        </p>
      ) : activo ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">✓ Activado en este dispositivo</span>
          <Boton onClick={bloquearAhora}>🔒 Bloquear ahora</Boton>
          <Boton
            variante="fantasma"
            onClick={() => {
              desactivarBloqueo()
              setActivo(false)
              avisar({ texto: 'Bloqueo desactivado en este dispositivo.' })
            }}
          >
            Desactivar
          </Boton>
        </div>
      ) : (
        <Boton className="mt-3" variante="primario" onClick={activar} disabled={ocupado || disponible === null}>
          {ocupado ? 'Esperando…' : 'Activar bloqueo'}
        </Boton>
      )}
      <p className="mt-3 text-xs text-slate-500">
        La app no ve ni guarda tu cara ni tu huella: lo comprueba el propio móvil. Si algún día no funciona, en la pantalla de bloqueo
        puedes cerrar sesión y entrar con tu contraseña.
      </p>
    </Card>
  )
}
