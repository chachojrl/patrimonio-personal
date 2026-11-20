import { useEffect, useState } from 'react'
import { activarBloqueo, bloqueoActivo, bloqueoDisponible, desactivarBloqueo } from '../lib/bloqueo'
import { useStore } from '../data/store'
import { supabase } from '../data/supabase'

/** Estado y acciones del bloqueo con Face ID / huella en este dispositivo. */
export function useBloqueo() {
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

  function desactivar() {
    desactivarBloqueo()
    setActivo(false)
    avisar({ texto: 'Bloqueo desactivado en este dispositivo.' })
  }

  return { disponible, activo, ocupado, activar, desactivar }
}
