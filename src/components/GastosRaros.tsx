import { useState } from 'react'
import { useStore } from '../data/store'
import { gastosRaros } from '../lib/analisis'
import { useEur } from '../lib/discreto'
import { formatFechaHora } from '../lib/fechas'
import { Icono } from './ios'

/** Avisos del mes: un concepto muy por encima de su media o dos apuntes iguales seguidos. */
export function GastosRaros({ monthId }: { monthId: string }) {
  const { datos } = useStore()
  const eur = useEur()
  const [ocultos, setOcultos] = useState<Set<string>>(new Set())
  const avisos = gastosRaros(datos, monthId).filter((a) => !ocultos.has(`${a.tipo}:${a.concepto}:${a.importe}`))
  if (avisos.length === 0) return null
  return (
    <div role="status" className="space-y-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="font-semibold">Revisa</div>
      {avisos.map((a) => {
        const clave = `${a.tipo}:${a.concepto}:${a.importe}`
        return (
          <div key={clave} className="flex items-start justify-between gap-3">
            <span>
              {a.tipo === 'por-encima' ? (
                <>
                  <strong>{a.concepto}</strong>: {eur(a.importe, { dash: false })} este mes, {a.veces!.toLocaleString('es-ES', { maximumFractionDigits: 1 })} veces tu media
                  ({eur(a.media!, { dash: false })}).
                </>
              ) : (
                <>
                  ¿Duplicado? Dos apuntes de {eur(a.importe, { dash: false })} en <strong>{a.concepto}</strong> casi seguidos (el último, {formatFechaHora(a.cuando!)}).
                  Míralo en «apuntes».
                </>
              )}
            </span>
            <button type="button" aria-label="Ocultar aviso" title="Está bien, ocultar" className="shrink-0 opacity-70 hover:opacity-100" onClick={() => setOcultos((s) => new Set(s).add(clave))}><Icono nombre="cerrar" className="h-4 w-4" grosor={2} /></button>
          </div>
        )
      })}
    </div>
  )
}
