// «Tu año en cifras»: el resumen del año como historias, a pantalla completa. Toca a la derecha para
// avanzar y a la izquierda para volver; mantén pulsado para pararlo.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { anioEnCifras, type AnioEnCifras } from '../lib/anioEnCifras'
import { OCULTO, useDiscreto } from '../lib/discreto'
import { formatEUR } from '../lib/money'
import { MESES, partes } from '../lib/fechas'
import { Icono } from '../components/ios'
import { cx } from '../components/ui'

const DURACION = 7000
const FONDOS = ['#1F3864', '#0E4A35', '#1C1C1E', '#5B2245', '#7A3412', '#1F3864', '#0E4A35', '#1C1C1E']

const nombreDelMes = (fecha: string) => MESES[partes(fecha).mes - 1]
const pct = (p: number | null) => (p === null ? '' : `${p >= 0 ? '+' : '−'}${Math.abs(Math.round(p * 100))} %`)

interface Diapositiva {
  id: string
  contenido: ReactNode
}

export function AnioEnCifrasPage() {
  const { anio: anioParam } = useParams()
  const navigate = useNavigate()
  const { datos, calc } = useStore()
  const anio = Number(anioParam)
  const a = useMemo(() => (Number.isInteger(anio) ? anioEnCifras(datos, calc, anio) : null), [datos, calc, anio])
  const cerrar = useCallback(() => (window.history.length > 1 ? navigate(-1) : navigate('/')), [navigate])

  if (!a) {
    return (
      <Pantalla fondo="#1C1C1E" onCerrar={cerrar}>
        <p className="text-[22px] font-semibold">No hay meses apuntados en {anioParam}.</p>
      </Pantalla>
    )
  }
  return <Historias a={a} onCerrar={cerrar} />
}

function Historias({ a, onCerrar }: { a: AnioEnCifras; onCerrar: () => void }) {
  // En las historias, euros redondeados: se leen mejor en grande (el modo discreto se respeta)
  const discreto = useDiscreto()
  const e = (c: number) => (discreto ? OCULTO : formatEUR(c, { dash: false, redondear: true }))
  const [i, setI] = useState(0)
  const [pausa, setPausa] = useState(false)
  const [compartido, setCompartido] = useState(false)
  const reducido = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const diapositivas: Diapositiva[] = [
    {
      id: 'portada',
      contenido: (
        <>
          <p className="text-[20px] font-medium opacity-80">Tu</p>
          <p className="text-[88px] font-black leading-none tracking-tight">{a.anio}</p>
          <p className="mt-2 text-[34px] font-bold leading-tight">en cifras</p>
          <p className="mt-8 text-[17px] opacity-80">{a.meses} {a.meses === 1 ? 'mes apuntado' : 'meses apuntados'}. Toca para empezar.</p>
        </>
      ),
    },
    {
      id: 'patrimonio',
      contenido: (
        <>
          <p className="text-[20px] font-medium opacity-80">Tu patrimonio {a.patrimonio.diferencia >= 0 ? 'creció' : 'bajó'}</p>
          <p className="num mt-2 text-[56px] font-black leading-none tracking-tight">
            {a.patrimonio.diferencia > 0 ? '+' : ''}{e(a.patrimonio.diferencia)}
          </p>
          {a.patrimonio.pct !== null && <p className="mt-3 text-[28px] font-bold opacity-90">{pct(a.patrimonio.pct)}</p>}
          <p className="mt-8 text-[17px] opacity-80">De {e(a.patrimonio.inicio)} a {e(a.patrimonio.fin)}.</p>
        </>
      ),
    },
    {
      id: 'dinero',
      contenido: (
        <>
          <p className="text-[20px] font-medium opacity-80">Este año entraron</p>
          <p className="num mt-1 text-[48px] font-black leading-none tracking-tight">{e(a.ingresos)}</p>
          <p className="mt-6 text-[20px] font-medium opacity-80">y gastaste</p>
          <p className="num mt-1 text-[48px] font-black leading-none tracking-tight">{e(a.gastos)}</p>
          {a.pctAhorro !== null && a.ahorro > 0 && (
            <p className="mt-8 text-[17px] opacity-80">Apartaste {e(a.ahorro)} para ahorro e inversiones: el {Math.round(a.pctAhorro * 100)} % de lo que entró.</p>
          )}
        </>
      ),
    },
    ...(a.mejorMes
      ? [{
          id: 'meses',
          contenido: (
            <>
              <p className="text-[20px] font-medium opacity-80">Tu mejor mes fue</p>
              <p className="mt-1 text-[56px] font-black leading-none tracking-tight">{nombreDelMes(a.mejorMes.fecha)}</p>
              <p className="mt-3 text-[20px] opacity-90">Te sobraron {e(a.mejorMes.neto)}.</p>
              {a.mesMasGasto && (
                <p className="mt-8 text-[17px] opacity-80">El que más gastaste: {nombreDelMes(a.mesMasGasto.fecha).toLowerCase()}, con {e(a.mesMasGasto.gastos)}.</p>
              )}
            </>
          ),
        }]
      : []),
    ...(a.topGastos.length
      ? [{
          id: 'conceptos',
          contenido: (
            <>
              <p className="mb-6 text-[20px] font-medium opacity-80">Donde más se te fue</p>
              <ol className="space-y-5">
                {a.topGastos.map((g, n) => (
                  <li key={g.concepto}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[24px] font-bold">{n + 1}. {g.concepto}</span>
                      <span className="num shrink-0 text-[17px] opacity-90">{e(g.total)}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/20">
                      <div className="h-full rounded-full bg-white" style={{ width: `${Math.max(4, g.pct * 100)}%` }} />
                    </div>
                    <div className="mt-1 text-[13px] opacity-75">{Math.round(g.pct * 100)} % de tus gastos</div>
                  </li>
                ))}
              </ol>
            </>
          ),
        }]
      : []),
    ...(a.apuntes > 0
      ? [{
          id: 'apuntes',
          contenido: (
            <>
              <p className="text-[20px] font-medium opacity-80">Apuntaste</p>
              <p className="num mt-1 text-[72px] font-black leading-none tracking-tight">{a.apuntes.toLocaleString('es-ES')}</p>
              <p className="text-[24px] font-bold">{a.apuntes === 1 ? 'gasto' : 'gastos'}</p>
              {a.masApuntado && <p className="mt-8 text-[17px] opacity-90">El que más: {a.masApuntado.concepto}, {a.masApuntado.veces} {a.masApuntado.veces === 1 ? 'vez' : 'veces'}.</p>}
              {a.mayorApunte && (
                <p className="mt-2 text-[17px] opacity-80">
                  El más grande: {e(a.mayorApunte.importe)} en {a.mayorApunte.concepto}{a.mayorApunte.nota ? ` («${a.mayorApunte.nota}»)` : ''}.
                </p>
              )}
            </>
          ),
        }]
      : []),
    ...(a.viajes.length
      ? [{
          id: 'viajes',
          contenido: (
            <>
              <p className="text-[20px] font-medium opacity-80">{a.viajes.length === 1 ? 'Te fuiste de viaje' : `Hiciste ${a.viajes.length} viajes`}</p>
              <ul className="mt-6 space-y-3">
                {a.viajes.map((v) => (
                  <li key={v.nombre} className="flex items-baseline justify-between gap-3 text-[22px] font-bold">
                    <span className="truncate">{v.nombre}</span>
                    <span className="num shrink-0 text-[17px] font-normal opacity-90">{e(v.total)}</span>
                  </li>
                ))}
              </ul>
            </>
          ),
        }]
      : []),
    {
      id: 'final',
      contenido: (
        <>
          <p className="text-[34px] font-black leading-tight">Así fue tu {a.anio}</p>
          <ul className="mt-6 space-y-2 text-[17px] opacity-90">
            <li>Patrimonio: {a.patrimonio.diferencia > 0 ? '+' : ''}{e(a.patrimonio.diferencia)}</li>
            <li>Entraron {e(a.ingresos)} y gastaste {e(a.gastos)}</li>
            {a.mejorMes && <li>Mejor mes: {nombreDelMes(a.mejorMes.fecha).toLowerCase()}</li>}
            {a.topGastos[0] && <li>Mayor gasto: {a.topGastos[0].concepto}</li>}
          </ul>
          <div className="mt-10 flex flex-wrap gap-3" onPointerDown={(ev) => ev.stopPropagation()} onClick={(ev) => ev.stopPropagation()}>
            <button
              type="button"
              onClick={async () => {
                const texto = textoParaCompartir(a, e)
                try {
                  if (navigator.share) await navigator.share({ title: `Mi ${a.anio} en cifras`, text: texto })
                  else {
                    await navigator.clipboard.writeText(texto)
                    setCompartido(true)
                  }
                } catch {
                  /* cancelado */
                }
              }}
              className="flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-[17px] font-semibold text-slate-900"
            >
              <Icono nombre="descargar" className="h-5 w-5 rotate-180" grosor={2} />
              {compartido ? 'Copiado' : 'Compartir'}
            </button>
            <button type="button" onClick={onCerrar} className="min-h-11 rounded-full bg-white/15 px-5 text-[17px] font-semibold">Cerrar</button>
          </div>
        </>
      ),
    },
  ]

  const total = diapositivas.length
  const siguiente = useCallback(() => setI((x) => (x < total - 1 ? x + 1 : x)), [total])
  const anterior = useCallback(() => setI((x) => Math.max(0, x - 1)), [])

  // Avanza sola (salvo con «Reducir movimiento», en pausa o en la última)
  const ultima = i === total - 1
  useEffect(() => {
    if (reducido || pausa || ultima) return
    const t = setTimeout(siguiente, DURACION)
    return () => clearTimeout(t)
  }, [i, pausa, reducido, ultima, siguiente])

  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === 'ArrowRight' || ev.key === ' ') siguiente()
      else if (ev.key === 'ArrowLeft') anterior()
      else if (ev.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [siguiente, anterior, onCerrar])

  const inicioToque = useRef(0)
  const d = diapositivas[i]
  return (
    <Pantalla fondo={FONDOS[i % FONDOS.length]} onCerrar={onCerrar}>
      {/* Barras de progreso */}
      <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+0.75rem)] flex gap-1" aria-hidden>
        {diapositivas.map((x, n) => (
          <div key={x.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              key={`${x.id}-${i}`}
              className={cx('h-full bg-white', n === i && !reducido && !ultima ? 'progreso-historia' : '')}
              style={{ width: n < i || (n === i && (reducido || ultima)) ? '100%' : n === i ? undefined : '0%', animationPlayState: pausa ? 'paused' : 'running', animationDuration: `${DURACION}ms` }}
            />
          </div>
        ))}
      </div>

      {/* Zonas para tocar: izquierda vuelve, derecha avanza; mantener pulsado para */}
      <div
        className="absolute inset-0"
        onPointerDown={() => {
          inicioToque.current = Date.now()
          setPausa(true)
        }}
        onPointerUp={(ev) => {
          setPausa(false)
          if (Date.now() - inicioToque.current > 400) return
          const x = ev.clientX / window.innerWidth
          if (x < 0.33) anterior()
          else siguiente()
        }}
        onPointerLeave={() => setPausa(false)}
      />

      <div key={d.id} className="anim-historia pointer-events-none relative w-full max-w-md [&_button]:pointer-events-auto" aria-live="polite">
        {d.contenido}
      </div>

      <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1rem)] flex justify-between px-4">
        <button type="button" onClick={anterior} disabled={i === 0} aria-label="Anterior" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 disabled:opacity-0">
          <Icono nombre="anterior" className="h-6 w-6" grosor={2.2} />
        </button>
        <span className="self-center text-[13px] opacity-70">{i + 1} de {total}</span>
        <button type="button" onClick={siguiente} disabled={ultima} aria-label="Siguiente" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 disabled:opacity-0">
          <Icono nombre="siguiente" className="h-6 w-6" grosor={2.2} />
        </button>
      </div>
    </Pantalla>
  )
}

function Pantalla({ fondo, onCerrar, children }: { fondo: string; onCerrar: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-7 text-white transition-colors duration-500 motion-reduce:transition-none"
      style={{ backgroundColor: fondo }}
      role="dialog"
      aria-modal="true"
      aria-label="Tu año en cifras"
    >
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar"
        className="absolute right-3 top-[calc(env(safe-area-inset-top)+1.5rem)] z-10 flex h-11 w-11 items-center justify-center rounded-full"
      >
        <Icono nombre="cerrar" className="h-6 w-6" grosor={2.2} />
      </button>
      {children}
    </div>
  )
}

function textoParaCompartir(a: AnioEnCifras, e: (c: number) => string): string {
  const l = [`Mi ${a.anio} en cifras`]
  l.push(`Patrimonio: ${a.patrimonio.diferencia > 0 ? '+' : ''}${e(a.patrimonio.diferencia)}${a.patrimonio.pct !== null ? ` (${pct(a.patrimonio.pct)})` : ''}`)
  l.push(`Entraron ${e(a.ingresos)} y salieron ${e(a.gastos)}`)
  if (a.mejorMes) l.push(`Mejor mes: ${nombreDelMes(a.mejorMes.fecha).toLowerCase()} (${e(a.mejorMes.neto)})`)
  if (a.topGastos.length) l.push(`Donde más se fue: ${a.topGastos.map((g) => g.concepto).join(', ')}`)
  return l.join('\n')
}
