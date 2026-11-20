// Piezas de interfaz al estilo de Ajustes de iOS / macOS: listas agrupadas, filas con icono, interruptores.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from './ui'

// Colores del sistema de Apple
export const COLOR = {
  azul: '#007AFF',
  verde: '#34C759',
  naranja: '#FF9500',
  rojo: '#FF3B30',
  morado: '#AF52DE',
  indigo: '#5856D6',
  gris: '#8E8E93',
  turquesa: '#30B0C7',
  amarillo: '#FFCC00',
  rosa: '#FF2D55',
  marron: '#A2845E',
  grafito: '#3A3A3C',
} as const

// Iconos de trazo (Heroicons, licencia MIT)
const TRAZOS = {
  persona: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z',
  documento: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  descargar: 'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3',
  archivo: 'm20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z',
  bandera: 'M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5',
  lista: 'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z',
  casa: 'm2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
  candado: 'M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z',
  cara: 'M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z',
  luna: 'M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z',
  microfono: 'M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z',
  grafica: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z',
} as const
export type NombreIcono = keyof typeof TRAZOS

export function Icono({ nombre, className }: { nombre: NombreIcono; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={TRAZOS[nombre]} />
    </svg>
  )
}

/** Cuadrado de color con el icono en blanco, como los de Ajustes. */
export function IconoApp({ nombre, color, grande }: { nombre: NombreIcono; color: string; grande?: boolean }) {
  return (
    <span
      className={cx('flex shrink-0 items-center justify-center text-white shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.08)]', grande ? 'h-16 w-16 rounded-[18px]' : 'h-[29px] w-[29px] rounded-[7px]')}
      style={{ backgroundColor: color }}
    >
      <Icono nombre={nombre} className={grande ? 'h-9 w-9' : 'h-[18px] w-[18px]'} />
    </span>
  )
}

/** Círculo con la inicial (como la foto del Apple ID). */
export function Avatar({ nombre, grande }: { nombre: string; grande?: boolean }) {
  const inicial = nombre.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      className={cx(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-slate-400 to-slate-500 font-semibold text-white dark:from-slate-500 dark:to-slate-600',
        grande ? 'h-24 w-24 text-4xl' : 'h-14 w-14 text-2xl',
      )}
      aria-hidden
    >
      {inicial}
    </span>
  )
}

/** Grupo de filas con título opcional encima y nota debajo. */
export function Grupo({ titulo, pie, children, className }: { titulo?: ReactNode; pie?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx('mb-8', className)}>
      {titulo && <h3 className="mb-1.5 px-4 text-[13px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{titulo}</h3>}
      <div className="overflow-hidden rounded-[10px] bg-white dark:bg-[#1c1c1e]">{children}</div>
      {pie && <div className="mt-1.5 px-4 text-[13px] leading-snug text-slate-500 dark:text-slate-400">{pie}</div>}
    </div>
  )
}

const Chevron = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m9 5 7 7-7 7" />
  </svg>
)

interface PropsFila {
  icono?: NombreIcono
  color?: string
  titulo: ReactNode
  sub?: ReactNode
  valor?: ReactNode
  /** Navega a otra pantalla (muestra ›). */
  to?: string
  onClick?: () => void
  /** Texto azul (acción) o rojo (destructiva), sin icono de color. */
  accion?: 'azul' | 'rojo'
  derecha?: ReactNode
  seleccionada?: boolean
  activa?: boolean
  disabled?: boolean
  /** No mostrar el valor en pantallas anchas (barra lateral, como en el Mac). */
  valorSoloMovil?: boolean
}

/** Fila de una lista: icono, título, valor a la derecha y flecha. */
export function Fila({ icono, color, titulo, sub, valor, to, onClick, accion, derecha, seleccionada, activa, disabled, valorSoloMovil }: PropsFila) {
  const contenido = (
    <>
      {icono && <span className="py-[7px] pl-4"><IconoApp nombre={icono} color={color ?? COLOR.gris} /></span>}
      <span className={cx('ios-sep flex min-h-11 min-w-0 flex-1 items-center gap-3 py-2.5 pr-4', icono ? 'ml-3' : 'ml-4')}>
        <span className="min-w-0 flex-1">
          <span
            className={cx(
              'block truncate text-[17px] leading-tight',
              accion === 'azul' && 'text-[#007AFF] dark:text-[#0A84FF]',
              accion === 'rojo' && 'text-[#FF3B30] dark:text-[#FF453A]',
              !accion && (activa ? 'font-semibold text-white' : 'text-slate-900 dark:text-slate-100'),
            )}
          >
            {titulo}
          </span>
          {sub && <span className={cx('mt-0.5 block truncate text-[13px]', activa ? 'text-white/80' : 'text-slate-500 dark:text-slate-400')}>{sub}</span>}
        </span>
        {valor !== undefined && valor !== null && valor !== '' && (
          <span className={cx('max-w-[45%] truncate text-[17px]', activa ? 'text-white/85' : 'text-slate-500 dark:text-slate-400', valorSoloMovil && 'lg:hidden')}>{valor}</span>
        )}
        {derecha}
        {seleccionada && (
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-[#007AFF]" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m5 12.5 4.5 4.5L19 7" />
          </svg>
        )}
        {to && !activa && <span className={cx(valorSoloMovil && 'lg:hidden')}><Chevron /></span>}
      </span>
    </>
  )
  const clase = cx(
    'ios-fila flex w-full items-stretch text-left transition-colors',
    activa ? 'bg-[#007AFF] dark:bg-[#0A84FF]' : (to || onClick) && !disabled ? 'active:bg-slate-200/70 hover:bg-slate-50 dark:hover:bg-white/5 dark:active:bg-white/10' : '',
    disabled && 'opacity-50',
  )
  if (to) return <Link to={to} className={clase} aria-current={activa ? 'page' : undefined}>{contenido}</Link>
  if (onClick) return <button type="button" className={clase} onClick={onClick} disabled={disabled} aria-pressed={seleccionada}>{contenido}</button>
  return <div className={clase}>{contenido}</div>
}

/** Fila con un campo de texto o importe a la derecha (o debajo, si es ancho). */
export function FilaCampo({ etiqueta, children, debajo }: { etiqueta: ReactNode; children: ReactNode; debajo?: boolean }) {
  return (
    <label className="ios-fila block">
      <span className={cx('ios-sep ml-4 flex min-h-11 gap-3 py-1.5 pr-4', debajo ? 'flex-col items-stretch py-2.5' : 'items-center')}>
        <span className="shrink-0 text-[17px] text-slate-900 dark:text-slate-100">{etiqueta}</span>
        <span className={cx('min-w-0', debajo ? '' : 'flex flex-1 justify-end')}>{children}</span>
      </span>
    </label>
  )
}

/** Contenido libre dentro de un grupo, con el mismo margen y separador que las filas. */
export function FilaLibre({ children }: { children: ReactNode }) {
  return (
    <div className="ios-fila">
      <div className="ios-sep ml-4 py-3 pr-4 text-[15px] text-slate-700 dark:text-slate-300">{children}</div>
    </div>
  )
}

/** Interruptor verde de iOS. */
export function Interruptor({ activo, onCambio, etiqueta, disabled }: { activo: boolean; onCambio: (v: boolean) => void; etiqueta: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={disabled}
      onClick={() => onCambio(!activo)}
      className={cx(
        'relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50',
        activo ? 'bg-[#34C759]' : 'bg-slate-200 dark:bg-[#39393d]',
      )}
    >
      <span className={cx('absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-[left] duration-200', activo ? 'left-[22px]' : 'left-[2px]')} />
    </button>
  )
}

/** Botón grande de acción (azul), como «Generar PDF». */
export function BotonGrande({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mb-8 w-full rounded-[12px] bg-[#007AFF] px-4 py-3.5 text-[17px] font-semibold text-white transition active:scale-[0.99] active:bg-[#0062cc] disabled:opacity-50 dark:bg-[#0A84FF]"
    >
      {children}
    </button>
  )
}

/** Campo de texto sin borde, alineado a la derecha, como en los formularios de iOS. */
export const claseCampoIos = 'w-full min-w-0 bg-transparent text-right text-[17px] text-slate-600 outline-none placeholder:text-slate-300 dark:text-slate-300 dark:placeholder:text-slate-600'
