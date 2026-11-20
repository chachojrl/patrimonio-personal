import { useState } from 'react'
import { useStore } from '../data/store'
import { reparto503020 } from '../lib/analisis'
import { normalizar } from '../lib/buscar'
import { formatPct } from '../lib/money'
import type { Clase } from '../lib/tipos'
import { Card, Dinero, Info, cx } from './ui'

const PARTES = [
  { k: 'necesidades', txt: 'Necesidades', objetivo: 0.5, color: 'bg-[var(--series-1)]' },
  { k: 'caprichos', txt: 'Caprichos', objetivo: 0.3, color: 'bg-[var(--series-2)]' },
  { k: 'ahorro', txt: 'Ahorro', objetivo: 0.2, color: 'bg-[var(--series-3)]' },
  { k: 'sinClasificar', txt: 'Sin clasificar', objetivo: null, color: 'bg-slate-400' },
] as const

/** ¿En qué se van los ingresos del mes? Necesidades / caprichos / ahorro frente a la regla 50/30/20. */
export function Reparto503020Card({ monthId, cerrado }: { monthId: string; cerrado: boolean }) {
  const { datos, calc, actualizarConfig } = useStore()
  const [todos, setTodos] = useState(false)
  const r = reparto503020(datos, calc, monthId)
  if (!r || !r.pct) return null
  const cls = datos.config.clasificacion ?? {}

  function clasificar(concepto: string, clase: Clase | null) {
    const nueva = { ...cls }
    if (clase) nueva[normalizar(concepto)] = clase
    else delete nueva[normalizar(concepto)]
    actualizarConfig({ clasificacion: nueva })
  }

  const conceptos = [...new Set(datos.expenses.filter((g) => g.month_id === monthId && g.importe > 0 && !g.aportacion_cuenta).map((g) => g.concepto.trim()))]
  const lista = todos ? conceptos : r.pendientes

  return (
    <Card titulo={<>¿En qué se va? <Info texto="Regla 50/30/20: como guía, la mitad de los ingresos para necesidades (casa, facturas, comida…), un 30 % para caprichos y un 20 % para ahorrar. La aportación a la cuenta compartida cuenta como necesidad." /></>}>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden>
        {PARTES.map((p) => (
          <div key={p.k} className={p.color} style={{ width: `${Math.max(0, Math.min(100, r.pct![p.k] * 100))}%` }} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PARTES.map((p) => {
          const pct = r.pct![p.k]
          const fuera = p.objetivo !== null && (p.k === 'ahorro' ? pct < p.objetivo : pct > p.objetivo)
          if (p.k === 'sinClasificar' && r.sinClasificar === 0) return null
          return (
            <div key={p.k} className="text-sm">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className={cx('inline-block h-2.5 w-2.5 rounded-sm', p.color)} aria-hidden /> {p.txt}
              </div>
              <div className={cx('font-semibold', fuera && 'text-amber-700 dark:text-amber-400')}>
                {formatPct(pct)}
                {p.objetivo !== null && <span className="ml-1 text-xs font-normal text-slate-500">/ {formatPct(p.objetivo)}</span>}
              </div>
              <div className="text-xs text-slate-500"><Dinero c={r[p.k]} dash={false} /></div>
            </div>
          )
        })}
      </div>

      {!cerrado && (lista.length > 0 || conceptos.length > 0) && (
        <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              {todos ? 'Clasificación de los gastos de este mes (se recuerda para los siguientes):' : r.pendientes.length ? `${r.pendientes.length} concepto${r.pendientes.length > 1 ? 's' : ''} sin clasificar:` : 'Todo clasificado.'}
            </span>
            <button type="button" className="text-sky-700 hover:underline dark:text-sky-400" onClick={() => setTodos((t) => !t)}>{todos ? 'Ver solo pendientes' : 'Cambiar clasificación'}</button>
          </div>
          <ul className="space-y-1.5">
            {lista.map((c) => {
              const actual = cls[normalizar(c)] ?? null
              return (
                <li key={c} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{c}</span>
                  <span className="flex gap-1" role="group" aria-label={`Clasificar ${c}`}>
                    {(['necesidad', 'capricho'] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={actual === k}
                        onClick={() => clasificar(c, actual === k ? null : k)}
                        className={cx(
                          'rounded-full border px-2.5 py-0.5 text-xs',
                          actual === k
                            ? k === 'necesidad' ? 'border-transparent bg-[var(--series-1)] text-white' : 'border-transparent bg-[var(--series-2)] text-white'
                            : 'border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800',
                        )}
                      >
                        {k === 'necesidad' ? 'Necesidad' : 'Capricho'}
                      </button>
                    ))}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Card>
  )
}
