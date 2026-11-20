import { useState } from 'react'
import { useStore } from '../data/store'
import { useCuentas } from '../data/cuentas'
import { mesesOrdenados } from '../lib/operaciones'
import { Boton, Card } from './ui'

/** Ajustes: enlace para apuntar gastos desde la app Atajos de iOS (y Siri). */
export function AtajosCard() {
  const { datos, avisar } = useStore()
  const { activa } = useCuentas()
  const mes = mesesOrdenados(datos).at(-1)
  const conceptos = mes ? [...new Set(datos.expenses.filter((g) => g.month_id === mes.id && !g.aportacion_cuenta).map((g) => g.concepto.trim()))] : []
  const [concepto, setConcepto] = useState(conceptos.find((c) => /super/i.test(c)) ?? conceptos[0] ?? '')
  const base = `${window.location.origin}${window.location.pathname}#/apuntar`
  const cuenta = activa?.tipo === 'compartida' ? '&cuenta=compartida' : activa ? '&cuenta=personal' : ''
  const enlace = `${base}?gasto=${encodeURIComponent(concepto)}${cuenta}&importe=`

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace)
      avisar({ texto: 'Enlace copiado.' })
    } catch {
      avisar({ texto: 'No se pudo copiar: selecciónalo y cópialo a mano.', tipo: 'error' })
    }
  }

  return (
    <Card titulo="Apuntar con Siri o Atajos (iPhone)">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Crea un atajo que te pregunte el importe y abra la app con el gasto ya puesto. Solo tendrás que pulsar «Apuntar». Funciona
        también con Siri: «Oye Siri, apunta súper».
      </p>
      {conceptos.length > 0 ? (
        <>
          <label className="mt-3 block text-sm">
            Gasto del atajo{activa?.tipo === 'compartida' ? ` (cuenta ${activa.nombre})` : ''}
            <select className="campo mt-1" value={concepto} onChange={(e) => setConcepto(e.target.value)}>
              {conceptos.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <div className="mt-2 flex gap-2">
            <input aria-label="Enlace para el atajo" readOnly className="campo flex-1 font-mono text-xs" value={enlace} onFocus={(e) => e.currentTarget.select()} />
            <Boton onClick={copiar}>Copiar</Boton>
          </div>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
            <li>Abre la app <strong>Atajos</strong> → <strong>＋</strong> (nuevo atajo).</li>
            <li>Añade la acción <strong>Pedir entrada</strong>: tipo <em>Número</em>, pregunta «¿Cuánto?».</li>
            <li>Añade <strong>Abrir URL</strong>: pega el enlace y, justo al final, inserta la variable <em>Entrada proporcionada</em>.</li>
            <li>Ponle un nombre fácil, por ejemplo «Apunta súper». Lo puedes lanzar desde la pantalla de inicio o diciéndoselo a Siri.</li>
          </ol>
          <p className="mt-2 text-xs text-slate-500">
            También puedes añadir una nota al final del enlace: <code>&amp;nota=Mercadona</code>. El enlace solo abre la app; sin tu
            sesión (y tu Face ID, si lo tienes activado) no se puede apuntar nada.
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Crea un mes con gastos para generar el enlace.</p>
      )}
    </Card>
  )
}
