import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { formatEUR, formatInput, parseImporte, type Cents } from '../lib/money'
import type { EstadoMes } from '../lib/tipos'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export function Card({ children, className, titulo, accion }: { children: ReactNode; className?: string; titulo?: ReactNode; accion?: ReactNode }) {
  return (
    <section className={cx('min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5', className)}>
      {(titulo || accion) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {titulo && <h2 className="text-sm font-semibold uppercase tracking-wide text-marino dark:text-sky-300">{titulo}</h2>}
          {accion}
        </div>
      )}
      {children}
    </section>
  )
}

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma'
export function Boton({ variante = 'secundario', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  const estilos: Record<Variante, string> = {
    primario: 'bg-marino text-white hover:bg-marino-claro dark:bg-sky-700 dark:hover:bg-sky-600',
    secundario: 'border border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700',
    peligro: 'bg-red-600 text-white hover:bg-red-700',
    fantasma: 'hover:bg-slate-100 dark:hover:bg-slate-800',
  }
  return (
    <button
      type="button"
      {...p}
      className={cx('inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50', estilos[variante], className)}
    />
  )
}

export function BadgeEstado({ estado }: { estado: EstadoMes }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        estado === 'Abierto' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
      )}
    >
      {estado === 'Abierto' ? '● Abierto' : '🔒 Cerrado'}
    </span>
  )
}

/** Importe con signo de color: rojo si es negativo; verde opcional si es positivo. */
export function Dinero({ c, verde, dash = true, className }: { c: Cents | null | undefined; verde?: boolean; dash?: boolean; className?: string }) {
  if (c === null || c === undefined) return <span className={className} />
  return (
    <span className={cx('num whitespace-nowrap', c < 0 && 'text-red-600 dark:text-red-400', verde && c > 0 && 'text-emerald-700 dark:text-emerald-400', className)}>
      {formatEUR(c, { dash })}
    </span>
  )
}

export function Kpi({ titulo, valor, sub, verde, grande }: { titulo: string; valor: Cents | string | null; sub?: ReactNode; verde?: boolean; grande?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{titulo}</div>
      <div className={cx('mt-1 font-semibold', grande ? 'text-xl sm:text-2xl' : 'text-lg')}>
        {typeof valor === 'number' ? <Dinero c={valor} verde={verde} dash={false} /> : valor ?? '–'}
      </div>
      {sub && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</div>}
    </div>
  )
}

export function Info({ texto }: { texto: string }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-label={texto}
        title={texto}
        onClick={() => setAbierto((a) => !a)}
        onBlur={() => setAbierto(false)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] leading-none text-slate-400 hover:text-slate-600"
      >
        i
      </button>
      {abierto && (
        <span className="absolute left-1/2 top-6 z-30 w-64 -translate-x-1/2 rounded-lg bg-slate-900 p-2 text-xs font-normal normal-case tracking-normal text-white shadow-lg">
          {texto}
        </span>
      )}
    </span>
  )
}

/**
 * Celda de importe: muestra "1.234,56 €" (o "–"), al enfocar permite escribir con coma o punto.
 * Llama a onCambio en cada pulsación válida para recalcular en tiempo real.
 */
export function CeldaImporte({
  valor, onCambio, disabled, permitirVacio, permitirNegativo, className, ariaLabel, autoFocus, placeholder,
}: {
  valor: Cents | null
  onCambio: (c: Cents | null) => void
  disabled?: boolean
  permitirVacio?: boolean
  permitirNegativo?: boolean
  className?: string
  ariaLabel?: string
  autoFocus?: boolean
  placeholder?: string
}) {
  const [foco, setFoco] = useState(false)
  const [texto, setTexto] = useState('')
  const [invalido, setInvalido] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  const mostrar = foco ? texto : valor === null ? '' : formatEUR(valor)
  return (
    <input
      ref={ref}
      inputMode="decimal"
      aria-label={ariaLabel}
      disabled={disabled}
      placeholder={placeholder}
      className={cx('celda num text-right', invalido && foco && 'celda-invalida', className)}
      value={mostrar}
      onFocus={(e) => {
        setFoco(true)
        setTexto(valor === null || valor === 0 ? '' : formatInput(valor))
        setInvalido(false)
        const el = e.currentTarget
        requestAnimationFrame(() => el.select())
      }}
      onBlur={() => {
        setFoco(false)
        setInvalido(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setTexto(formatInput(valor))
          ;(e.currentTarget as HTMLInputElement).blur()
        }
      }}
      onChange={(e) => {
        const t = e.target.value
        setTexto(t)
        if (t.trim() === '') {
          setInvalido(false)
          onCambio(permitirVacio ? null : 0)
          return
        }
        const c = parseImporte(t)
        if (c === null || (c < 0 && !permitirNegativo)) {
          setInvalido(true)
          return
        }
        setInvalido(false)
        onCambio(c)
      }}
    />
  )
}

export function CeldaTexto({ valor, onCambio, disabled, className, ariaLabel, placeholder }: { valor: string; onCambio: (v: string) => void; disabled?: boolean; className?: string; ariaLabel?: string; placeholder?: string }) {
  return <input aria-label={ariaLabel} placeholder={placeholder} disabled={disabled} className={cx('celda', className)} value={valor} onChange={(e) => onCambio(e.target.value)} />
}

export function CeldaFecha({ valor, onCambio, disabled, ariaLabel }: { valor: string | null; onCambio: (v: string | null) => void; disabled?: boolean; ariaLabel?: string }) {
  return (
    <input
      type="date"
      aria-label={ariaLabel}
      disabled={disabled}
      className="celda num min-w-[8.5rem]"
      value={valor ?? ''}
      onChange={(e) => onCambio(e.target.value || null)}
    />
  )
}

export function Modal({ abierto, onCerrar, titulo, children, pie }: { abierto: boolean; onCerrar: () => void; titulo: string; children: ReactNode; pie?: ReactNode }) {
  useEffect(() => {
    if (!abierto) return
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [abierto, onCerrar])
  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-lg font-semibold">{titulo}</h3>
        <div className="space-y-3 text-sm">{children}</div>
        {pie && <div className="mt-5 flex flex-wrap justify-end gap-2">{pie}</div>}
      </div>
    </div>
  )
}

export function Spinner({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-3 text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-marino" />
      {texto}
    </div>
  )
}
