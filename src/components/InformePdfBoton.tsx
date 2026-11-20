import { useState } from 'react'
import { useStore } from '../data/store'
import { nombreMiembro, useCuentas } from '../data/cuentas'
import { datosInforme } from '../lib/informe'
import { descargar } from '../lib/exportar'
import { Boton, Modal } from './ui'

const CLAVE_NOMBRE = 'informe.nombre'

function leerNombre(): string | null {
  try {
    return localStorage.getItem(CLAVE_NOMBRE)
  } catch {
    return null
  }
}

/** Botón «Informe PDF»: pide el nombre que aparece en la portada y descarga el informe de toda la cuenta. */
export function InformePdfBoton({ className }: { className?: string }) {
  const { datos, calc, avisar } = useStore()
  const { activa, userId } = useCuentas()
  const compartida = activa?.tipo === 'compartida'
  const yo = activa?.miembros.find((m) => m.user_id && m.user_id === userId)
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [ocupado, setOcupado] = useState(false)

  function abrir() {
    setNombre(leerNombre() ?? (yo ? nombreMiembro(yo) : ''))
    setAbierto(true)
  }

  async function generar() {
    setOcupado(true)
    try {
      try {
        localStorage.setItem(CLAVE_NOMBRE, nombre.trim())
      } catch {
        /* sin almacenamiento: no pasa nada */
      }
      const { generarInformePdf, nombreArchivoInforme } = await import('../lib/informePdf')
      const cuenta = activa?.nombre ?? 'Mi cuenta'
      const inf = datosInforme(datos, calc, {
        cuenta,
        compartida,
        titular: nombre,
        miembros: compartida ? (activa?.miembros ?? []).map(nombreMiembro) : [],
      })
      const blob = await generarInformePdf(inf, datos)
      descargar(nombreArchivoInforme(compartida ? cuenta : nombre.trim() || cuenta), blob, 'application/pdf')
      setAbierto(false)
    } catch (e) {
      avisar({ texto: `No se pudo generar el informe: ${(e as Error).message}`, tipo: 'error' })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <Boton variante="primario" className={className} onClick={abrir}>📄 Informe PDF</Boton>
      <Modal
        abierto={abierto}
        onCerrar={() => !ocupado && setAbierto(false)}
        titulo="Informe PDF"
        pie={
          <>
            <Boton onClick={() => setAbierto(false)} disabled={ocupado}>Cancelar</Boton>
            <Boton variante="primario" onClick={generar} disabled={ocupado}>{ocupado ? 'Generando…' : 'Generar PDF'}</Boton>
          </>
        }
      >
        <p>
          Un informe de {compartida ? <>la cuenta <strong>«{activa?.nombre}»</strong></> : 'tu cuenta'} con todo lo apuntado hasta hoy:
          resumen, gráficas, en qué se va el dinero, historial y el detalle de cada mes.
        </p>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{compartida ? 'Tu nombre (para el autor del PDF)' : 'Nombre que aparece en la portada'}</span>
          <input
            className="campo"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Tu nombre"
            maxLength={60}
            onKeyDown={(e) => e.key === 'Enter' && !ocupado && generar()}
          />
        </label>
        {compartida && <p className="text-xs text-slate-500">En la cuenta compartida la portada muestra el nombre de la cuenta y de quienes la compartís.</p>}
      </Modal>
    </>
  )
}
