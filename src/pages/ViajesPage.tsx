import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { useCuentas } from '../data/cuentas'
import { Boton, Card, Dinero, cx } from '../components/ui'
import { MONEDAS, obtenerCambio, resumenViaje, textoCambio } from '../lib/viajes'
import { parseImporte } from '../lib/money'
import { formatFecha } from '../lib/fechas'
import { uid } from '../lib/operaciones'
import type { Viaje } from '../lib/tipos'
import { Icono } from '../components/ios'

export function ViajesPage() {
  const { datos } = useStore()
  const compartida = useCuentas().activa?.tipo === 'compartida'
  const viajes = [...datos.viajes].sort((a, b) => Number(a.cerrado) - Number(b.cerrado) || (b.fecha_inicio ?? '').localeCompare(a.fecha_inicio ?? ''))
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[34px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Viajes</h1>
        <p className="text-sm text-slate-500">
          Presupuesto de un viaje, con gastos en cualquier moneda pasados a euros.{compartida && ' Los viajes de esta cuenta los veis los dos.'}
        </p>
      </div>
      <NuevoViaje />
      {viajes.length === 0 ? (
        <Card><p className="text-sm text-slate-500">Todavía no hay viajes.</p></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {viajes.map((v) => <TarjetaViaje key={v.id} v={v} />)}
        </div>
      )}
    </div>
  )
}

function TarjetaViaje({ v }: { v: Viaje }) {
  const { datos } = useStore()
  const r = resumenViaje(v, datos.viaje_gastos)
  return (
    <Link to={`/viajes/${v.id}`} className={cx('block rounded-2xl border bg-white p-4 shadow-sm hover:border-marino/40 dark:bg-slate-900', v.cerrado ? 'border-slate-200 opacity-75 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 truncate font-semibold"><Icono nombre="avion" className="h-5 w-5 shrink-0 text-marino dark:text-sky-300" />{v.nombre}</div>
          <div className="text-xs text-slate-500">
            {v.fecha_inicio ? `${formatFecha(v.fecha_inicio)}${v.fecha_fin ? ` – ${formatFecha(v.fecha_fin)}` : ''} · ` : ''}
            {v.moneda}
            {v.cerrado && ' · Cerrado'}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold"><Dinero c={r.total} dash={false} /></div>
          {v.presupuesto !== null && <div className="text-xs text-slate-500">de <Dinero c={v.presupuesto} dash={false} /></div>}
        </div>
      </div>
      {r.pct !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" aria-hidden>
          <div className={cx('h-full rounded-full', r.pct > 1 ? 'bg-red-500' : r.pct >= 0.9 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.min(100, r.pct * 100)}%` }} />
        </div>
      )}
    </Link>
  )
}

function NuevoViaje() {
  const { insertar, avisar } = useStore()
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const [f, setF] = useState({ nombre: '', moneda: 'EUR', presupuesto: '', inicio: '', fin: '' })
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function crear(e: FormEvent) {
    e.preventDefault()
    if (!f.nombre.trim()) return setError('Ponle un nombre al viaje.')
    const presupuesto = f.presupuesto.trim() ? parseImporte(f.presupuesto) : null
    if (f.presupuesto.trim() && (presupuesto === null || presupuesto < 0)) return setError('El presupuesto no es un importe válido.')
    if (f.inicio && f.fin && f.fin < f.inicio) return setError('La vuelta no puede ser antes que la ida.')
    setOcupado(true)
    setError(null)
    let cambio = 1
    let aviso: string | null = null
    try {
      cambio = await obtenerCambio(f.moneda)
    } catch {
      aviso = `No se ha podido obtener el cambio de ${f.moneda}: escríbelo a mano en el viaje.`
    }
    const v: Viaje = {
      id: uid(), nombre: f.nombre.trim(), moneda: f.moneda, cambio, presupuesto,
      fecha_inicio: f.inicio || null, fecha_fin: f.fin || null, cerrado: false,
    }
    insertar('viajes', v)
    avisar(aviso ? { texto: aviso, tipo: 'error' } : { texto: `Viaje creado${f.moneda !== 'EUR' ? ` (${textoCambio(f.moneda, cambio)})` : ''}.` })
    setOcupado(false)
    navigate(`/viajes/${v.id}`)
  }

  if (!abierto) return <Boton variante="primario" onClick={() => setAbierto(true)}><Icono nombre="mas" className="h-4 w-4" grosor={2.4} />Nuevo viaje</Boton>
  return (
    <Card titulo="Nuevo viaje">
      <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          Nombre
          <input className="campo mt-1" placeholder="Londres" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} autoFocus />
        </label>
        <label className="block text-sm">
          Moneda del destino
          <select className="campo mt-1" value={f.moneda} onChange={(e) => setF({ ...f, moneda: e.target.value })}>
            {MONEDAS.map((m) => <option key={m.id} value={m.id}>{m.id} · {m.txt}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          Presupuesto en euros (opcional)
          <input className="campo num mt-1 text-right" inputMode="decimal" placeholder="900" value={f.presupuesto} onChange={(e) => setF({ ...f, presupuesto: e.target.value })} />
        </label>
        <label className="block text-sm">
          Ida (opcional)
          <input className="campo mt-1" type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} />
        </label>
        <label className="block text-sm">
          Vuelta (opcional)
          <input className="campo mt-1" type="date" value={f.fin} onChange={(e) => setF({ ...f, fin: e.target.value })} />
        </label>
        {error && <p className="text-sm text-red-600 sm:col-span-2" role="alert">{error}</p>}
        <div className="flex gap-2 sm:col-span-2">
          <Boton type="submit" variante="primario" disabled={ocupado}>{ocupado ? 'Creando…' : 'Crear viaje'}</Boton>
          <Boton variante="fantasma" onClick={() => setAbierto(false)}>Cancelar</Boton>
        </div>
        <p className="text-xs text-slate-500 sm:col-span-2">El cambio se toma de los tipos oficiales del Banco Central Europeo (solo se envía el código de la moneda). Podrás cambiarlo a mano.</p>
      </form>
    </Card>
  )
}
