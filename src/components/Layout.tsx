import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useStore } from '../data/store'
import { BotonDiscreto, cx } from './ui'
import { ultimoMes } from '../lib/operaciones'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { Icono, type NombreIcono } from './ios'
import { PanelApuntar } from './PanelApuntar'
import { Recorrido } from './Recorrido'
import { useRecorrido } from '../lib/guia'
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
    <div role="group" aria-label="Cuenta" className={cx('flex gap-0.5 rounded-[9px] bg-[#e3e3e8] p-0.5 dark:bg-[#1c1c1e]', vertical && 'flex-col', className)}>
      {cuentas.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={c.id === activa.id}
          onClick={() => c.id !== activa.id && cambiar(c.id)}
          className={cx(
            'flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium',
            vertical ? 'justify-start px-3' : 'justify-center',
            c.id === activa.id ? 'bg-white text-marino shadow-sm dark:bg-[#636366] dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
          )}
        >
          <Icono nombre={c.tipo === 'personal' ? 'persona' : 'casa'} className="h-4 w-4 shrink-0" />
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
      Cuenta compartida{otros.length ? ` con ${otros.map(nombreMiembro).join(', ')}` : ''}: lo que hay aquí lo veis {otros.length > 1 ? 'todos' : 'los dos'}.
      {pendiente && ' (Aún no ha entrado en la app.)'}
    </div>
  )
}

/** Mientras se descarga una pantalla por primera vez (suele ser un instante). */
function CargandoPantalla() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Cargando">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-marino motion-reduce:animate-none dark:border-slate-600 dark:border-t-sky-300" />
    </div>
  )
}

interface EnlaceNav {
  to: string
  txt: string
  icono: NombreIcono
  end?: boolean
  activo?: string
  /** Para el recorrido guiado. */
  guia?: string
}

/** Hoja «Más» del móvil: sube desde abajo con las secciones que no caben en la barra. */
function HojaMas({ enlaces, onCerrar }: { enlaces: EnlaceNav[]; onCerrar: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onCerrar])
  return (
    <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Más secciones">
      <button type="button" aria-label="Cerrar" className="anim-fondo absolute inset-0 bg-black/30" onClick={onCerrar} />
      <div className="anim-subir absolute inset-x-0 bottom-0 rounded-t-[14px] bg-[#f2f2f7] px-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] pt-2 dark:bg-[#1c1c1e]">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600" aria-hidden />
        <nav className="overflow-hidden rounded-[10px] bg-white dark:bg-[#2c2c2e]">
          {enlaces.map((e) => (
            <NavLink key={e.to} to={e.to} onClick={onCerrar} className="ios-fila flex items-stretch active:bg-slate-200/70 dark:active:bg-white/10">
              <span className="flex items-center py-2.5 pl-4 text-marino dark:text-sky-300"><Icono nombre={e.icono} className="h-6 w-6" /></span>
              <span className="ios-sep ml-3 flex min-h-11 flex-1 items-center pr-4 text-[17px] text-slate-900 dark:text-slate-100">{e.txt}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

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
  const { pathname } = useLocation()
  const [masAbierto, setMasAbierto] = useState(false)
  const [apuntando, setApuntando] = useState(false)
  const recorrido = useRecorrido()
  const cerrarMas = useCallback(() => setMasAbierto(false), [])
  const u = ultimoMes(datos)
  const anio = u ? u.fecha.slice(0, 4) : String(new Date().getFullYear())
  const inicio: EnlaceNav = { to: '/', txt: 'Inicio', icono: 'casa', end: true }
  const mes: EnlaceNav = { to: u ? `/mes/${u.fecha.slice(0, 7)}` : '/', txt: 'Mes actual', icono: 'calendario', activo: '/mes', guia: 'nav-mes' }
  const historial: EnlaceNav = { to: '/historial', txt: 'Historial', icono: 'tendencia' }
  const resumen: EnlaceNav = { to: `/resumen/${anio}`, txt: 'Resumen', icono: 'grafica', activo: '/resumen', guia: 'nav-resumen' }
  const ajustes: EnlaceNav = { to: '/ajustes', txt: 'Ajustes', icono: 'engranaje' }
  const enlaces = [inicio, mes, historial, resumen, ajustes]
  const extras: EnlaceNav[] = [
    { to: '/huchas', txt: 'Huchas', icono: 'hucha' },
    { to: '/compra', txt: 'Lista de la compra', icono: 'carrito' },
    { to: '/buscar', txt: 'Buscar', icono: 'lupa' },
    { to: '/viajes', txt: 'Viajes', icono: 'avion' },
    { to: '/te-deben', txt: 'Te deben', icono: 'billete' },
    { to: '/permitir', txt: '¿Me lo puedo permitir?', icono: 'balanza' },
    { to: '/actividad', txt: 'Actividad', icono: 'reloj' },
  ]
  // Móvil: Inicio, Mes, Apuntar, Resumen y «Más» (el resto, en una hoja que sube desde abajo)
  const enMas = [historial, ajustes, ...extras]
  const masActivo = enMas.some((e) => pathname.startsWith(e.to))
  const claseTab = (activo: boolean) => cx('flex flex-col items-center gap-0.5 pt-1.5 text-[10px] font-medium', activo ? 'text-marino dark:text-sky-300' : 'text-slate-500 dark:text-slate-400')
  const claseEnlace = ({ isActive }: { isActive: boolean }) =>
    cx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium', isActive ? 'bg-marino text-white dark:bg-sky-800' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')

  return (
    <div className="min-h-screen pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-0 md:pl-56">
      {/* Barra lateral (escritorio) */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-slate-200 bg-white px-3 py-5 dark:border-slate-800 dark:bg-[#1c1c1e] md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-8 w-8" />
          <span className="font-semibold text-marino dark:text-sky-300">Presupuesto</span>
        </div>
        <SelectorCuenta className="mb-4" vertical />
        <button
          type="button"
          data-guia="apuntar"
          onClick={() => setApuntando(true)}
          className="mb-4 flex items-center justify-center gap-1.5 rounded-lg bg-marino px-3 py-2 text-sm font-semibold text-white hover:bg-marino-claro dark:bg-sky-700 dark:hover:bg-sky-600"
        >
          <Icono nombre="mas" className="h-4 w-4" grosor={2.4} />
          Apuntar gasto
        </button>
        <nav className="flex flex-col gap-1">
          {enlaces.map((e) => (
            <NavLink
              key={e.txt}
              to={e.to}
              end={e.end}
              data-guia={e.guia}
              className={({ isActive }) =>
                cx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium', isActive ? 'bg-marino text-white dark:bg-sky-800' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
              }
            >
              <Icono nombre={e.icono} className="h-5 w-5" />
              {e.txt}
            </NavLink>
          ))}
        </nav>
        <div className="my-3 border-t border-slate-200 dark:border-slate-800" />
        <nav className="flex flex-col gap-1" data-guia="nav-mas">
          {extras.map((e) => (
            <NavLink key={e.to} to={e.to} className={claseEnlace}>
              <Icono nombre={e.icono} className="h-5 w-5" />
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
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[#f2f2f7]/90 px-4 pb-1.5 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur dark:bg-black/85 md:hidden">
        <div className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-7 w-7" />
          <span className="font-semibold text-marino dark:text-sky-300">Presupuesto</span>
        </div>
        <div className="flex items-center gap-1">
          <EstadoGuardadoChip />
          <Link to="/buscar" aria-label="Buscar" title="Buscar" className="flex h-9 w-9 items-center justify-center rounded-full text-marino hover:bg-slate-200/70 dark:text-sky-300 dark:hover:bg-white/10">
            <Icono nombre="lupa" className="h-[22px] w-[22px]" />
          </Link>
          <BotonDiscreto />
        </div>
      </header>

      <div className="px-4 pb-1 pt-1 md:hidden [&:empty]:hidden">
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
        <Suspense fallback={<CargandoPantalla />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Navegación inferior (móvil) */}
      {masAbierto && <HojaMas enlaces={enMas} onCerrar={cerrarMas} />}
      <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-50 grid h-[calc(env(safe-area-inset-bottom)+3.5rem)] grid-cols-5 border-t border-black/10 bg-[#f9f9f9]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-white/10 dark:bg-[#161617]/95 md:hidden">
        {[inicio, mes].map((e) => (
          <NavLink key={e.txt} to={e.to} end={e.end} onClick={cerrarMas} data-guia={e.guia} className={({ isActive }) => claseTab(isActive && !masAbierto)}>
            <Icono nombre={e.icono} className="h-[26px] w-[26px]" />
            {e.txt === 'Mes actual' ? 'Mes' : e.txt}
          </NavLink>
        ))}
        <button type="button" data-guia="apuntar" onClick={() => { cerrarMas(); setApuntando(true) }} aria-label="Apuntar un gasto" title="Apuntar un gasto" className="flex items-start justify-center">
          <span className="-mt-2.5 flex h-12 w-12 items-center justify-center rounded-full bg-marino text-white shadow-md active:scale-95 dark:bg-sky-700">
            <Icono nombre="mas" className="h-6 w-6" grosor={2.4} />
          </span>
        </button>
        <NavLink to={resumen.to} onClick={cerrarMas} data-guia="nav-resumen" className={() => claseTab(pathname.startsWith('/resumen') && !masAbierto)}>
          <Icono nombre={resumen.icono} className="h-[26px] w-[26px]" />
          {resumen.txt}
        </NavLink>
        <button type="button" aria-expanded={masAbierto} data-guia="nav-mas" onClick={() => setMasAbierto((a) => !a)} className={claseTab(masAbierto || masActivo)}>
          <Icono nombre="puntos" className="h-[26px] w-[26px]" />
          Más
        </button>
      </nav>

      {apuntando && <PanelApuntar onCerrar={() => setApuntando(false)} />}
      {recorrido && <Recorrido />}

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
              <button aria-label="Cerrar" onClick={() => cerrarToast(t.id)} className="opacity-70 hover:opacity-100"><Icono nombre="cerrar" className="h-4 w-4" grosor={2} /></button>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
