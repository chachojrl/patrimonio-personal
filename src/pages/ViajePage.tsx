import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { Boton, Card, CeldaImporte, Dinero, Kpi, Modal, cx } from '../components/ui'
import { CATEGORIAS, enEuros, formatMoneda, obtenerCambio, resumenViaje, textoCambio } from '../lib/viajes'
import { parseImporte } from '../lib/money'
import { useEur, useDiscreto, OCULTO } from '../lib/discreto'
import { formatFecha, hoyISO, nombreMes } from '../lib/fechas'
import { anadirGasto, mesesOrdenados, uid } from '../lib/operaciones'
import type { CategoriaViaje, Gasto, GastoViaje, Viaje } from '../lib/tipos'
import { Icono, type NombreIcono } from '../components/ios'

const ICONO_CATEGORIA: Record<CategoriaViaje, NombreIcono> = { alojamiento: 'cama', transporte: 'avion', comida: 'comida', ocio: 'ticket', compras: 'carrito', otros: 'archivo' }

export function ViajePage() {
  const { id } = useParams()
  const { datos } = useStore()
  const v = datos.viajes.find((x) => x.id === id)
  if (!v) {
    return (
      <Card>
        <p className="mb-2">Este viaje ya no existe.</p>
        <Link to="/viajes" className="text-sky-700 underline dark:text-sky-400">Volver a los viajes</Link>
      </Card>
    )
  }
  return <DetalleViaje v={v} />
}

function DetalleViaje({ v }: { v: Viaje }) {
  const { datos, actualizar, borrar, avisar } = useStore()
  const navigate = useNavigate()
  const eur = useEur()
  const gastos = useMemo(() => datos.viaje_gastos.filter((g) => g.viaje_id === v.id).sort((a, b) => b.fecha.localeCompare(a.fecha)), [datos.viaje_gastos, v.id])
  const r = resumenViaje(v, gastos)
  const [actualizando, setActualizando] = useState(false)
  const [cambioTxt, setCambioTxt] = useState(String(v.cambio).replace('.', ','))
  const [cerrarAbierto, setCerrarAbierto] = useState(false)
  const [borrarAbierto, setBorrarAbierto] = useState(false)

  async function actualizarCambio() {
    setActualizando(true)
    try {
      const c = await obtenerCambio(v.moneda)
      actualizar('viajes', v.id, { cambio: c })
      setCambioTxt(String(c).replace('.', ','))
      avisar({ texto: `Cambio actualizado: ${textoCambio(v.moneda, c)}. Se usará en los gastos nuevos.` })
    } catch (e) {
      avisar({ texto: (e as Error).message, tipo: 'error' })
    } finally {
      setActualizando(false)
    }
  }

  function guardarCambio() {
    const n = Number(cambioTxt.replace(',', '.'))
    if (!(n > 0)) {
      avisar({ texto: 'El cambio tiene que ser un número mayor que 0.', tipo: 'error' })
      setCambioTxt(String(v.cambio).replace('.', ','))
      return
    }
    if (n !== v.cambio) actualizar('viajes', v.id, { cambio: n })
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/viajes" className="text-sm text-sky-700 hover:underline dark:text-sky-400">← Viajes</Link>
        <input
          aria-label="Nombre del viaje"
          className="celda -ml-2 mt-1 text-[28px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-[34px]"
          value={v.nombre}
          disabled={v.cerrado}
          onChange={(e) => actualizar('viajes', v.id, { nombre: e.target.value })}
        />
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          {v.fecha_inicio && <span>{formatFecha(v.fecha_inicio)}{v.fecha_fin && ` – ${formatFecha(v.fecha_fin)}`}</span>}
          {v.cerrado && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">Cerrado</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Gastado" valor={r.total} grande />
        <Kpi titulo={r.queda !== null && r.queda < 0 ? 'Te has pasado' : 'Queda'} valor={r.queda === null ? '–' : Math.abs(r.queda)} />
        <Kpi titulo="Media por día" valor={r.mediaDiaria} sub={r.dias ? `${r.dias} día${r.dias > 1 ? 's' : ''}` : undefined} />
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:p-4">
          <div className="text-[13px] text-slate-500 dark:text-slate-400">Presupuesto (€)</div>
          <CeldaImporte
            ariaLabel="Presupuesto del viaje"
            valor={v.presupuesto}
            permitirVacio
            placeholder="Sin presupuesto"
            disabled={v.cerrado}
            className="-ml-2 mt-1 text-left text-lg font-semibold"
            onCambio={(x) => actualizar('viajes', v.id, { presupuesto: x })}
          />
        </div>
      </div>

      {r.pct !== null && (
        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-label="Presupuesto gastado" aria-valuenow={Math.round(r.pct * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className={cx('h-full rounded-full', r.pct > 1 ? 'bg-red-500' : r.pct >= 0.9 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.min(100, r.pct * 100)}%` }} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {!v.cerrado && <NuevoGasto v={v} />}
          <Card titulo={`Gastos (${gastos.length})`}>
            {gastos.length === 0 ? (
              <p className="text-sm text-slate-500">Aún no hay gastos.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {gastos.map((g) => <FilaGasto key={g.id} g={g} cerrado={v.cerrado} onBorrar={() => borrar('viaje_gastos', g.id)} />)}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          <Card titulo="Por categoría">
            {r.porCategoria.length === 0 ? (
              <p className="text-sm text-slate-500">Sin gastos todavía.</p>
            ) : (
              <ul className="space-y-2">
                {r.porCategoria.map((c) => {
                  const cat = CATEGORIAS.find((x) => x.id === c.id)!
                  return (
                    <li key={c.id}>
                      <div className="flex justify-between text-sm"><span className="inline-flex items-center gap-1.5"><Icono nombre={ICONO_CATEGORIA[cat.id]} className="h-4 w-4 text-slate-500" />{cat.txt}</span><Dinero c={c.total} dash={false} /></div>
                      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden>
                        <div className="h-full rounded-full bg-[var(--series-1)]" style={{ width: `${r.total ? (c.total / r.total) * 100 : 0}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
          {v.moneda !== 'EUR' && (
            <Card titulo="Tipo de cambio">
              <div className="flex items-center gap-2 text-sm">
                <span className="whitespace-nowrap">1 {v.moneda} =</span>
                <input
                  aria-label="Euros por unidad"
                  className="campo num w-28 text-right"
                  inputMode="decimal"
                  value={cambioTxt}
                  disabled={v.cerrado}
                  onChange={(e) => setCambioTxt(e.target.value)}
                  onBlur={guardarCambio}
                  onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
                />
                <span>€</span>
              </div>
              {!v.cerrado && <Boton className="mt-2 text-xs" onClick={actualizarCambio} disabled={actualizando}>{actualizando ? 'Consultando…' : '↻ Usar el cambio de hoy (BCE)'}</Boton>}
              <p className="mt-2 text-xs text-slate-500">Cada gasto guarda el cambio del momento en que lo apuntas: cambiarlo aquí no altera los ya apuntados.</p>
            </Card>
          )}
          <Card titulo="Al volver">
            {v.cerrado ? (
              <div className="space-y-2 text-sm">
                <p className="text-slate-600 dark:text-slate-300">El viaje está cerrado.</p>
                <Boton className="text-xs" onClick={() => actualizar('viajes', v.id, { cerrado: false })}>Reabrir</Boton>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-300">Pasa el total ({eur(r.total, { dash: false })}) a un mes de tu presupuesto y cierra el viaje.</p>
                <Boton className="mt-2" variante="primario" onClick={() => setCerrarAbierto(true)} disabled={r.total === 0}>Cerrar y pasar al mes…</Boton>
              </>
            )}
            <button type="button" className="mt-3 block text-xs text-red-600 hover:underline" onClick={() => setBorrarAbierto(true)}>Borrar viaje</button>
          </Card>
        </div>
      </div>

      <CerrarViaje v={v} total={r.total} abierto={cerrarAbierto} onCerrar={() => setCerrarAbierto(false)} />
      <Modal
        abierto={borrarAbierto}
        onCerrar={() => setBorrarAbierto(false)}
        titulo={`¿Borrar «${v.nombre}»?`}
        pie={
          <>
            <Boton onClick={() => setBorrarAbierto(false)}>Cancelar</Boton>
            <Boton variante="peligro" onClick={() => { borrar('viajes', v.id); navigate('/viajes') }}>Borrar</Boton>
          </>
        }
      >
        <p>Se borran el viaje y sus {gastos.length} gastos. Lo que ya hayas pasado a un mes se queda en ese mes.</p>
      </Modal>
    </div>
  )
}

function FilaGasto({ g, cerrado, onBorrar }: { g: GastoViaje; cerrado: boolean; onBorrar: () => void }) {
  const discreto = useDiscreto()
  const cat = CATEGORIAS.find((x) => x.id === g.categoria) ?? CATEGORIAS[5]
  return (
    <li className="flex items-center gap-3 py-2">
      <Icono nombre={ICONO_CATEGORIA[cat.id]} className="h-5 w-5 text-marino dark:text-sky-300" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{g.concepto || cat.txt}</span>
        <span className="text-xs text-slate-500">{formatFecha(g.fecha)} · {cat.txt}</span>
      </span>
      <span className="text-right">
        <Dinero c={enEuros(g)} dash={false} className="block text-sm font-semibold" />
        {g.moneda !== 'EUR' && <span className="num text-xs text-slate-500">{discreto ? OCULTO : formatMoneda(g.importe, g.moneda)}</span>}
      </span>
      {!cerrado && (
        <button type="button" aria-label={`Borrar ${g.concepto || cat.txt}`} title="Borrar" onClick={onBorrar} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"><Icono nombre="cerrar" className="h-4 w-4" grosor={2} /></button>
      )}
    </li>
  )
}

function NuevoGasto({ v }: { v: Viaje }) {
  const { insertar } = useStore()
  const eur = useEur()
  const [f, setF] = useState({ concepto: '', importe: '', moneda: v.moneda, categoria: 'comida' as CategoriaViaje, fecha: hoyISO() })
  const [error, setError] = useState<string | null>(null)
  const importe = parseImporte(f.importe)
  const cambio = f.moneda === 'EUR' ? 1 : v.cambio

  function guardar(e: FormEvent) {
    e.preventDefault()
    if (importe === null || importe <= 0) return setError('Escribe el importe.')
    insertar('viaje_gastos', { id: uid(), viaje_id: v.id, fecha: f.fecha || hoyISO(), concepto: f.concepto.trim(), categoria: f.categoria, importe, moneda: f.moneda, cambio } satisfies GastoViaje)
    setF({ ...f, concepto: '', importe: '' })
    setError(null)
  }

  return (
    <Card titulo="Apuntar gasto">
      <form onSubmit={guardar} className="space-y-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categoría">
          {CATEGORIAS.map((c) => (
            <button key={c.id} type="button" aria-pressed={f.categoria === c.id} onClick={() => setF({ ...f, categoria: c.id })}
              className={cx('rounded-full border px-3 py-1 text-sm', f.categoria === c.id ? 'border-marino bg-marino text-white dark:border-sky-700 dark:bg-sky-800' : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800')}>
              {c.txt}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem_6rem_10rem]">
          <input aria-label="Concepto" className="campo" placeholder="Cena, metro, museo…" value={f.concepto} onChange={(e) => setF({ ...f, concepto: e.target.value })} />
          <input aria-label="Importe" className="campo num text-right" inputMode="decimal" placeholder="0,00" value={f.importe} onChange={(e) => setF({ ...f, importe: e.target.value })} />
          <select aria-label="Moneda" className="campo" value={f.moneda} onChange={(e) => setF({ ...f, moneda: e.target.value })}>
            {[...new Set([v.moneda, 'EUR'])].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input aria-label="Fecha" className="campo" type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            {importe !== null && importe > 0 && f.moneda !== 'EUR' ? `≈ ${eur(Math.round(importe * cambio), { dash: false })} (${textoCambio(f.moneda, cambio)})` : ''}
          </span>
          <Boton type="submit" variante="primario"><Icono nombre="mas" className="h-4 w-4" grosor={2.4} />Apuntar</Boton>
        </div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </form>
    </Card>
  )
}

const NUEVA_FILA = '__nueva__'

/** Pasa el total del viaje a un mes (como apunte de un gasto o como fila nueva) y lo cierra. */
function CerrarViaje({ v, total, abierto, onCerrar }: { v: Viaje; total: number; abierto: boolean; onCerrar: () => void }) {
  const { datos, aplicar, actualizar, insertar, repo, obtener, avisar } = useStore()
  const eur = useEur()
  const abiertos = mesesOrdenados(datos).filter((m) => m.estado === 'Abierto')
  const [mesId, setMesId] = useState(abiertos.at(-1)?.id ?? '')
  const gastos: Gasto[] = datos.expenses.filter((g) => g.month_id === mesId && !g.aportacion_cuenta).sort((a, b) => a.orden - b.orden)
  const sugerido = gastos.find((g) => /viaj|vacacion|ocio/i.test(g.concepto))
  const [destino, setDestino] = useState<string>(sugerido?.id ?? NUEVA_FILA)

  function confirmar() {
    const mes = abiertos.find((m) => m.id === mesId)
    if (!mes) return
    const nota = `Viaje: ${v.nombre}`
    if (destino === NUEVA_FILA) {
      const orden = Math.max(-1, ...datos.expenses.filter((g) => g.month_id === mes.id).map((g) => g.orden)) + 1
      insertar('expenses', { id: uid(), month_id: mes.id, concepto: `Viaje: ${v.nombre}`, importe: total, orden, fijo: false, presupuesto: null, fecha_vencimiento: null } satisfies Gasto)
    } else {
      const r = anadirGasto(obtener(), destino, total, undefined, nota)
      aplicar(r.datos, [() => repo.insertar('expense_entries', [r.apunte])], mes.id)
      actualizar('expenses', destino, { importe: r.gasto.importe })
    }
    actualizar('viajes', v.id, { cerrado: true })
    avisar({ texto: `Pasado ${eur(total, { dash: false })} a ${nombreMes(mes.fecha)}. Viaje cerrado.` })
    onCerrar()
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Cerrar el viaje"
      pie={
        <>
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="primario" onClick={confirmar} disabled={!mesId}>Pasar {eur(total, { dash: false })} y cerrar</Boton>
        </>
      }
    >
      {abiertos.length === 0 ? (
        <p>No hay ningún mes abierto al que pasar el gasto. Crea o reabre un mes.</p>
      ) : (
        <>
          <label className="block">
            Mes
            <select className="campo mt-1" value={mesId} onChange={(e) => { setMesId(e.target.value); setDestino(NUEVA_FILA) }}>
              {abiertos.map((m) => <option key={m.id} value={m.id}>{nombreMes(m.fecha)}</option>)}
            </select>
          </label>
          <label className="block">
            Cómo apuntarlo
            <select className="campo mt-1" value={destino} onChange={(e) => setDestino(e.target.value)}>
              <option value={NUEVA_FILA}>+ Fila nueva «Viaje: {v.nombre}»</option>
              {gastos.map((g) => <option key={g.id} value={g.id}>Sumarlo a «{g.concepto}»</option>)}
            </select>
          </label>
          <p className="text-xs text-slate-500">Podrás reabrir el viaje si te falta algo (lo ya pasado al mes no se duplica: ajústalo allí).</p>
        </>
      )}
    </Modal>
  )
}
