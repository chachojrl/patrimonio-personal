import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { fechaMesNuevo, ultimoMes } from '../lib/operaciones'
import { nombreMes } from '../lib/fechas'
import { Boton, Modal } from './ui'

/** Botón + diálogo "Crear mes nuevo" (equivale a la macro CrearMesNuevo). */
export function CrearMesBoton({ className }: { className?: string }) {
  const { datos, crearMes, avisar } = useStore()
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const [cerrar, setCerrar] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fecha = fechaMesNuevo(datos)
  const nombre = nombreMes(fecha)
  const anterior = ultimoMes(datos)

  async function crear() {
    setOcupado(true)
    setError(null)
    try {
      const plan = await crearMes(cerrar)
      let msg = `Mes ${nombreMes(plan.mes.fecha)} creado.`
      if (plan.nuevoResumen && anterior) msg += ` También se ha creado Resumen ${plan.nuevoResumen}.`
      avisar({ texto: msg, tipo: 'ok' })
      setAbierto(false)
      navigate(`/mes/${plan.mes.fecha.slice(0, 7)}?foco=nomina`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <Boton variante="primario" className={className} onClick={() => setAbierto(true)}>
        ＋ Crear mes nuevo
      </Boton>
      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Crear mes nuevo"
        pie={
          <>
            <Boton onClick={() => setAbierto(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={crear} disabled={ocupado}>
              {ocupado ? 'Creando…' : 'Crear'}
            </Boton>
          </>
        }
      >
        <p>
          Se creará el mes <strong>{nombre}</strong>. ¿Continuar?
        </p>
        <p className="text-slate-500 dark:text-slate-400">
          {anterior
            ? 'Se copiarán los conceptos de ingresos y gastos del mes anterior con importe 0.'
            : 'Se usarán los conceptos de la plantilla (Ajustes).'}
        </p>
        {anterior && anterior.estado === 'Abierto' && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={cerrar} onChange={(e) => setCerrar(e.target.checked)} className="h-4 w-4" />
            Cerrar {nombreMes(anterior.fecha)} automáticamente
          </label>
        )}
        {fecha.endsWith('-01-01') && anterior && (
          <p className="rounded-lg bg-emerald-50 p-2 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
            Es enero: también aparecerá el Resumen {fecha.slice(0, 4)}.
          </p>
        )}
        {error && <p className="text-red-600">{error}</p>}
      </Modal>
    </>
  )
}
