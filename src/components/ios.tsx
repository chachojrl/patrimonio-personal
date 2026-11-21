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
  calendario: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
  mas: 'M12 4.5v15m7.5-7.5h-15',
  lupa: 'm21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z',
  puntos: 'M5.25 12h.01M12 12h.01M18.75 12h.01',
  tendencia: 'M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941',
  carrito: 'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z',
  avion: 'M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5',
  reloj: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  billete: 'M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z',
  engranaje: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12 2.75v2.5m0 13.5v2.5M2.75 12h2.5m13.5 0h2.5M5.46 5.46l1.77 1.77m9.54 9.54 1.77 1.77M5.46 18.54l1.77-1.77m9.54-9.54 1.77-1.77',
  campana: 'M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0',
  ojoTachado: 'M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88',
  paleta: 'M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z',
  cerrar: 'M6 18 18 6M6 6l12 12',
  check: 'm4.5 12.75 6 6 9-13.5',
  alerta: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
  candadoAbierto: 'M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z',
  papelera: 'm14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0',
  lapiz: 'm16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125',
  anterior: 'M15.75 19.5 8.25 12l7.5-7.5',
  siguiente: 'm8.25 4.5 7.5 7.5-7.5 7.5',
  traspaso: 'M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
  chincheta: 'M16.5 3.75 20.25 7.5l-3 1.5-3.75 3.75.75 4.5-1.5 1.5-3.75-3.75L4.5 19.5M9 9l1.5-4.5L12 3',
  cama: 'M3 18v-6.75A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25V18M3 18h18M3 18v2.25M21 18v2.25M3 14.25h18M6.75 9V6.75A1.5 1.5 0 0 1 8.25 5.25h7.5a1.5 1.5 0 0 1 1.5 1.5V9',
  comida: 'M7 3v8m-2.5-8v4.5a2.5 2.5 0 0 0 5 0V3M7 11v10M17.5 3c-1.9 1.1-3.25 3.4-3.25 6.25V13h3.25m0-10v18',
  ticket: 'M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z',
} as const
export type NombreIcono = keyof typeof TRAZOS

export function Icono({ nombre, className, grosor = 1.8 }: { nombre: NombreIcono; className?: string; grosor?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={nombre === 'puntos' ? 3 : grosor} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
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
