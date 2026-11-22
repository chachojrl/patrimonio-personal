// Huchas: objetivos de ahorro. Reservan parte de tu dinero sin moverlo (el dinero total no cambia).
import { useCallback, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { useCuentas } from '../data/cuentas'
import { Boton, Card, Dinero, Kpi, Modal, cx } from '../components/ui'
import { Confeti } from '../components/Confeti'
import { BarraHucha, TarjetaHucha, textoEstado } from '../components/HuchaTarjeta'
import { Icono } from '../components/ios'
import { useEur } from '../lib/discreto'
import { formatEUR, parseImporte, type Cents } from '../lib/money'
import { formatFecha, hoyISO, mesActual, mesLargo } from '../lib/fechas'
import { uid } from '../lib/operaciones'
import { NOMBRE_CUENTA, dineroLibre, estadoHucha, estadosHuchas, problemaAlMeter, type EstadoHucha } from '../lib/huchas'
import type { CuentaDinero, Hucha, MovimientoHucha } from '../lib/tipos'

const EMOJIS = ['🐷', '✈️', '🏖️', '🏠', '🚗', '💍', '🎓', '🎁', '💻', '📱', '🛟', '👶', '🐶', '🎸', '⛷️', '🏍️']

export function HuchasPage() {
  const { datos, calc } = useStore()
  const compartida = useCuentas().activa?.tipo === 'compartida'
  const [creando, setCreando] = useState(false)
  const estados = estadosHuchas(datos, mesActual())
  const enCurso = estados.filter((e) => !e.hucha.conseguida_en)
  const conseguidas = estados.filter((e) => e.hucha.conseguida_en)
  const l = dineroLibre(calc, datos)
  const conCuenta = !compartida && datos.huchas.some((h) => h.cuenta)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[34px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Huchas</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Aparta dinero para lo que quieres conseguir. Las huchas reservan parte de lo que ya tienes: no lo mueven, así que tu dinero total no cambia.
          {compartida && ' Las huchas de esta cuenta las veis los dos.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 sm:order-last sm:col-span-1"><Kpi titulo="Libre" valor={l.libre} verde sub="Sin reservar en huchas" /></div>
        <Kpi titulo="Dinero total" valor={l.total} />
        <Kpi titulo="En huchas" valor={l.reservado} />
      </div>

      {conCuenta && (
        <Card titulo="Por cuenta">
          <div className="divide-y divide-slate-100 text-sm dark:divide-white/10">
            {(['gastos', 'remunerada', 'inversiones'] as const).map((c) => (
              <div key={c} className="flex items-center justify-between gap-2 py-2">
                <span>{NOMBRE_CUENTA[c]}</span>
                <span className="text-right text-slate-500">
                  <Dinero c={l.porCuenta[c].reservado} dash={false} /> en huchas · libre <Dinero c={l.porCuenta[c].libre} dash={false} verde />
                </span>
              </div>
            ))}
            {l.sinCuenta > 0 && (
              <div className="flex items-center justify-between gap-2 py-2">
                <span>Sin cuenta</span>
                <span className="text-slate-500"><Dinero c={l.sinCuenta} dash={false} /> en huchas</span>
              </div>
            )}
          </div>
        </Card>
      )}

      <Boton variante="primario" onClick={() => setCreando(true)}><Icono nombre="mas" className="h-4 w-4" grosor={2.4} />Nueva hucha</Boton>
      <FormHucha abierto={creando} onCerrar={() => setCreando(false)} />

      {enCurso.length === 0 && conseguidas.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">
            Todavía no tienes huchas. Crea una para un viaje, la entrada de un piso o tu colchón, ponle un objetivo y ve llenándola: con lo que ya tienes o un poco cada mes.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {enCurso.map((e) => <TarjetaHucha key={e.hucha.id} e={e} />)}
        </div>
      )}

      {conseguidas.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-[13px] text-slate-500 dark:text-slate-400">Conseguidas</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {conseguidas.map((e) => <TarjetaHucha key={e.hucha.id} e={e} />)}
          </div>
        </section>
      )}
    </div>
  )
}

// ---------------- Detalle ----------------
export function HuchaPage() {
  const { id } = useParams()
  const { datos, actualizar, borrar, insertar, avisar } = useStore()
  const navigate = useNavigate()
  const eur = useEur()
  const [editando, setEditando] = useState(false)
  const [moviendo, setMoviendo] = useState<'meter' | 'sacar' | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [fiesta, setFiesta] = useState(false)
  const finFiesta = useCallback(() => setFiesta(false), [])
  const h = datos.huchas.find((x) => x.id === id)
  if (!h) return <Navigate to="/huchas" replace />
  const e = estadoHucha(h, datos.hucha_movimientos, mesActual())

  function mover(importe: Cents, nota: string | null, fecha: string) {
    const antes = e.llena
    insertar('hucha_movimientos', { id: uid(), hucha_id: h!.id, fecha, importe, nota, mes: null } satisfies MovimientoHucha)
    const llena = h!.objetivo > 0 && e.saldo + importe >= h!.objetivo
    if (!antes && llena) {
      setFiesta(true)
      avisar({ texto: `¡Has llenado «${h!.nombre}»! ${h!.emoji}` })
    } else {
      avisar({ texto: importe > 0 ? `Metidos ${eur(importe, { dash: false })} en «${h!.nombre}».` : `Sacados ${eur(-importe, { dash: false })} de «${h!.nombre}».` })
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Confeti activo={fiesta} onFin={finFiesta} />
      <Link to="/huchas" className="inline-flex items-center gap-0.5 text-[17px] text-[#007AFF] dark:text-[#0A84FF]">
        <Icono nombre="anterior" className="h-5 w-5" grosor={2.4} />Huchas
      </Link>

      <section className="rounded-xl bg-white p-5 text-center dark:bg-[#1c1c1e]">
        <div className="text-5xl" aria-hidden>{h.emoji}</div>
        <h1 className="mt-2 text-[26px] font-bold tracking-tight text-slate-900 dark:text-white">{h.nombre}</h1>
        <p className="mt-1 text-[34px] font-bold leading-tight tracking-tight"><Dinero c={e.saldo} dash={false} /></p>
        <p className="text-sm text-slate-500">de <Dinero c={h.objetivo} dash={false} />{e.pct !== null && ` · ${Math.round(e.pct * 100)} %`}</p>
        <div className="mx-auto mt-3 max-w-sm"><BarraHucha e={e} /></div>
        <p className={cx('mt-3 text-sm', e.noLlega && !h.conseguida_en ? 'text-amber-700 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300')}>{textoEstado(e, eur)}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {h.aportacion_mensual ? <span>{eur(h.aportacion_mensual, { dash: false })} al mes</span> : null}
          {h.fecha_objetivo && <span>Para el {formatFecha(h.fecha_objetivo)}</span>}
          {h.cuenta && <span>En {NOMBRE_CUENTA[h.cuenta].toLowerCase()}</span>}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Boton variante="primario" onClick={() => setMoviendo('meter')} disabled={!!h.conseguida_en}><Icono nombre="mas" className="h-4 w-4" grosor={2.4} />Meter</Boton>
        <Boton onClick={() => setMoviendo('sacar')} disabled={e.saldo <= 0}>Sacar</Boton>
        <Boton onClick={() => setEditando(true)}><Icono nombre="lapiz" className="h-4 w-4" />Editar</Boton>
        {h.conseguida_en ? (
          <Boton onClick={() => actualizar('huchas', h.id, { conseguida_en: null })}>Reabrir</Boton>
        ) : (
          <Boton
            onClick={() => {
              actualizar('huchas', h.id, { conseguida_en: hoyISO() })
              if (e.llena) setFiesta(true)
              avisar({ texto: `«${h.nombre}» marcada como conseguida.` })
            }}
          >
            <Icono nombre="check" className="h-4 w-4" grosor={2.4} />Conseguida
          </Boton>
        )}
      </div>
      {h.conseguida_en && e.saldo > 0 && (
        <p className="px-1 text-xs text-slate-500">
          Sigue reservando {eur(e.saldo, { dash: false })}. Cuando lo gastes, sácalo de la hucha para que vuelva a contar como dinero libre.
        </p>
      )}

      <Card titulo="Movimientos">
        {e.movimientos.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no has metido nada.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/10">
            {e.movimientos.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{m.nota || (m.mes ? `Aportación de ${mesLargo(m.mes)}` : m.importe > 0 ? 'Metido' : 'Sacado')}</div>
                  <div className="text-xs text-slate-500">{formatFecha(m.fecha)}</div>
                </div>
                <Dinero c={m.importe} verde dash={false} className="text-sm" />
                <button
                  type="button"
                  aria-label={`Borrar el movimiento del ${formatFecha(m.fecha)}`}
                  className="rounded-full p-1.5 text-slate-400 hover:text-red-600"
                  onClick={() => borrar('hucha_movimientos', m.id)}
                >
                  <Icono nombre="papelera" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <button type="button" className="w-full py-2 text-center text-[15px] text-[#FF3B30] dark:text-[#FF453A]" onClick={() => setBorrando(true)}>Borrar hucha</button>

      <FormHucha abierto={editando} onCerrar={() => setEditando(false)} hucha={h} />
      <MoverDinero abierto={moviendo !== null} tipo={moviendo ?? 'meter'} e={e} onCerrar={() => setMoviendo(null)} onMover={mover} />
      <Modal
        abierto={borrando}
        onCerrar={() => setBorrando(false)}
        titulo={`¿Borrar «${h.nombre}»?`}
        pie={
          <>
            <Boton onClick={() => setBorrando(false)}>Cancelar</Boton>
            <Boton variante="peligro" onClick={() => { borrar('huchas', h.id); navigate('/huchas') }}>Borrar</Boton>
          </>
        }
      >
        <p>Se borran la hucha y sus movimientos. Tu dinero no cambia: lo que tenía reservado vuelve a ser dinero libre.</p>
      </Modal>
    </div>
  )
}

// ---------------- Meter / sacar ----------------
function MoverDinero({ abierto, tipo, e, onCerrar, onMover }: { abierto: boolean; tipo: 'meter' | 'sacar'; e: EstadoHucha; onCerrar: () => void; onMover: (importe: Cents, nota: string | null, fecha: string) => void }) {
  const { datos, calc } = useStore()
  const eur = useEur()
  const [importe, setImporte] = useState('')
  const [nota, setNota] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [error, setError] = useState<string | null>(null)
  const l = dineroLibre(calc, datos)
  const libreHucha = e.hucha.cuenta ? Math.min(l.libre, l.porCuenta[e.hucha.cuenta].libre) : l.libre

  function cerrar() {
    setImporte('')
    setNota('')
    setFecha(hoyISO())
    setError(null)
    onCerrar()
  }
  function enviar(ev: FormEvent) {
    ev.preventDefault()
    const c = parseImporte(importe)
    if (c === null || c <= 0) return setError('Escribe un importe mayor que 0.')
    if (tipo === 'sacar' && c > e.saldo) return setError(`En la hucha solo hay ${eur(e.saldo, { dash: false })}.`)
    if (tipo === 'meter') {
      const p = problemaAlMeter(calc, datos, e.hucha, c)
      if (p) return setError(p)
    }
    onMover(tipo === 'meter' ? c : -c, nota.trim() || null, fecha)
    cerrar()
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo={tipo === 'meter' ? `Meter en «${e.hucha.nombre}»` : `Sacar de «${e.hucha.nombre}»`}
      pie={
        <>
          <Boton onClick={cerrar}>Cancelar</Boton>
          <Boton variante="primario" type="submit" form="form-mover">{tipo === 'meter' ? 'Meter' : 'Sacar'}</Boton>
        </>
      }
    >
      <form id="form-mover" onSubmit={enviar} className="space-y-3">
        <p className="text-slate-500">
          {tipo === 'meter'
            ? <>Reserva parte del dinero que ya tienes. Libre{e.hucha.cuenta ? ` en ${NOMBRE_CUENTA[e.hucha.cuenta].toLowerCase()}` : ''}: <strong>{eur(Math.max(0, libreHucha), { dash: false })}</strong>.{e.falta > 0 && <> Faltan {eur(e.falta, { dash: false })}.</>}</>
            : <>Vuelve a ser dinero libre. En la hucha hay <strong>{eur(e.saldo, { dash: false })}</strong>.</>}
        </p>
        <label className="block">
          Importe
          <input className="campo num mt-1 text-right" inputMode="decimal" placeholder="0,00" value={importe} onChange={(x) => setImporte(x.target.value)} autoFocus aria-label="Importe" />
        </label>
        {tipo === 'meter' && e.falta > 0 && (
          <button type="button" className="text-xs text-[#007AFF] underline dark:text-[#0A84FF]" onClick={() => setImporte(formatEUR(Math.min(e.falta, Math.max(0, libreHucha)), { dash: false }).replace(/[^\d,]/g, ''))}>
            Lo que falta
          </button>
        )}
        <label className="block">
          Nota (opcional)
          <input className="campo mt-1" placeholder={tipo === 'meter' ? 'Paga extra' : 'Reserva del hotel'} value={nota} onChange={(x) => setNota(x.target.value)} aria-label="Nota" />
        </label>
        <label className="block">
          Fecha
          <input className="campo mt-1" type="date" value={fecha} onChange={(x) => x.target.value && setFecha(x.target.value)} aria-label="Fecha" />
        </label>
        {error && <p className="text-red-600" role="alert">{error}</p>}
      </form>
    </Modal>
  )
}

// ---------------- Crear / editar ----------------
function FormHucha({ abierto, onCerrar, hucha }: { abierto: boolean; onCerrar: () => void; hucha?: Hucha }) {
  const { datos, calc, insertar, actualizar, avisar } = useStore()
  const navigate = useNavigate()
  const compartida = useCuentas().activa?.tipo === 'compartida'
  const eur = useEur()
  const aTexto = (c: Cents | null | undefined) => (c ? formatEUR(c, { dash: false }).replace(/[^\d,]/g, '') : '')
  const inicial = () => ({
    nombre: hucha?.nombre ?? '',
    emoji: hucha?.emoji ?? '🐷',
    objetivo: aTexto(hucha?.objetivo),
    fecha: hucha?.fecha_objetivo ?? '',
    mensual: aTexto(hucha?.aportacion_mensual),
    cuenta: (hucha?.cuenta ?? '') as CuentaDinero | '',
    ya: '',
  })
  const [f, setF] = useState(inicial)
  const [error, setError] = useState<string | null>(null)
  const [abiertoAntes, setAbiertoAntes] = useState(abierto)
  if (abierto !== abiertoAntes) {
    setAbiertoAntes(abierto)
    if (abierto) {
      setF(inicial())
      setError(null)
    }
  }

  function guardar(ev: FormEvent) {
    ev.preventDefault()
    const nombre = f.nombre.trim()
    if (!nombre) return setError('Ponle un nombre a la hucha.')
    const objetivo = parseImporte(f.objetivo)
    if (objetivo === null || objetivo <= 0) return setError('El objetivo tiene que ser un importe mayor que 0.')
    const mensual = f.mensual.trim() ? parseImporte(f.mensual) : null
    if (f.mensual.trim() && (mensual === null || mensual < 0)) return setError('La aportación mensual no es un importe válido.')
    const ya = f.ya.trim() ? parseImporte(f.ya) : null
    if (f.ya.trim() && (ya === null || ya <= 0)) return setError('Lo que metes ahora tiene que ser mayor que 0.')
    const datosHucha = {
      nombre, emoji: f.emoji.trim() || '🐷', objetivo, fecha_objetivo: f.fecha || null,
      aportacion_mensual: mensual || null, cuenta: compartida ? null : f.cuenta || null,
    }
    if (hucha) {
      actualizar('huchas', hucha.id, datosHucha)
      avisar({ texto: 'Hucha guardada.' })
      return onCerrar()
    }
    const nueva: Hucha = { id: uid(), ...datosHucha, orden: datos.huchas.length, conseguida_en: null }
    if (ya) {
      const p = problemaAlMeter(calc, { ...datos, huchas: [...datos.huchas, nueva] }, nueva, ya)
      if (p) return setError(p)
    }
    insertar('huchas', nueva)
    if (ya) insertar('hucha_movimientos', { id: uid(), hucha_id: nueva.id, fecha: hoyISO(), importe: ya, nota: 'Lo que ya tenía', mes: null } satisfies MovimientoHucha)
    avisar({ texto: `Hucha «${nombre}» creada${ya ? ` con ${eur(ya, { dash: false })}` : ''}.` })
    onCerrar()
    navigate(`/huchas/${nueva.id}`)
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={hucha ? 'Editar hucha' : 'Nueva hucha'}
      pie={
        <>
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="primario" type="submit" form="form-hucha">{hucha ? 'Guardar' : 'Crear hucha'}</Boton>
        </>
      }
    >
      <form id="form-hucha" onSubmit={guardar} className="space-y-3">
        <label className="block">
          Nombre
          <input className="campo mt-1" placeholder="Viaje a Japón" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} autoFocus={!hucha} aria-label="Nombre de la hucha" />
        </label>
        <fieldset>
          <legend>Icono</legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                aria-label={`Icono ${em}`}
                aria-pressed={f.emoji === em}
                className={cx('flex h-9 w-9 items-center justify-center rounded-lg text-xl', f.emoji === em ? 'bg-marino/15 ring-2 ring-marino dark:bg-sky-400/20 dark:ring-sky-400' : 'bg-slate-100 dark:bg-white/10')}
                onClick={() => setF({ ...f, emoji: em })}
              >
                {em}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            Objetivo
            <input className="campo num mt-1 text-right" inputMode="decimal" placeholder="3.000" value={f.objetivo} onChange={(e) => setF({ ...f, objetivo: e.target.value })} aria-label="Objetivo" />
          </label>
          <label className="block">
            Para cuándo (opcional)
            <input className="campo mt-1" type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} aria-label="Fecha límite" />
          </label>
        </div>
        <label className="block">
          Aportación mensual (opcional)
          <input className="campo num mt-1 text-right" inputMode="decimal" placeholder="200" value={f.mensual} onChange={(e) => setF({ ...f, mensual: e.target.value })} aria-label="Aportación mensual" />
          <span className="mt-1 block text-xs text-slate-500">Al cerrar cada mes te la propone para que la confirmes o la cambies.</span>
        </label>
        {!compartida && (
          <label className="block">
            Dónde está el dinero (opcional)
            <select className="campo mt-1" value={f.cuenta} onChange={(e) => setF({ ...f, cuenta: e.target.value as CuentaDinero | '' })} aria-label="Cuenta de la hucha">
              <option value="">Sin indicar</option>
              {(['remunerada', 'gastos', 'inversiones'] as const).map((c) => <option key={c} value={c}>{NOMBRE_CUENTA[c]}</option>)}
            </select>
          </label>
        )}
        {!hucha && (
          <label className="block">
            Meter ya de lo que tienes (opcional)
            <input className="campo num mt-1 text-right" inputMode="decimal" placeholder="1.500" value={f.ya} onChange={(e) => setF({ ...f, ya: e.target.value })} aria-label="Meter ya" />
            <span className="mt-1 block text-xs text-slate-500">Libre ahora: {eur(Math.max(0, dineroLibre(calc, datos).libre), { dash: false })}.</span>
          </label>
        )}
        {error && <p className="text-red-600" role="alert">{error}</p>}
      </form>
    </Modal>
  )
}
