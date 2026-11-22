// Tarjeta y barra de una hucha (en la página de Huchas y en Inicio).
import { Link } from 'react-router-dom'
import { Dinero, cx } from './ui'
import { useEur } from '../lib/discreto'
import type { Cents } from '../lib/money'
import { formatFecha, mesLargo } from '../lib/fechas'
import type { EstadoHucha } from '../lib/huchas'
import { Icono, type NombreIcono } from './ios'

/** Iconos para elegir al crear una hucha (se guarda el nombre en el campo «emoji»). */
export const ICONOS_HUCHA: { nombre: NombreIcono; txt: string }[] = [
  { nombre: 'hucha', txt: 'Ahorro' },
  { nombre: 'avion', txt: 'Viaje' },
  { nombre: 'sol', txt: 'Vacaciones' },
  { nombre: 'globo', txt: 'Vuelta al mundo' },
  { nombre: 'casa', txt: 'Casa' },
  { nombre: 'llave', txt: 'Entrada de un piso' },
  { nombre: 'herramienta', txt: 'Reformas' },
  { nombre: 'coche', txt: 'Coche' },
  { nombre: 'corazon', txt: 'Boda o pareja' },
  { nombre: 'birrete', txt: 'Estudios' },
  { nombre: 'regalo', txt: 'Regalos' },
  { nombre: 'ordenador', txt: 'Ordenador' },
  { nombre: 'movil', txt: 'Móvil' },
  { nombre: 'musica', txt: 'Ocio' },
  { nombre: 'escudo', txt: 'Imprevistos' },
  { nombre: 'estrella', txt: 'Capricho' },
]

/** Huchas creadas con emoji (versión anterior): su icono equivalente. */
const DE_EMOJI: Record<string, NombreIcono> = {
  '🐷': 'hucha', '✈️': 'avion', '🏖️': 'sol', '🏠': 'casa', '🚗': 'coche', '💍': 'corazon', '🎓': 'birrete', '🎁': 'regalo',
  '💻': 'ordenador', '📱': 'movil', '🛟': 'escudo', '👶': 'corazon', '🐶': 'corazon', '🎸': 'musica', '⛷️': 'sol', '🏍️': 'coche',
}

/** Icono de una hucha a partir de lo guardado (nombre de icono o emoji antiguo). */
export function iconoHucha(valor: string | null | undefined): NombreIcono {
  if (valor && ICONOS_HUCHA.some((x) => x.nombre === valor)) return valor as NombreIcono
  return (valor && DE_EMOJI[valor]) || 'hucha'
}

/** El icono de la hucha en su recuadro de color. */
export function IconoHucha({ valor, tam = 'm', llena }: { valor: string; tam?: 's' | 'm' | 'l'; llena?: boolean }) {
  const caja = { s: 'h-7 w-7 rounded-lg', m: 'h-11 w-11 rounded-xl', l: 'h-16 w-16 rounded-2xl' }[tam]
  const icono = { s: 'h-4 w-4', m: 'h-6 w-6', l: 'h-9 w-9' }[tam]
  return (
    <span
      className={cx(
        'flex shrink-0 items-center justify-center',
        caja,
        llena ? 'bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300' : 'bg-marino/10 text-marino dark:bg-sky-400/15 dark:text-sky-300',
      )}
      aria-hidden
    >
      <Icono nombre={iconoHucha(valor)} className={icono} />
    </span>
  )
}

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
        <IconoHucha valor={h.emoji} tam={compacta ? 's' : 'm'} llena={e.llena} />
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

