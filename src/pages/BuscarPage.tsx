import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { Card, Dinero, Kpi, cx } from '../components/ui'
import { aniosConMeses } from '../lib/calculos'
import { buscar, conceptosGasto, type GrupoConcepto, type ResultadoBloque } from '../lib/buscar'
import { formatFecha, nombreMes } from '../lib/fechas'

/** Buscador: "¿cuánto llevo gastado en X este año?" */
export function BuscarPage() {
  const { datos, calc } = useStore()
  const [params, setParams] = useSearchParams()
  const anios = aniosConMeses(calc)
  const q = params.get('q') ?? ''
  const anioParam = params.get('anio')
  const anio = anioParam === 'todos' ? null : anioParam ? Number(anioParam) : (anios.at(-1) ?? null)

  const r = useMemo(() => buscar(datos, q, anio), [datos, q, anio])
  const sugerencias = useMemo(() => conceptosGasto(datos).slice(0, 14), [datos])

  function cambiar(nuevo: { q?: string; anio?: string }) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(nuevo)) {
      if (v === undefined || v === '') p.delete(k)
      else p.set(k, v)
    }
    setParams(p, { replace: true })
  }

  const periodo = anio === null ? 'en total' : `en ${anio}`
  const hayResultados = r.gastos.grupos.length + r.ingresos.grupos.length + r.deudas.length + r.notas.length > 0

  return (
    <div className="space-y-4">
      <h1 className="text-[34px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Buscar</h1>

      <Card>
        <label htmlFor="buscar" className="sr-only">Buscar concepto o persona</label>
        <input
          id="buscar"
          type="search"
          className="campo text-base"
          placeholder="Supermercado, Mercadona, regalos, Juan…"
          autoFocus
          autoComplete="off"
          value={q}
          onChange={(e) => cambiar({ q: e.target.value })}
        />
        {anios.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Periodo">
            {anios.map((a) => (
              <Chip key={a} activo={anio === a} onClick={() => cambiar({ anio: String(a) })}>{a}</Chip>
            ))}
            {anios.length > 1 && <Chip activo={anio === null} onClick={() => cambiar({ anio: 'todos' })}>Todos los años</Chip>}
          </div>
        )}
      </Card>

      {q.trim() === '' ? (
        sugerencias.length > 0 && (
          <Card titulo="Tus conceptos">
            <div className="flex flex-wrap gap-1.5">
              {sugerencias.map((s) => (
                <Chip key={s} onClick={() => cambiar({ q: s })}>{s}</Chip>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">Busca por concepto de gasto o de ingreso, por las notas de tus apuntes o por la persona que te debe dinero. No distingue mayúsculas ni tildes.</p>
          </Card>
        )
      ) : !hayResultados ? (
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No hay nada que coincida con <strong>«{q.trim()}»</strong> {periodo}.
            {anio !== null && anios.length > 1 && (
              <>
                {' '}
                <button type="button" className="text-sky-700 underline dark:text-sky-400" onClick={() => cambiar({ anio: 'todos' })}>Buscar en todos los años</button>
              </>
            )}
          </p>
        </Card>
      ) : (
        <>
          {r.gastos.grupos.length > 0 && <Bloque titulo={`Gastado ${periodo}`} bloque={r.gastos} />}
          {r.notas.length > 0 && (
            <Card
              titulo={`En las notas de tus apuntes (${r.notas.length})`}
              accion={<Dinero c={r.notas.reduce((a, n) => a + n.importe, 0)} dash={false} className="font-semibold" />}
            >
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {r.notas.map((n) => (
                  <li key={n.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium">{n.nota}</span>
                      <span className="block text-xs text-slate-500">
                        {n.concepto} · {formatFecha(n.creado_en.slice(0, 10))} ·{' '}
                        <Link to={`/mes/${n.fecha.slice(0, 7)}`} className="text-sky-700 hover:underline dark:text-sky-400">{nombreMes(n.fecha)}</Link>
                      </span>
                    </span>
                    <Dinero c={n.importe} dash={false} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {r.ingresos.grupos.length > 0 && <Bloque titulo={`Ingresado ${periodo}`} bloque={r.ingresos} />}
          {r.deudas.length > 0 && (
            <Card titulo="Te deben" accion={<Link to="/te-deben" className="text-xs text-sky-700 hover:underline dark:text-sky-400">Ver todo →</Link>}>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {r.deudas.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium">{x.persona || 'Sin nombre'}</span>
                      {x.concepto && <span className="text-slate-500"> · {x.concepto}</span>}
                      <span className="block text-xs text-slate-500">
                        {formatFecha(x.fecha)} · {x.devuelto_en ? `devuelto el ${formatFecha(x.devuelto_en)}` : 'pendiente'}
                      </span>
                    </span>
                    <Dinero c={x.importe} dash={false} className={cx(x.devuelto_en && 'text-slate-400 line-through')} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function Bloque({ titulo, bloque }: { titulo: string; bloque: ResultadoBloque }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Kpi titulo={titulo} valor={bloque.total} grande />
        <Kpi titulo="Meses" valor={String(bloque.meses)} />
        <Kpi titulo="Media al mes" valor={bloque.meses ? Math.round(bloque.total / bloque.meses) : 0} />
      </div>
      {bloque.grupos.map((g) => (
        <GrupoCard key={g.concepto} g={g} unico={bloque.grupos.length === 1} />
      ))}
    </div>
  )
}

function GrupoCard({ g, unico }: { g: GrupoConcepto; unico: boolean }) {
  const max = Math.max(...g.meses.map((m) => m.importe))
  return (
    <Card titulo={g.concepto} accion={!unico && <Dinero c={g.total} dash={false} className="font-semibold" />}>
      <ul className="space-y-1.5">
        {[...g.meses].reverse().map((m) => (
          <li key={m.fecha} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 text-sm">
            <Link to={`/mes/${m.fecha.slice(0, 7)}`} className="text-sky-800 hover:underline dark:text-sky-300">{nombreMes(m.fecha)}</Link>
            <span className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden>
              <span className="block h-full rounded-full bg-[var(--series-1)]" style={{ width: `${max > 0 ? Math.max(2, (m.importe / max) * 100) : 0}%` }} />
            </span>
            <Dinero c={m.importe} dash={false} className="text-right" />
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Chip({ activo, onClick, children }: { activo?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cx(
        'rounded-full border px-3 py-1 text-sm',
        activo
          ? 'border-marino bg-marino text-white dark:border-sky-700 dark:bg-sky-800'
          : 'border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700',
      )}
    >
      {children}
    </button>
  )
}
