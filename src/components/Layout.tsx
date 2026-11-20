import { Link, NavLink, Outlet } from 'react-router-dom'
import { useStore } from '../data/store'
import { BotonDiscreto, cx } from './ui'
import { ultimoMes } from '../lib/operaciones'
import { useEffect } from 'react'
import { CLAVE_AVISO, nombreMiembro, useCuentas } from '../data/cuentas'

function EstadoGuardadoChip() {
  const { guardado } = useStore()
  const t = {
    guardado: { txt: 'Guardado', cls: 'text-emerald-700 dark:text-emerald-400' },
    guardando: { txt: 'Guardando…', cls: 'text-slate-500' },
    error: { txt: 'Error al guardar', cls: 'text-red-600' },
    'sin-conexion': { txt: 'Sin conexión', cls: 'text-amber-600' },
  }[guardado]
  return <span className={cx('text-xs font-medium', t.cls)} aria-live="polite">{t.txt}</span>
}

/** Cambiar entre la cuenta personal y la compartida (solo si hay más de una). */
function SelectorCuenta({ className, vertical }: { className?: string; vertical?: boolean }) {
  const { cuentas, activa, cambiar } = useCuentas()
  if (!cuentas || cuentas.length < 2 || !activa) return null
  return (
    <div role="group" aria-label="Cuenta" className={cx('flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800', vertical && 'flex-col', className)}>
      {cuentas.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={c.id === activa.id}
          onClick={() => c.id !== activa.id && cambiar(c.id)}
          className={cx(
            'flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium',
            vertical ? 'justify-start px-3' : 'justify-center',
            c.id === activa.id ? 'bg-white text-marino shadow-sm dark:bg-slate-900 dark:text-sky-300' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
          )}
        >
          <span aria-hidden>{c.tipo === 'personal' ? '👤' : '🏠'}</span>
          <span className="truncate">{c.tipo === 'personal' ? 'Mi cuenta' : c.nombre}</span>
        </button>
      ))}
    </div>
  )
}

function AvisoCompartida() {
  const { activa, userId } = useCuentas()
  if (activa?.tipo !== 'compartida') return null
  const otros = activa.miembros.filter((m) => m.user_id !== userId)
  const pendiente = otros.some((m) => !m.user_id)
  return (
    <div className="bg-sky-50 px-4 py-2 text-center text-xs text-sky-900 dark:bg-sky-950/50 dark:text-sky-200">
      🏠 Cuenta compartida{otros.length ? ` con ${otros.map(nombreMiembro).join(', ')}` : ''}: lo que hay aquí lo veis {otros.length > 1 ? 'todos' : 'los dos'}.
      {pendiente && ' (Aún no ha entrado en la app.)'}
    </div>
  )
}

const ICONOS: Record<string, string> = { inicio: '☰', mes: '📅', historial: '📈', resumen: '📊', ajustes: '⚙️' }

export function Layout() {
  const { datos, modo, toasts, cerrarToast, guardado, avisar } = useStore()
  // Aviso dejado por una acción que cambió de cuenta (p. ej. borrar la compartida)
  useEffect(() => {
    try {
      const t = sessionStorage.getItem(CLAVE_AVISO)
      if (t) {
        sessionStorage.removeItem(CLAVE_AVISO)
        avisar({ texto: t })
      }
    } catch {
      /* sin almacenamiento */
    }
  }, [avisar])
  const u = ultimoMes(datos)
  const anio = u ? u.fecha.slice(0, 4) : String(new Date().getFullYear())
  const enlaces = [
    { to: '/', txt: 'Inicio', icono: ICONOS.inicio, end: true },
    { to: u ? `/mes/${u.fecha.slice(0, 7)}` : '/', txt: 'Mes actual', icono: ICONOS.mes, end: false, activo: '/mes' },
    { to: '/historial', txt: 'Historial', icono: ICONOS.historial, end: false },
    { to: `/resumen/${anio}`, txt: 'Resumen', icono: ICONOS.resumen, end: false, activo: '/resumen' },
    { to: '/ajustes', txt: 'Ajustes', icono: ICONOS.ajustes, end: false },
  ]
  // Solo en la barra lateral; en el móvil van como iconos en la cabecera
  const extras = [
    { to: '/buscar', txt: 'Buscar', icono: '🔍' },
    { to: '/te-deben', txt: 'Te deben', icono: '🤝' },
  ]
  const claseEnlace = ({ isActive }: { isActive: boolean }) =>
    cx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium', isActive ? 'bg-marino text-white dark:bg-sky-800' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')

  return (
    <div className="min-h-screen pb-20 md:pb-0 md:pl-56">
      {/* Barra lateral (escritorio) */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-slate-200 bg-white px-3 py-5 dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-8 w-8" />
          <span className="font-semibold text-marino dark:text-sky-300">Presupuesto</span>
        </div>
        <SelectorCuenta className="mb-4" vertical />
        <nav className="flex flex-col gap-1">
          {enlaces.map((e) => (
            <NavLink
              key={e.txt}
              to={e.to}
              end={e.end}
              className={({ isActive }) =>
                cx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium', isActive ? 'bg-marino text-white dark:bg-sky-800' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
              }
            >
              <span aria-hidden>{e.icono}</span>
              {e.txt}
            </NavLink>
          ))}
        </nav>
        <div className="my-3 border-t border-slate-200 dark:border-slate-800" />
        <nav className="flex flex-col gap-1">
          {extras.map((e) => (
            <NavLink key={e.to} to={e.to} className={claseEnlace}>
              <span aria-hidden>{e.icono}</span>
              {e.txt}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center justify-between px-2">
          <EstadoGuardadoChip />
          <BotonDiscreto />
        </div>
      </aside>

      {/* Cabecera móvil */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 md:hidden">
        <div className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-7 w-7" />
          <span className="font-semibold text-marino dark:text-sky-300">Presupuesto</span>
        </div>
        <div className="flex items-center gap-1">
          <EstadoGuardadoChip />
          {extras.map((e) => (
            <Link key={e.to} to={e.to} aria-label={e.txt} title={e.txt} className="flex h-8 w-8 items-center justify-center rounded-lg text-base hover:bg-slate-100 dark:hover:bg-slate-800">
              <span aria-hidden>{e.icono}</span>
            </Link>
          ))}
          <BotonDiscreto />
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900 md:hidden [&:empty]:hidden">
        <SelectorCuenta />
      </div>
      <AvisoCompartida />

      {modo === 'local' && (
        <div className="bg-amber-100 px-4 py-2 text-center text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
          Modo local: los datos se guardan solo en este navegador. Configura Supabase para usarla en todos tus dispositivos.
        </div>
      )}
      {guardado === 'sin-conexion' && (
        <div className="bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-white">Sin conexión: los cambios se guardarán al recuperarla.</div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <Outlet />
      </main>

      {/* Navegación inferior (móvil) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-900 md:hidden">
        {enlaces.map((e) => (
          <NavLink
            key={e.txt}
            to={e.to}
            end={e.end}
            className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2 text-[11px]', isActive ? 'font-semibold text-marino dark:text-sky-300' : 'text-slate-500')}
          >
            <span aria-hidden className="text-lg leading-none">{e.icono}</span>
            {e.txt}
          </NavLink>
        ))}
      </nav>

      {/* Avisos */}
      <div className="fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cx(
              'flex w-full max-w-md items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm shadow-lg',
              t.tipo === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white dark:bg-slate-700',
            )}
          >
            <span>{t.texto}</span>
            <span className="flex shrink-0 gap-2">
              {t.accion && (
                <button
                  className="font-semibold text-sky-300 hover:underline"
                  onClick={() => {
                    t.accion!.fn()
                    cerrarToast(t.id)
                  }}
                >
                  {t.accion.texto}
                </button>
              )}
              <button aria-label="Cerrar" onClick={() => cerrarToast(t.id)} className="opacity-70 hover:opacity-100">✕</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
