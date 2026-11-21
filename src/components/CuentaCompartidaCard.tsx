import { useState, type FormEvent } from 'react'
import { useStore } from '../data/store'
import { CLAVE_AVISO, nombreMiembro, useCuentas } from '../data/cuentas'
import { supabase } from '../data/supabase'
import { actualizarCuenta, actualizarMiembro, borrarCuentaCompartida, crearCuentaCompartida } from '../data/supabaseRepo'
import { Boton, Card, Dinero, Modal, cx } from './ui'
import { descargar, exportarJSON } from '../lib/exportar'
import { mesesOrdenados } from '../lib/operaciones'
import { nombreMes } from '../lib/fechas'
import type { Cuenta } from '../lib/tipos'
import { COLOR, Fila, Grupo } from './ios'

/** En Ajustes: crear la cuenta compartida (desde la personal) o configurarla (dentro de ella). */
export function CuentaCompartidaCard() {
  const { cuentas, activa } = useCuentas()
  if (!supabase) return null
  if (!cuentas || !activa) {
    return (
      <Card titulo="Cuenta compartida">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Para poder crear una cuenta compartida hay que actualizar la base de datos una vez: ejecuta
          <code className="mx-1">supabase/migrations/0005_cuentas_compartidas.sql</code> en Supabase (ver README).
        </p>
      </Card>
    )
  }
  const compartidas = cuentas.filter((c) => c.tipo === 'compartida')
  return (
    <>
      {compartidas.length > 0 && <ListaCompartidas compartidas={compartidas} />}
      {activa.tipo === 'compartida' && <div className="mb-8"><Configurar cuenta={activa} /></div>}
      <Crear hayOtras={compartidas.length > 0} />
    </>
  )
}

/** Con quién compartes una cuenta: «Ana y Luis», o quién falta por entrar. */
export function conQuien(cuenta: Cuenta, userId: string | null): { con: string; pendientes: string[] } {
  const otros = cuenta.miembros.filter((m) => !userId || m.user_id !== userId)
  const nombres = otros.map(nombreMiembro)
  const con = nombres.length === 0 ? 'Solo tú por ahora' : `Con ${nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`}`
  return { con, pendientes: otros.filter((m) => !m.user_id).map(nombreMiembro) }
}

/** Todas las cuentas compartidas del usuario, con quién las comparte. Al tocar una, se abre. */
function ListaCompartidas({ compartidas }: { compartidas: Cuenta[] }) {
  const { activa, cambiar, userId } = useCuentas()
  return (
    <Grupo
      titulo={compartidas.length === 1 ? 'Tu cuenta compartida' : `Tus cuentas compartidas · ${compartidas.length}`}
      pie="Toca una para abrirla. Lo que apuntas en tu cuenta personal no lo ve nadie más."
    >
      {compartidas.map((c) => {
        const { con, pendientes } = conQuien(c, userId)
        const abierta = activa?.id === c.id
        return (
          <Fila
            key={c.id}
            icono="casa"
            color={COLOR.marron}
            titulo={c.nombre}
            sub={pendientes.length ? `${con} · ${pendientes.join(', ')} aún no ${pendientes.length === 1 ? 'ha' : 'han'} entrado` : con}
            valor={abierta ? 'Abierta' : undefined}
            onClick={abierta ? undefined : () => cambiar(c.id)}
          />
        )
      })}
    </Grupo>
  )
}

function Crear({ hayOtras }: { hayOtras: boolean }) {
  const { recargarCuentas } = useCuentas()
  const { avisar } = useStore()
  const [abierto, setAbierto] = useState(false)
  const [f, setF] = useState({ nombre: hayOtras ? '' : 'Casa', miNombre: '', emailPareja: '', nombrePareja: '' })
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function crear(e: FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setError(null)
    try {
      await crearCuentaCompartida(supabase!, f)
      await recargarCuentas()
      avisar({ texto: `Cuenta «${f.nombre}» creada. Ábrela desde la lista de cuentas compartidas.` })
      setAbierto(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Card titulo={hayOtras ? 'Nueva cuenta compartida' : 'Cuenta compartida (opcional)'}>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {hayOtras
          ? 'Puedes tener varias: por ejemplo, una para la casa y otra para un piso compartido o con tu familia. Cada una con sus propios meses.'
          : 'Una cuenta para los gastos comunes (casa, wifi, supermercado…) que veis los dos, cada uno con su usuario. Vuestras cuentas personales siguen siendo privadas. Mientras no la crees, nada cambia.'}
      </p>
      {!abierto ? (
        <Boton className="mt-3" onClick={() => setAbierto(true)}>＋ {hayOtras ? 'Crear otra cuenta compartida' : 'Crear cuenta compartida'}</Boton>
      ) : (
        <form onSubmit={crear} className="mt-3 space-y-3">
          <Campo etiqueta="Nombre de la cuenta" valor={f.nombre} onCambio={(v) => setF({ ...f, nombre: v })} placeholder="Casa" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Tu nombre" valor={f.miNombre} onCambio={(v) => setF({ ...f, miNombre: v })} placeholder="Rodrigo" />
            <Campo etiqueta="Nombre de la otra persona" valor={f.nombrePareja} onCambio={(v) => setF({ ...f, nombrePareja: v })} placeholder="Ana" />
          </div>
          <Campo etiqueta="Email con el que entra en la app" tipo="email" valor={f.emailPareja} onCambio={(v) => setF({ ...f, emailPareja: v })} placeholder="ana@ejemplo.com" requerido />
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
            La otra persona necesita su propio usuario: añade su email a <code>app_owner</code> y créale el usuario en Supabase
            (ver README, «Cuenta compartida»). Verá la cuenta en cuanto entre.
          </p>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <div className="flex gap-2">
            <Boton type="submit" variante="primario" disabled={ocupado}>{ocupado ? 'Creando…' : 'Crear'}</Boton>
            <Boton variante="fantasma" onClick={() => setAbierto(false)}>Cancelar</Boton>
          </div>
        </form>
      )}
    </Card>
  )
}

function Configurar({ cuenta }: { cuenta: Cuenta }) {
  const { recargarCuentas, userId } = useCuentas()
  const { datos, recargar, avisar } = useStore()
  const [pct, setPct] = useState(cuenta.pct_aportacion === null ? '' : String(cuenta.pct_aportacion).replace('.', ','))
  const [ocupado, setOcupado] = useState(false)

  async function guardar(fn: () => Promise<void>, recalcula: boolean) {
    setOcupado(true)
    try {
      await fn()
      await recargarCuentas()
      if (recalcula) await recargar() // el servidor ha recalculado las aportaciones
    } catch (e) {
      avisar({ texto: `No se pudo guardar: ${(e as Error).message}`, tipo: 'error' })
    } finally {
      setOcupado(false)
    }
  }

  function guardarPct() {
    const t = pct.trim().replace(',', '.')
    const n = t === '' ? null : Number(t)
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > 100)) {
      avisar({ texto: 'El porcentaje tiene que estar entre 0 y 100.', tipo: 'error' })
      return
    }
    if (n === cuenta.pct_aportacion) return
    guardar(() => actualizarCuenta(supabase!, cuenta.id, { pct_aportacion: n === null ? null : Math.round(n * 100) / 100 }), true)
  }

  // Aportaciones del último mes abierto de la cuenta compartida
  const mesAbierto = mesesOrdenados(datos).filter((m) => m.estado === 'Abierto').at(-1)
  const aportaciones = mesAbierto ? datos.incomes.filter((i) => i.month_id === mesAbierto.id && i.aportacion_de) : []
  const totalAport = aportaciones.reduce((a, i) => a + i.importe, 0)

  return (
    <Card titulo={`Ajustes de «${cuenta.nombre}»`}>
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Nombre de la cuenta</span>
          <input
            className="campo mt-1"
            defaultValue={cuenta.nombre}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== cuenta.nombre) guardar(() => actualizarCuenta(supabase!, cuenta.id, { nombre: v }), true)
            }}
          />
        </label>

        <div>
          <div className="text-sm font-medium">Miembros</div>
          <ul className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
            {cuenta.miembros.map((m) => (
              <li key={m.id} className="flex items-center gap-2 px-3 py-2">
                <input
                  aria-label={`Nombre de ${m.email}`}
                  className="celda flex-1 font-medium"
                  defaultValue={m.nombre}
                  placeholder={nombreMiembro(m)}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v !== m.nombre) guardar(() => actualizarMiembro(supabase!, m.id, v), true)
                  }}
                />
                <span className="min-w-0 truncate text-xs text-slate-500">
                  {m.email}
                  {m.user_id === userId && ' (tú)'}
                  {!m.user_id && <span className="ml-1 rounded bg-amber-100 px-1 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">aún no ha entrado</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={cuenta.aportacion_activa}
              disabled={ocupado}
              onChange={(e) => guardar(() => actualizarCuenta(supabase!, cuenta.id, { aportacion_activa: e.target.checked }), true)}
            />
            <span>
              <span className="font-medium">Aportaciones automáticas proporcionales</span>
              <span className="block text-xs text-slate-500">
                Cada mes, cada uno aporta el mismo porcentaje de sus ingresos. Se apunta solo como ingreso aquí y como gasto en su
                cuenta personal, y se recalcula si cambian los ingresos. Los meses cerrados no se tocan.
              </span>
            </span>
          </label>
          <div className={cx('mt-3 flex items-end gap-2', !cuenta.aportacion_activa && 'opacity-60')}>
            <label className="block">
              <span className="text-sm font-medium">Porcentaje de los ingresos</span>
              <span className="mt-1 flex items-center gap-1">
                <input
                  className="campo num w-24 text-right"
                  inputMode="decimal"
                  placeholder="10"
                  value={pct}
                  disabled={ocupado}
                  onChange={(e) => setPct(e.target.value)}
                  onBlur={guardarPct}
                  onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
                />
                <span>%</span>
              </span>
            </label>
          </div>
          {cuenta.aportacion_activa && cuenta.pct_aportacion === null && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Elige un porcentaje para empezar a calcular.</p>
          )}
          {cuenta.aportacion_activa && cuenta.pct_aportacion !== null && mesAbierto && (
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{nombreMes(mesAbierto.fecha)}</div>
              {aportaciones.length === 0 ? (
                <p className="text-xs text-slate-500">Todavía no hay aportaciones: aparecen cuando cada uno tiene creado este mes en su cuenta personal.</p>
              ) : (
                <>
                  {aportaciones.map((a) => (
                    <div key={a.id} className="flex justify-between"><span>{a.concepto}</span><Dinero c={a.importe} dash={false} /></div>
                  ))}
                  <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-semibold dark:border-slate-700">
                    <span>Total que entra</span><Dinero c={totalAport} dash={false} />
                  </div>
                </>
              )}
            </div>
          )}
          {cuenta.aportacion_activa && !mesAbierto && (
            <p className="mt-2 text-xs text-slate-500">Crea el primer mes de esta cuenta para ver las aportaciones.</p>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Ojo: como se aporta un porcentaje de los ingresos, la otra persona puede deducir tus ingresos a partir de tu aportación.
        </p>

        <ZonaPeligrosa cuenta={cuenta} />
      </div>
    </Card>
  )
}

function ZonaPeligrosa({ cuenta }: { cuenta: Cuenta }) {
  const { cuentas, cambiar, recargarCuentas, userId } = useCuentas()
  const { datos } = useStore()
  const [abierto, setAbierto] = useState(false)
  const [entiendo, setEntiendo] = useState(false)
  const [escrito, setEscrito] = useState('')
  const [copiaHecha, setCopiaHecha] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const otros = cuenta.miembros.filter((m) => m.user_id !== userId).map(nombreMiembro)
  const coincide = escrito.trim().toLowerCase() === cuenta.nombre.trim().toLowerCase()
  const n = {
    meses: datos.months.length,
    gastos: datos.expenses.filter((g) => g.importe !== 0).length,
    ingresos: datos.incomes.filter((i) => i.importe !== 0).length,
    deudas: datos.debts.length,
  }

  function cerrar() {
    if (ocupado) return
    setAbierto(false)
    setEntiendo(false)
    setEscrito('')
    setError(null)
  }

  function copia() {
    descargar(`presupuesto-${cuenta.nombre.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`, exportarJSON(datos), 'application/json')
    setCopiaHecha(true)
  }

  async function borrar() {
    if (!entiendo || !coincide) return
    setOcupado(true)
    setError(null)
    try {
      await borrarCuentaCompartida(supabase!, cuenta.id, escrito)
      try {
        sessionStorage.setItem(CLAVE_AVISO, `Cuenta «${cuenta.nombre}» borrada.`)
      } catch {
        /* sin almacenamiento */
      }
      const personal = cuentas?.find((c) => c.tipo === 'personal')
      if (personal) cambiar(personal.id)
      await recargarCuentas()
    } catch (e) {
      setError((e as Error).message)
      setOcupado(false)
    }
  }

  return (
    <div className="rounded-xl border border-red-200 p-3 dark:border-red-900/60">
      <div className="text-sm font-semibold text-red-700 dark:text-red-400">Zona peligrosa</div>
      <p className="mt-1 text-xs text-slate-500">Borra la cuenta compartida y todo lo que contiene, para todos sus miembros.</p>
      <Boton variante="secundario" className="mt-2 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40" onClick={() => setAbierto(true)}>
        🗑 Borrar cuenta compartida…
      </Boton>

      <Modal
        abierto={abierto}
        onCerrar={cerrar}
        titulo={`¿Borrar «${cuenta.nombre}»?`}
        pie={
          <>
            <Boton onClick={cerrar} disabled={ocupado}>Cancelar</Boton>
            <Boton variante="peligro" onClick={borrar} disabled={!entiendo || !coincide || ocupado}>
              {ocupado ? 'Borrando…' : 'Borrar definitivamente'}
            </Boton>
          </>
        }
      >
        <div className="rounded-lg bg-red-50 p-3 text-red-800 dark:bg-red-950/40 dark:text-red-300">
          <p className="font-semibold">Esto no se puede deshacer.</p>
          <p className="mt-1">
            Se borra para {otros.length ? <>ti y para {otros.join(', ')}</> : 'todos los miembros'}:{' '}
            {n.meses} {n.meses === 1 ? 'mes' : 'meses'}, {n.gastos} gastos, {n.ingresos} ingresos
            {n.deudas > 0 && <>, {n.deudas} {n.deudas === 1 ? 'deuda' : 'deudas'}</>} y su configuración.
          </p>
        </div>
        <p className="text-slate-600 dark:text-slate-300">
          En vuestras cuentas personales no se borra nada, salvo el gasto automático «Aportación {cuenta.nombre}» de los meses abiertos.
          En los meses cerrados se queda como un gasto normal.
        </p>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <span>{copiaHecha ? '✓ Copia descargada' : 'Antes, guarda una copia por si acaso.'}</span>
          <Boton className="shrink-0 text-xs" onClick={copia}>💾 Descargar copia</Boton>
        </div>
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={entiendo} onChange={(e) => setEntiendo(e.target.checked)} />
          <span>Entiendo que se borra para {otros.length ? 'los dos' : 'todos'} y que no se puede recuperar.</span>
        </label>
        <label className="block">
          <span>Para confirmar, escribe el nombre de la cuenta: <strong className="select-all">{cuenta.nombre}</strong></span>
          <input
            className={cx('campo mt-1', escrito && !coincide && 'border-red-400')}
            value={escrito}
            autoComplete="off"
            aria-label="Nombre de la cuenta para confirmar"
            onChange={(e) => setEscrito(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && borrar()}
          />
        </label>
        {error && <p className="text-red-600" role="alert">{error}</p>}
      </Modal>
    </div>
  )
}

function Campo({ etiqueta, valor, onCambio, placeholder, tipo = 'text', requerido }: { etiqueta: string; valor: string; onCambio: (v: string) => void; placeholder?: string; tipo?: string; requerido?: boolean }) {
  return (
    <label className="block text-sm">
      {etiqueta}
      <input className="campo mt-1" type={tipo} required={requerido} placeholder={placeholder} value={valor} onChange={(e) => onCambio(e.target.value)} />
    </label>
  )
}
