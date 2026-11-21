import { useState, type FormEvent } from 'react'
import { supabase } from '../data/supabase'
import { Boton } from './ui'

function traducir(msg: string): string {
  if (/different from the old/i.test(msg)) return 'La contraseña nueva debe ser distinta de la actual.'
  if (/at least|too short|weak/i.test(msg)) return 'La contraseña es demasiado débil o corta.'
  if (/reauthenticat/i.test(msg)) return 'Por seguridad, cierra sesión, vuelve a entrar e inténtalo de nuevo.'
  if (/aal2|assurance/i.test(msg)) return 'Primero tienes que verificarte con el código de dos pasos.'
  return msg
}

/** Contraseña nueva + repetir. Se usa en Ajustes y al recuperar la contraseña. */
export function FormularioContrasena({ textoBoton = 'Cambiar contraseña', onHecho }: { textoBoton?: string; onHecho?: () => void }) {
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(false)
    if (nueva.length < 8) return setError('Usa al menos 8 caracteres.')
    if (nueva !== repetir) return setError('Las dos contraseñas no coinciden.')
    setOcupado(true)
    const { error } = await supabase!.auth.updateUser({ password: nueva })
    setOcupado(false)
    if (error) return setError(traducir(error.message))
    setNueva('')
    setRepetir('')
    setOk(true)
    onHecho?.()
  }

  return (
    <form onSubmit={guardar} className="space-y-2">
      <input className="campo" type="password" autoComplete="new-password" placeholder="Contraseña nueva" aria-label="Contraseña nueva" value={nueva} onChange={(e) => setNueva(e.target.value)} />
      <input className="campo" type="password" autoComplete="new-password" placeholder="Repite la contraseña" aria-label="Repite la contraseña" value={repetir} onChange={(e) => setRepetir(e.target.value)} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-emerald-700 dark:text-emerald-400">Contraseña cambiada.</p>}
      <Boton type="submit" variante="primario" className="w-full sm:w-auto" disabled={ocupado || !nueva}>{ocupado ? 'Guardando…' : textoBoton}</Boton>
    </form>
  )
}
