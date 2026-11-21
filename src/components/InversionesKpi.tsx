import { useState, type ReactNode } from 'react'
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
    <div className="rounded-xl bg-white p-3.5 dark:bg-[#1c1c1e] sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13px] text-slate-500 dark:text-slate-400">Total en inversiones</div>
        {ultimo && !editando && (
          <button
            type="button"
            className="-mr-1 -mt-1 shrink-0 rounded px-1.5 text-sm text-sky-700 hover:bg-slate-100 dark:text-sky-400 dark:hover:bg-slate-800"
            onClick={() => setEditando(true)}
            aria-label="Actualizar el valor actual de las inversiones"
            title="Actualizar el valor actual"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
          </button>
        )}
      </div>
      <div className={cx('mt-0.5 font-bold tracking-tight', grande ? 'text-[22px] sm:text-2xl' : 'text-lg')}>
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

/**
 * Lo mismo que la tarjeta, como fila de lista (Inicio › Dónde está tu dinero): toca el lápiz para
 * escribir el valor actual de la cartera.
 */
export function FilaInversiones({ marca }: { marca?: ReactNode }) {
  const { calc, actualizar } = useStore()
  const [editando, setEditando] = useState(false)
  const ultimo = calc.meses.at(-1)
  const total = calc.kpis.totalInversiones
  const real = ultimo?.mes.valor_real_inversiones ?? null
  return (
    <div className="ios-fila flex items-stretch">
      {marca && <span className="flex items-center pl-4">{marca}</span>}
      <div className={cx('ios-sep flex min-h-11 flex-1 items-center gap-2 py-2 pr-2', marca ? 'ml-2.5' : 'ml-4')}>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] leading-tight">Inversiones</div>
          <div className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {!ultimo ? 'Valor inicial (en Ajustes)' : editando ? `Valor de hoy. Se guarda en ${ultimo.nombre}.` : real !== null ? (
              <>
                Valor real ·{' '}
                <button type="button" className="underline" onClick={() => actualizar('months', ultimo.mes.id, { valor_real_inversiones: null })}>usar estimación</button>
              </>
            ) : 'Estimado'}
          </div>
        </div>
        {editando && ultimo ? (
          <CeldaImporte
            ariaLabel="Valor actual de las inversiones"
            valor={total}
            permitirVacio
            autoFocus
            className="w-36 border-slate-300 bg-white text-right text-[17px] dark:border-slate-600 dark:bg-slate-900"
            onCambio={(v) => actualizar('months', ultimo.mes.id, { valor_real_inversiones: v })}
            onSalir={() => setEditando(false)}
          />
        ) : (
          <Dinero c={total} dash={false} className="text-[17px]" />
        )}
        {ultimo && !editando ? (
          <button
            type="button"
            onClick={() => setEditando(true)}
            aria-label="Actualizar el valor actual de las inversiones"
            title="Actualizar el valor actual"
            className="flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-marino hover:bg-slate-100 dark:text-sky-300 dark:hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
            </svg>
          </button>
        ) : <span className="w-2" />}
      </div>
    </div>
  )
}
