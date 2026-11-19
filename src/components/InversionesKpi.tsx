import { useState } from 'react'
import { useStore } from '../data/store'
import { CeldaImporte, Dinero, cx } from './ui'

/**
 * Tarjeta "Total en inversiones" editable. Lo que se escribe se guarda como valoración real
 * (valor_real_inversiones) del último mes, de modo que Inversiones acum., Ahorro acumulado,
 * Dinero total y Ganancia/pérdida se recalculan solos.
 */
export function InversionesKpi({ grande }: { grande?: boolean }) {
  const { calc, actualizar } = useStore()
  const [editando, setEditando] = useState(false)
  const ultimo = calc.meses.at(-1)
  const total = calc.kpis.totalInversiones
  const real = ultimo?.mes.valor_real_inversiones ?? null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total en inversiones</div>
        {ultimo && !editando && (
          <button
            type="button"
            className="-mr-1 -mt-1 shrink-0 rounded px-1.5 text-sm text-sky-700 hover:bg-slate-100 dark:text-sky-400 dark:hover:bg-slate-800"
            onClick={() => setEditando(true)}
            aria-label="Actualizar el valor actual de las inversiones"
            title="Actualizar el valor actual"
          >
            ✎
          </button>
        )}
      </div>
      <div className={cx('mt-1 font-semibold', grande ? 'text-xl sm:text-2xl' : 'text-lg')}>
        {editando && ultimo ? (
          <CeldaImporte
            ariaLabel="Valor actual de las inversiones"
            valor={total}
            permitirVacio
            autoFocus
            className="border-slate-300 bg-white text-left dark:border-slate-600 dark:bg-slate-900"
            onCambio={(v) => actualizar('months', ultimo.mes.id, { valor_real_inversiones: v })}
            onSalir={() => setEditando(false)}
          />
        ) : (
          <Dinero c={total} dash={false} />
        )}
      </div>
      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        {!ultimo ? (
          'Se ajusta en Ajustes → Inversiones iniciales.'
        ) : editando ? (
          `Valor de la cartera hoy. Se guarda en ${ultimo.nombre}.`
        ) : real !== null ? (
          <>
            Valor real ({ultimo.nombre}) ·{' '}
            <button
              type="button"
              className="underline hover:text-slate-700 dark:hover:text-slate-200"
              onClick={() => actualizar('months', ultimo.mes.id, { valor_real_inversiones: null })}
            >
              usar estimación
            </button>
          </>
        ) : (
          'Estimado: última valoración + aportaciones.'
        )}
      </div>
    </div>
  )
}
