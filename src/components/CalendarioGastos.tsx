// Calendario de gastos: un mapa de calor del mes y el gasto medio por día de la semana.
import { useState } from 'react'
import { useStore } from '../data/store'
import { Card, Dinero, cx } from './ui'
import { useDiscreto, useEur } from '../lib/discreto'
import { DIAS_SEMANA, gastosDelMes, mediaPorDiaSemana, semanasDelMes } from '../lib/calendario'
import { MESES, hoyISO, formatFecha } from '../lib/fechas'

export function CalendarioGastos({ anio }: { anio: number }) {
  const { datos } = useStore()
  const eur = useEur()
  const discreto = useDiscreto()
  const delAnio = datos.months.map((m) => m.fecha).filter((f) => f.startsWith(`${anio}-`)).sort()
  const [elegido, setElegido] = useState<string | null>(null)
  const [dia, setDia] = useState<string | null>(null)
  if (delAnio.length === 0) return null
  const mes = elegido && delAnio.includes(elegido) ? elegido : delAnio[delAnio.length - 1]
  const { dias, conDia, total } = gastosDelMes(datos, mes)
  const max = Math.max(0, ...[...dias.values()].map((x) => x.total))
  const hoy = hoyISO()
  const semana = mediaPorDiaSemana(datos, delAnio, hoy)
  const maxSemana = Math.max(0, ...semana.map((x) => x.media))
  const peor = semana.reduce((a, b) => (b.media > a.media ? b : a), semana[0])
  const mediaGeneral = semana.reduce((a, x) => a + x.media, 0) / 7
  const detalle = dia ? dias.get(dia) : undefined

  return (
    <Card titulo="Calendario de gastos">
      <div className="mb-3 flex items-center gap-2">
        <label className="text-sm text-slate-500" htmlFor="mes-calendario">Mes</label>
        <select
          id="mes-calendario"
          className="campo w-auto py-1"
          value={mes}
          onChange={(e) => { setElegido(e.target.value); setDia(null) }}
        >
          {delAnio.map((f) => <option key={f} value={f}>{MESES[Number(f.slice(5, 7)) - 1]}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500" aria-hidden>
        {DIAS_SEMANA.map((d) => <div key={d}>{d.slice(0, 1)}</div>)}
      </div>
      <div className="mt-1 space-y-1" role="grid" aria-label={`Gastos por día de ${MESES[Number(mes.slice(5, 7)) - 1]}`}>
        {semanasDelMes(mes).map((s, i) => (
          <div key={i} className="grid grid-cols-7 gap-1" role="row">
            {s.map((d, j) => {
              if (!d) return <div key={j} role="gridcell" />
              const x = dias.get(d)
              const pct = x && max > 0 ? Math.max(0.12, x.total / max) : 0
              const futuro = d > hoy
              return (
                <button
                  key={j}
                  type="button"
                  role="gridcell"
                  aria-label={`${formatFecha(d)}: ${x ? eur(x.total, { dash: false }) : 'nada'}`}
                  aria-pressed={dia === d}
                  onClick={() => setDia(dia === d ? null : d)}
                  className={cx(
                    'relative flex aspect-square flex-col items-center justify-center rounded-md text-[12px] tabular-nums',
                    futuro ? 'text-slate-300 dark:text-slate-600' : 'text-slate-700 dark:text-slate-200',
                    !x && 'bg-slate-100 dark:bg-white/5',
                    dia === d && 'ring-2 ring-marino dark:ring-sky-400',
                  )}
                  style={x ? { background: `color-mix(in srgb, var(--serie-disponible) ${Math.round(pct * 100)}%, transparent)`, color: pct > 0.55 ? 'white' : undefined } : undefined}
                >
                  {Number(d.slice(8))}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {detalle ? (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-white/5">
          <div className="flex items-baseline justify-between text-sm font-semibold">
            <span>{formatFecha(detalle.dia)}</span>
            <Dinero c={detalle.total} dash={false} />
          </div>
          <ul className="mt-1 space-y-0.5 text-sm">
            {detalle.apuntes.map((a, i) => (
              <li key={i} className="flex justify-between gap-2 text-slate-600 dark:text-slate-300">
                <span className="truncate">{a.concepto}{a.nota ? ` · ${a.nota}` : ''}{a.origen === 'vencimiento' ? ' (vencimiento)' : ''}</span>
                <Dinero c={a.importe} dash={false} />
              </li>
            ))}
          </ul>
        </div>
      ) : dia ? (
        <p className="mt-3 text-sm text-slate-500">El {formatFecha(dia)} no apuntaste ningún gasto.</p>
      ) : null}

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        {total > 0
          ? <>Tienen día {eur(conDia, { dash: false })} de los {eur(total, { dash: false })} gastados este mes. </>
          : null}
        Solo tienen día los gastos apuntados con el botón + o con «+ € nota» y los que tienen fecha de vencimiento; lo que escribes directamente en la casilla de un concepto no sabe qué día fue.
      </p>

      {maxSemana > 0 && (
        <div className="mt-5">
          <h3 className="text-[15px] font-semibold">Gasto medio por día de la semana · {anio}</h3>
          {!discreto && peor.media > mediaGeneral * 1.4 && (
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              Los {peor.dia.toLowerCase()}s gastas {(peor.media / mediaGeneral).toLocaleString('es-ES', { maximumFractionDigits: 1 })} veces más que la media.
            </p>
          )}
          <ul className="mt-2 space-y-1.5">
            {semana.map((x) => (
              <li key={x.dia} className="flex items-center gap-2 text-sm">
                <span className="w-20 shrink-0 text-slate-600 dark:text-slate-300">{x.dia}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                  <span className="block h-full rounded-full" style={{ width: `${(x.media / maxSemana) * 100}%`, background: 'var(--serie-disponible)' }} />
                </span>
                <Dinero c={x.media} dash={false} className="w-24 shrink-0 text-right text-[13px]" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
