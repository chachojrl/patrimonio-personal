// Recorrido guiado por Inicio: ilumina los botones de verdad y explica para qué sirven.
// Cada paso busca un elemento con data-guia="…" (el que esté visible: móvil o escritorio).
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { terminarRecorrido } from '../lib/guia'

interface Paso {
  /** Elemento a iluminar; sin él, la tarjeta sale en el centro. */
  guia?: string
  titulo: string
  texto: string
}

const PASOS: Paso[] = [
  { titulo: 'Bienvenido', texto: 'En un minuto te enseño dónde está cada cosa. Puedes salir cuando quieras.' },
  { guia: 'patrimonio', titulo: 'Tu patrimonio', texto: 'Todo tu dinero sumado: disponible, cuenta remunerada e inversiones, y cómo ha cambiado. Toca la línea para ver el historial.' },
  { guia: 'apuntar', titulo: 'Apuntar un gasto', texto: 'Desde cualquier pantalla: eliges el concepto, escribes el importe y listo. Se suma al gasto del mes abierto y puedes deshacerlo.' },
  { guia: 'nav-mes', titulo: 'El mes', texto: 'Tu hoja del mes, como en el Excel: ingresos, gastos, ahorro y traspasos. Desde aquí creas el mes siguiente y cierras el actual.' },
  { guia: 'nav-resumen', titulo: 'Resumen del año', texto: 'Cómo va el año mes a mes, con una gráfica de dónde está tu dinero y tu año en cifras.' },
  { guia: 'nav-mas', titulo: 'Más', texto: 'El resto de secciones: Huchas, Futuro (cuánto podrías tener y cuándo vivir de tus ahorros), Logros, Te deben, Viajes, la lista de la compra, «¿Me lo puedo permitir?», Historial y Ajustes.' },
  { guia: 'discreto', titulo: 'Ocultar cifras', texto: 'Si abres la app delante de otras personas, toca el ojo y los importes se cambian por •••• €.' },
  { titulo: '¡Listo!', texto: 'En Ajustes › Guía de uso tienes cada función explicada con más detalle, y puedes repetir este recorrido.' },
]

/** El elemento visible con ese data-guia (hay uno para el móvil y otro para el escritorio). */
function buscar(guia: string): HTMLElement | null {
  const todos = [...document.querySelectorAll<HTMLElement>(`[data-guia="${guia}"]`)]
  return todos.find((e) => {
    const r = e.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }) ?? null
}

export function Recorrido() {
  const [n, setN] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const paso = PASOS[n]
  const ultimo = n === PASOS.length - 1

  // El recorrido es por Inicio
  useEffect(() => {
    if (pathname !== '/') navigate('/')
  }, [pathname, navigate])

  const medir = useCallback(() => {
    const el = paso.guia ? buscar(paso.guia) : null
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
      setRect(el.getBoundingClientRect())
    } else setRect(null)
  }, [paso])

  useLayoutEffect(() => {
    medir()
    const t = setTimeout(medir, 150) // por si la pantalla aún se está pintando
    window.addEventListener('resize', medir)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', medir)
    }
  }, [medir, pathname])

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') terminarRecorrido()
      else if (e.key === 'ArrowRight') setN((x) => Math.min(PASOS.length - 1, x + 1))
      else if (e.key === 'ArrowLeft') setN((x) => Math.max(0, x - 1))
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [])

  const M = 6 // margen alrededor del elemento iluminado
  const alto = typeof window !== 'undefined' ? window.innerHeight : 800
  // La tarjeta va debajo del elemento si cabe; si no, encima
  const abajo = rect ? rect.bottom + M + 12 : 0
  const ponerArriba = rect ? abajo + 200 > alto : false
  // En pantallas anchas, la tarjeta junto al elemento; en el móvil, de lado a lado
  const ancho = typeof window !== 'undefined' ? window.innerWidth : 400
  const horizontal = rect && ancho >= 640 ? { left: Math.min(Math.max(16, rect.left), ancho - 400), right: 'auto', margin: 0, width: 384 } : {}

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="titulo-recorrido">
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-[14px] shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] ring-2 ring-white transition-all duration-300 motion-reduce:transition-none"
          style={{ left: rect.left - M, top: rect.top - M, width: rect.width + M * 2, height: rect.height + M * 2 }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}
      <div
        className="absolute inset-x-4 mx-auto max-w-sm rounded-[14px] bg-white p-4 text-slate-900 shadow-2xl dark:bg-[#2c2c2e] dark:text-white"
        style={rect ? { ...(ponerArriba ? { bottom: alto - rect.top + M + 12 } : { top: abajo }), ...horizontal } : { top: '50%', transform: 'translateY(-50%)' }}
      >
        <div className="mb-1 text-[13px] text-slate-500 dark:text-slate-400">{n + 1} de {PASOS.length}</div>
        <h2 id="titulo-recorrido" className="text-[20px] font-bold">{paso.titulo}</h2>
        <p className="mt-1 text-[15px] leading-snug text-slate-600 dark:text-slate-300" aria-live="polite">{paso.texto}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          {!ultimo ? (
            <button type="button" onClick={terminarRecorrido} className="min-h-11 px-1 text-[15px] text-slate-500 dark:text-slate-400">Saltar</button>
          ) : <span />}
          <div className="flex gap-2">
            {n > 0 && (
              <button type="button" onClick={() => setN(n - 1)} className="min-h-11 rounded-full px-4 text-[15px] font-medium text-marino dark:text-sky-300">Atrás</button>
            )}
            <button
              type="button"
              autoFocus
              onClick={() => (ultimo ? terminarRecorrido() : setN(n + 1))}
              className="min-h-11 rounded-full bg-marino px-5 text-[15px] font-semibold text-white dark:bg-sky-700"
            >
              {n === 0 ? 'Empezar' : ultimo ? 'Terminar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
