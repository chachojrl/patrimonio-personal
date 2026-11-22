// Tarjeta y barra de una hucha (en la página de Huchas y en Inicio).
import { Link } from 'react-router-dom'
import { Dinero, cx } from './ui'
import { useEur } from '../lib/discreto'
import type { Cents } from '../lib/money'
import { formatFecha, mesLargo } from '../lib/fechas'
import type { EstadoHucha } from '../lib/huchas'

/** Frase corta con cómo va la hucha. */
export function textoEstado(e: EstadoHucha, eur: (c: Cents, o?: { dash?: boolean }) => string): string {
  const h = e.hucha
  if (h.conseguida_en) return `Conseguida el ${formatFecha(h.conseguida_en)}`
  if (e.llena) return '¡Llena! Ya tienes todo el objetivo'
  if (h.fecha_objetivo && e.noLlega && e.necesarioAlMes !== null) {
    return e.mesesHastaLimite === 0
      ? `La fecha ya pasó: faltan ${eur(e.falta, { dash: false })}`
      : `Para llegar en ${mesLargo(h.fecha_objetivo)} necesitas ${eur(e.necesarioAlMes, { dash: false })} al mes`
  }
  if (e.mesEstimado) return `Con ${eur(h.aportacion_mensual!, { dash: false })} al mes llegas en ${mesLargo(e.mesEstimado)}`
  return `Faltan ${eur(e.falta, { dash: false })}`
}

export function BarraHucha({ e, fina }: { e: EstadoHucha; fina?: boolean }) {
  const pct = Math.min(100, Math.round((e.pct ?? 0) * 100))
  return (
    <div
      className={cx('overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700', fina ? 'h-1.5' : 'h-3')}
      role="meter"
      aria-label={`${e.hucha.nombre}: ${pct} % del objetivo`}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cx('h-full rounded-full transition-[width] duration-700', e.llena ? 'bg-emerald-500' : 'bg-marino dark:bg-sky-400')} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function TarjetaHucha({ e, compacta }: { e: EstadoHucha; compacta?: boolean }) {
  const eur = useEur()
  const h = e.hucha
  return (
    <Link
      to={`/huchas/${h.id}`}
      className={cx('block rounded-xl bg-white p-4 active:bg-slate-100 dark:bg-[#1c1c1e] dark:active:bg-white/10', h.conseguida_en && 'opacity-75', compacta && 'p-3.5')}
    >
      <div className="flex items-start gap-3">
        <span className={cx('flex shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/10', compacta ? 'h-9 w-9 text-xl' : 'h-11 w-11 text-2xl')} aria-hidden>{h.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-semibold text-slate-900 dark:text-white">{h.nombre}</span>
            <span className="shrink-0 text-sm text-slate-500">{e.pct === null ? '' : `${Math.round(e.pct * 100)} %`}</span>
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            <Dinero c={e.saldo} dash={false} /> <span className="text-slate-400">de</span> <Dinero c={h.objetivo} dash={false} />
          </div>
        </div>
      </div>
      <div className="mt-2.5"><BarraHucha e={e} fina={compacta} /></div>
      {!compacta && <p className={cx('mt-2 text-xs', e.noLlega && !h.conseguida_en ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400')}>{textoEstado(e, eur)}</p>}
    </Link>
  )
}

