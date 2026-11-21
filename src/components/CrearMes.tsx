import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { fechaMesNuevo, ultimoMes } from '../lib/operaciones'
import { nombreMes } from '../lib/fechas'
import { Boton, Modal } from './ui'
import { CierreMes } from './CierreMes'
import { Icono } from './ios'

/**
 * Botón + diálogo "Crear mes nuevo" (equivale a la macro CrearMesNuevo).
 * Si el mes anterior sigue abierto, pregunta si cerrarlo: "Sí" abre el repaso de cierre
 * y, al confirmarlo, cierra el anterior y crea el nuevo; "No" crea el nuevo y deja el anterior abierto.
 */
export function CrearMesBoton({ className }: { className?: string }) {
  const { datos, crearMes, avisar } = useStore()
  const navigate = useNavigate()
  const [paso, setPaso] = useState<'pregunta' | 'repaso' | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fecha = fechaMesNuevo(datos)
  const nombre = nombreMes(fecha)
  const anterior = ultimoMes(datos)
  const anteriorAbierto = anterior?.estado === 'Abierto' ? anterior : null

  function abrir() {
    setError(null)
    setPaso('pregunta')
  }

  async function crear(cerrarAnterior: boolean) {
    setOcupado(true)
    setError(null)
    try {
      const plan = await crearMes(cerrarAnterior)
      let msg = `Mes ${nombreMes(plan.mes.fecha)} creado.`
      if (plan.cerrarMesId && anterior) msg += ` ${nombreMes(anterior.fecha)} queda cerrado.`
      if (plan.nuevoResumen && anterior) msg += ` También se ha creado Resumen ${plan.nuevoResumen}.`
      avisar({ texto: msg, tipo: 'ok' })
      setPaso(null)
      navigate(`/mes/${plan.mes.fecha.slice(0, 7)}?foco=nomina`)
    } catch (e) {
      setError((e as Error).message)
      setPaso('pregunta')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <Boton variante="primario" className={className} onClick={abrir}>
        <Icono nombre="mas" className="h-4 w-4" grosor={2.4} />Crear mes nuevo
      </Boton>
      <Modal
        abierto={paso === 'pregunta'}
        onCerrar={() => setPaso(null)}
        titulo="Crear mes nuevo"
        pie={
          anteriorAbierto ? (
            <>
              <Boton onClick={() => setPaso(null)}>Cancelar</Boton>
              <Boton onClick={() => crear(false)} disabled={ocupado}>
                {ocupado ? 'Creando…' : 'No, dejarlo abierto'}
              </Boton>
              <Boton variante="primario" onClick={() => setPaso('repaso')} disabled={ocupado}>
                Sí, cerrarlo
              </Boton>
            </>
          ) : (
            <>
              <Boton onClick={() => setPaso(null)}>Cancelar</Boton>
              <Boton variante="primario" onClick={() => crear(false)} disabled={ocupado}>
                {ocupado ? 'Creando…' : 'Crear'}
              </Boton>
            </>
          )
        }
      >
        <p>
          Se creará el mes <strong>{nombre}</strong>.
        </p>
        <p className="text-slate-500 dark:text-slate-400">
          {anterior
            ? 'Se copiarán los conceptos de ingresos y gastos del mes anterior con importe 0.'
            : 'Se usarán los conceptos de la plantilla (Ajustes).'}
        </p>
        {anteriorAbierto && (
          <p className="rounded-lg bg-sky-50 p-2 font-medium text-sky-900 dark:bg-sky-900/30 dark:text-sky-200">
            {nombreMes(anteriorAbierto.fecha)} sigue abierto. ¿Quieres cerrarlo?
            <span className="mt-0.5 block text-xs font-normal text-sky-800/80 dark:text-sky-300/80">
              Si dices que sí, antes verás el repaso para comprobar que está todo metido.
            </span>
          </p>
        )}
        {fecha.endsWith('-01-01') && anterior && (
          <p className="rounded-lg bg-emerald-50 p-2 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
            Es enero: también aparecerá el Resumen {fecha.slice(0, 4)}.
          </p>
        )}
        {error && <p className="text-red-600">{error}</p>}
      </Modal>
      {anteriorAbierto && (
        <CierreMes
          mes={anteriorAbierto}
          abierto={paso === 'repaso'}
          onCerrar={() => setPaso('pregunta')}
          onConfirmar={() => crear(true)}
          textoCancelar="Volver"
          textoConfirmar={ocupado ? 'Creando…' : `Cerrar y crear ${nombre}`}
          ocupado={ocupado}
        />
      )}
    </>
  )
}
