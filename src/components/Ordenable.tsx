import { useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'

interface Arrastre {
  desde: number
  hasta: number
  dy: number
  alto: number
}

/**
 * Reordenar filas arrastrando un asa (⋮⋮). Funciona con ratón y con el dedo (pointer events).
 * Uso: const o = useOrdenable(n, (desde, hasta) => ...); en cada fila ref={o.refFila(i)} style={o.estilo(i)}
 * y en el asa {...o.asa(i)}.
 */
export function useOrdenable(n: number, onMover: (desde: number, hasta: number) => void) {
  const filas = useRef<(HTMLElement | null)[]>([])
  const [arr, setArr] = useState<Arrastre | null>(null)
  const inicio = useRef<{ y: number; medios: number[]; tops: number[] } | null>(null)

  function refFila(i: number) {
    return (el: HTMLElement | null) => {
      filas.current[i] = el
    }
  }

  function asa(i: number) {
    return {
      role: 'button',
      tabIndex: 0,
      'aria-label': 'Arrastrar para reordenar (o usa las flechas arriba/abajo)',
      title: 'Arrastrar para reordenar',
      style: { touchAction: 'none', cursor: arr ? 'grabbing' : 'grab' } as CSSProperties,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowUp' && i > 0) {
          e.preventDefault()
          onMover(i, i - 1)
        } else if (e.key === 'ArrowDown' && i < n - 1) {
          e.preventDefault()
          onMover(i, i + 1)
        }
      },
      onPointerDown: (e: RPointerEvent<HTMLElement>) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        const rects = filas.current.slice(0, n).map((el) => el?.getBoundingClientRect())
        inicio.current = {
          y: e.clientY,
          medios: rects.map((r) => (r ? r.top + r.height / 2 : 0)),
          tops: rects.map((r) => r?.top ?? 0),
        }
        setArr({ desde: i, hasta: i, dy: 0, alto: rects[i]?.height ?? 40 })
      },
      onPointerMove: (e: RPointerEvent<HTMLElement>) => {
        if (!arr || !inicio.current) return
        const dy = e.clientY - inicio.current.y
        const centro = inicio.current.medios[arr.desde] + dy
        let hasta = arr.desde
        const m = inicio.current.medios
        while (hasta < n - 1 && centro > m[hasta + 1]) hasta++
        while (hasta > 0 && centro < m[hasta - 1]) hasta--
        setArr({ ...arr, dy, hasta })
      },
      onPointerUp: () => {
        if (arr && arr.hasta !== arr.desde) onMover(arr.desde, arr.hasta)
        setArr(null)
        inicio.current = null
      },
      onPointerCancel: () => {
        setArr(null)
        inicio.current = null
      },
    }
  }

  function estilo(i: number): CSSProperties | undefined {
    if (!arr) return undefined
    if (i === arr.desde) {
      return { transform: `translateY(${arr.dy}px)`, position: 'relative', zIndex: 20, boxShadow: '0 6px 20px rgba(0,0,0,.15)', background: 'var(--surface)', borderRadius: 8 }
    }
    let desplazamiento = 0
    if (arr.desde < arr.hasta && i > arr.desde && i <= arr.hasta) desplazamiento = -arr.alto
    if (arr.desde > arr.hasta && i < arr.desde && i >= arr.hasta) desplazamiento = arr.alto
    return { transform: `translateY(${desplazamiento}px)`, transition: 'transform 150ms' }
  }

  return { refFila, asa, estilo, arrastrando: arr !== null }
}

export function Asa(props: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      className="flex h-8 w-5 shrink-0 select-none items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-marino-claro/40 dark:hover:bg-slate-800"
    >
      ⋮⋮
    </span>
  )
}
