import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { InformePdfBoton, guardarNombreLocal, leerNombreLocal } from '../components/InformePdfBoton'
import { actualizarMiembro } from '../data/supabaseRepo'
import { useStore } from '../data/store'
import { Boton, Card, CeldaImporte, Modal, cx } from '../components/ui'
import { descargar, exportarCSV, exportarExcel, exportarJSON, importarJSON } from '../lib/exportar'
import { supabase } from '../data/supabase'
import { FormularioContrasena } from '../components/FormularioContrasena'
import { CuentaCompartidaCard } from '../components/CuentaCompartidaCard'
import { BloqueoCard } from '../components/BloqueoCard'
import { AtajosCard } from '../components/AtajosCard'
import { useCuentas } from '../data/cuentas'
import type { Config, Datos } from '../lib/tipos'

// Secciones de la página (índice lateral en escritorio, fichas en el móvil)
const SECCIONES = [
  { id: 'ajustes-datos', icono: '📄', titulo: 'Informes y copias', texto: 'Informe PDF, Excel y copias de seguridad.' },
  { id: 'ajustes-cuenta', icono: '🧾', titulo: 'Tu cuenta', texto: 'Saldos iniciales, conceptos y cuenta compartida.' },
  { id: 'ajustes-seguridad', icono: '🔒', titulo: 'Seguridad', texto: 'Contraseña, verificación en dos pasos y bloqueo.' },
  { id: 'ajustes-app', icono: '📱', titulo: 'Aplicación', texto: 'Apariencia y atajos del iPhone.' },
] as const

function irA(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Sección que se está viendo, para resaltarla en el índice. */
function useSeccionVisible(ids: readonly string[]) {
  const [visible, setVisible] = useState(ids[0])
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      (entradas) => {
        const arriba = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (arriba) setVisible(arriba.target.id)
      },
      { rootMargin: '-15% 0px -70% 0px' },
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) obs.observe(el)
    }
    return () => obs.disconnect()
  }, [ids])
  return visible
}

export function AjustesPage() {
  const { activa } = useCuentas()
  const ids = useMemo(() => SECCIONES.map((x) => x.id), [])
  const visible = useSeccionVisible(ids)
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-marino dark:text-sky-300">Ajustes</h1>
        <p className="mt-1 text-sm text-slate-500">
          {activa ? <>Estás en <strong className="text-slate-700 dark:text-slate-200">{activa.tipo === 'compartida' ? '🏠' : '👤'} {activa.nombre}</strong>. Lo que cambies en «Tu cuenta» se aplica solo a esta cuenta.</> : 'Configura la app a tu gusto.'}
        </p>
      </header>

      {/* Móvil: fichas para saltar a cada sección */}
      <nav aria-label="Secciones de ajustes" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
        {SECCIONES.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => irA(x.id)}
            className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {x.icono} {x.titulo}
          </button>
        ))}
      </nav>

      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
        {/* Escritorio: índice fijo */}
        <nav aria-label="Secciones de ajustes" className="hidden lg:block">
          <ul className="sticky top-6 space-y-1">
            {SECCIONES.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => irA(x.id)}
                  aria-current={visible === x.id ? 'true' : undefined}
                  className={cx(
                    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition',
                    visible === x.id
                      ? 'bg-marino text-white shadow-sm dark:bg-sky-800'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  <span aria-hidden>{x.icono}</span>
                  {x.titulo}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-10">
          <Seccion {...SECCIONES[0]}>
            <ExportarCard />
            <CopiasCard />
          </Seccion>
          <Seccion {...SECCIONES[1]}>
            <NombreCard />
            <ConfigCard />
            <PlantillaCard />
            <CuentaCompartidaCard />
          </Seccion>
          <Seccion {...SECCIONES[2]}>
            {supabase && <SeguridadCard />}
            <BloqueoCard />
          </Seccion>
          <Seccion {...SECCIONES[3]}>
            <AparienciaCard />
            <AtajosCard />
          </Seccion>
        </div>
      </div>
    </div>
  )
}

function Seccion({ id, icono, titulo, texto, children }: { id: string; icono: string; titulo: string; texto: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-20">
      <div className="mb-3 flex items-center gap-3">
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-xl dark:bg-sky-900/40">{icono}</span>
        <div>
          <h2 id={`${id}-t`} className="text-lg font-bold text-slate-800 dark:text-slate-100">{titulo}</h2>
          <p className="text-sm text-slate-500">{texto}</p>
        </div>
      </div>
      {/* Dos columnas en pantallas anchas, sin huecos aunque las tarjetas midan distinto */}
      <div className="gap-4 xl:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">{children}</div>
    </section>
  )
}

/** Opción grande con icono, título y explicación (para exportar). */
function Opcion({ icono, titulo, texto, onClick, destacada }: { icono: string; titulo: string; texto: string; onClick: () => void; destacada?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-px hover:shadow-md',
        destacada
          ? 'border-marino/30 bg-sky-50/70 hover:border-marino/60 dark:border-sky-700/60 dark:bg-sky-900/20'
          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600',
      )}
    >
      <span aria-hidden className="text-2xl leading-none">{icono}</span>
      <span className="min-w-0">
        <span className="block font-semibold text-slate-800 group-hover:text-marino dark:text-slate-100 dark:group-hover:text-sky-300">{titulo}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{texto}</span>
      </span>
    </button>
  )
}

/** Nombre general de la cuenta personal: sale en la portada del informe PDF y en el nombre del archivo. */
function NombreCard() {
  const { avisar } = useStore()
  const { activa, userId, recargarCuentas } = useCuentas()
  const yo = activa?.miembros.find((m) => m.user_id && m.user_id === userId)
  const guardado = yo ? yo.nombre : leerNombreLocal()
  const [valor, setValor] = useState(guardado)
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => setValor(guardado), [guardado])
  // En la cuenta compartida, el nombre de la cuenta y de cada persona se cambian en su tarjeta
  if (activa?.tipo === 'compartida') return null

  async function guardar() {
    const v = valor.trim()
    if (v === guardado.trim()) return
    setOcupado(true)
    try {
      if (yo && supabase) {
        await actualizarMiembro(supabase, yo.id, v)
        await recargarCuentas()
      } else {
        guardarNombreLocal(v)
      }
      avisar({ texto: v ? `Nombre guardado: ${v}.` : 'Nombre quitado.', tipo: 'ok' })
    } catch (e) {
      avisar({ texto: `No se pudo guardar el nombre: ${(e as Error).message}`, tipo: 'error' })
      setValor(guardado)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Card titulo="Nombre de la cuenta">
      <p className="mb-3 text-sm text-slate-500">El nombre que sale en la portada del informe PDF y en el nombre del archivo.{yo ? ' Se guarda en tu perfil y se ve igual en todos tus dispositivos.' : ''}</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          guardar()
        }}
      >
        <input
          className="campo"
          aria-label="Nombre de la cuenta"
          placeholder="Tu nombre"
          maxLength={60}
          value={valor}
          disabled={ocupado}
          onChange={(e) => setValor(e.target.value)}
          onBlur={guardar}
        />
        <Boton type="submit" variante="primario" disabled={ocupado || valor.trim() === guardado.trim()}>Guardar</Boton>
      </form>
    </Card>
  )
}

function ConfigCard() {
  const { datos, actualizarConfig } = useStore()
  const cfg = datos.config
  const compartida = useCuentas().activa?.tipo === 'compartida'
  const todos: { k: keyof Config; t: string; neg?: boolean; ayuda: string }[] = [
    compartida
      ? { k: 'ajuste_cuenta_gastos_inicial', t: 'Saldo inicial de la cuenta común', neg: true, ayuda: 'Lo que había en la cuenta común antes del primer mes.' }
      : { k: 'ajuste_cuenta_gastos_inicial', t: 'Cuenta de gastos', neg: true, ayuda: 'Saldo «anterior» del primer mes, para cuadrar los cálculos.' },
    { k: 'cuenta_remunerada_inicial', t: 'Cuenta remunerada', ayuda: 'Lo que había en la cuenta remunerada.' },
    { k: 'inversiones_iniciales', t: 'Inversiones (valor)', ayuda: 'Lo que valían tus inversiones.' },
    { k: 'aportado_inicial_inversiones', t: 'Inversiones (aportado)', ayuda: 'Lo que habías metido en inversiones.' },
  ]
  // En la cuenta compartida no hay inversiones ni cuenta remunerada iniciales
  const campos = compartida ? todos.slice(0, 1) : todos
  const conMeses = datos.months.length > 0
  return (
    <Card titulo="Punto de partida">
      <p className="mb-4 text-sm text-slate-500">Cómo estaban tus cuentas antes del primer mes. Son ajustes para que cuadren los cálculos, no valoraciones verificadas.</p>
      <label className="mb-4 block">
        <span className="text-sm font-medium">Mes de inicio del historial</span>
        <input
          type="month"
          className="campo mt-1"
          value={cfg.mes_inicio.slice(0, 7)}
          disabled={conMeses}
          onChange={(e) => e.target.value && actualizarConfig({ mes_inicio: `${e.target.value}-01` })}
        />
        {conMeses && <span className="mt-1 block text-xs text-slate-500">🔒 Solo se puede cambiar cuando todavía no hay meses.</span>}
      </label>
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        {campos.map((c) => (
          <label key={c.k} className="block">
            <span className="text-sm font-medium">{c.t}</span>
            <CeldaImporte
              ariaLabel={c.t}
              valor={cfg[c.k] as number}
              permitirNegativo={c.neg}
              className="campo mt-1 text-left"
              onCambio={(v) => actualizarConfig({ [c.k]: v ?? 0 } as Partial<Config>)}
            />
            <span className="mt-1 block text-xs text-slate-500">{c.ayuda}</span>
          </label>
        ))}
      </div>
    </Card>
  )
}

function PlantillaCard() {
  const { datos, actualizarConfig } = useStore()
  const [ing, setIng] = useState(datos.config.plantilla_ingresos.join('\n'))
  const [gas, setGas] = useState(datos.config.plantilla_gastos.join('\n'))
  const limpiar = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)
  const n = (s: string) => limpiar(s).length
  return (
    <Card titulo="Conceptos del primer mes">
      <p className="mb-3 text-sm text-slate-500">Solo se usan al crear el primer mes; después, cada mes copia los conceptos del anterior. Uno por línea.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="flex items-baseline justify-between text-sm font-medium">Ingresos <span className="text-xs font-normal text-slate-400">{n(ing)}</span></span>
          <textarea className="campo mt-1 h-44 text-sm leading-6" value={ing} onChange={(e) => setIng(e.target.value)} onBlur={() => actualizarConfig({ plantilla_ingresos: limpiar(ing) })} />
        </label>
        <label className="block">
          <span className="flex items-baseline justify-between text-sm font-medium">Gastos <span className="text-xs font-normal text-slate-400">{n(gas)}</span></span>
          <textarea className="campo mt-1 h-44 text-sm leading-6" value={gas} onChange={(e) => setGas(e.target.value)} onBlur={() => actualizarConfig({ plantilla_gastos: limpiar(gas) })} />
        </label>
      </div>
    </Card>
  )
}

function ExportarCard() {
  const { datos, avisar } = useStore()
  return (
    <Card titulo="Informes y exportar">
      <div className="space-y-2">
        <InformePdfBoton
          disparador={(abrir) => (
            <Opcion destacada icono="📄" titulo="Informe PDF" texto="Todo lo apuntado hasta hoy, con gráficas y el detalle de cada mes." onClick={abrir} />
          )}
        />
        <Opcion icono="📗" titulo="Excel (.xlsx)" texto="Un libro con una hoja por mes, el historial y los resúmenes." onClick={() => exportarExcel(datos).catch((e) => avisar({ texto: e.message, tipo: 'error' }))} />
      </div>
      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
        <p className="mb-2 text-xs font-medium text-slate-500">Tablas sueltas en CSV (para Excel o Numbers)</p>
        <div className="flex flex-wrap gap-1.5">
          {([['historial', 'Historial'], ['incomes', 'Ingresos'], ['expenses', 'Gastos'], ['savings', 'Ahorro y traspasos']] as const).map(([t, txt]) => (
            <button
              key={t}
              type="button"
              onClick={() => exportarCSV(datos, t)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              ⬇ {txt}
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}

function CopiasCard() {
  const { datos, reemplazarTodo, avisar } = useStore()
  const archivo = useRef<HTMLInputElement>(null)
  const [pendiente, setPendiente] = useState<{ titulo: string; datos: Datos } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function confirmar() {
    if (!pendiente) return
    setOcupado(true)
    try {
      await reemplazarTodo(pendiente.datos)
      avisar({ texto: 'Datos cargados correctamente.' })
      setPendiente(null)
    } catch (e) {
      avisar({ texto: `Error: ${(e as Error).message}`, tipo: 'error' })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Card titulo="Copias de seguridad">
      <div className="space-y-2">
        <Opcion
          icono="💾"
          titulo="Descargar copia completa"
          texto="Un archivo JSON con todo lo de esta cuenta. Guárdalo de vez en cuando."
          onClick={() => descargar(`presupuesto-copia-${new Date().toISOString().slice(0, 10)}.json`, exportarJSON(datos), 'application/json')}
        />
        <Opcion icono="📂" titulo="Restaurar una copia…" texto="Sustituye todos los datos de esta cuenta por los de un archivo JSON." onClick={() => archivo.current?.click()} />
      </div>
      <input
        ref={archivo}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            setPendiente({ titulo: `Restaurar copia "${f.name}"`, datos: importarJSON(await f.text()) })
          } catch (err) {
            avisar({ texto: (err as Error).message, tipo: 'error' })
          }
        }}
      />
      <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500 dark:bg-slate-800/60">
        🛟 Además, si está configurada, cada lunes se guarda sola una copia cifrada en GitHub (90 días).
      </p>
      <Modal
        abierto={!!pendiente}
        onCerrar={() => !ocupado && setPendiente(null)}
        titulo={pendiente?.titulo ?? ''}
        pie={
          <>
            <Boton onClick={() => setPendiente(null)} disabled={ocupado}>Cancelar</Boton>
            <Boton variante="peligro" onClick={confirmar} disabled={ocupado}>{ocupado ? 'Cargando…' : 'Sustituir mis datos'}</Boton>
          </>
        }
      >
        <p>Se <strong>borrarán todos los datos actuales</strong> ({datos.months.length} meses) y se sustituirán por {pendiente?.datos.months.length ?? 0} meses.</p>
        {datos.months.length > 0 && <p>Te recomiendo descargar antes una copia completa.</p>}
      </Modal>
    </Card>
  )
}

function AparienciaCard() {
  const [tema, setTema] = useState<string>(() => {
    try {
      return localStorage.getItem('tema') ?? 'sistema'
    } catch {
      return 'sistema'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('tema', tema)
    } catch {
      /* sin almacenamiento */
    }
    const oscuro = tema === 'oscuro' || (tema === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', oscuro)
  }, [tema])
  const opciones = [
    ['sistema', '🖥️', 'Automático'],
    ['claro', '☀️', 'Claro'],
    ['oscuro', '🌙', 'Oscuro'],
  ] as const
  return (
    <Card titulo="Apariencia">
      <p className="mb-3 text-sm text-slate-500">Automático sigue el modo claro u oscuro del dispositivo.</p>
      <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {opciones.map(([v, ico, t]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={tema === v}
            onClick={() => setTema(v)}
            className={cx(
              'flex flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-sm font-medium transition',
              tema === v ? 'bg-white text-marino shadow-sm dark:bg-slate-900 dark:text-sky-300' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            <span aria-hidden className="text-lg">{ico}</span>
            {t}
          </button>
        ))}
      </div>
    </Card>
  )
}

function SeguridadCard() {
  const { avisar } = useStore()
  const [email, setEmail] = useState('')
  const [factores, setFactores] = useState<{ id: string; status: string }[]>([])
  const [alta, setAlta] = useState<{ id: string; qr: string; secreto: string } | null>(null)
  const [codigo, setCodigo] = useState('')

  async function refrescar() {
    if (!supabase) return
    const u = await supabase.auth.getUser()
    setEmail(u.data.user?.email ?? '')
    const f = await supabase.auth.mfa.listFactors()
    setFactores((f.data?.totp ?? []).map((x) => ({ id: x.id, status: x.status })))
  }
  useEffect(() => {
    refrescar()
  }, [])

  async function empezarAlta() {
    if (!supabase) return
    // Limpia altas a medias
    for (const f of factores.filter((x) => x.status !== 'verified')) await supabase.auth.mfa.unenroll({ factorId: f.id })
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Presupuesto ${Date.now()}` })
    if (error) return avisar({ texto: error.message, tipo: 'error' })
    setAlta({ id: data.id, qr: data.totp.qr_code, secreto: data.totp.secret })
  }

  async function verificar() {
    if (!supabase || !alta) return
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: alta.id, code: codigo.trim() })
    if (error) return avisar({ texto: 'Código incorrecto.', tipo: 'error' })
    setAlta(null)
    setCodigo('')
    avisar({ texto: 'Verificación en dos pasos activada.' })
    refrescar()
  }

  const activo = factores.some((f) => f.status === 'verified')
  return (
    <Card titulo="Seguridad y sesión">
      <div className="space-y-4 text-sm">
        <p>Sesión iniciada como <strong>{email}</strong>.</p>
        <div>
          <h3 className="mb-2 font-medium">Cambiar contraseña</h3>
          <FormularioContrasena />
        </div>
        <div>
          <h3 className="mb-1 font-medium">Verificación en dos pasos (TOTP)</h3>
          {activo ? (
            <p className="text-emerald-700 dark:text-emerald-400">✔ Activada. Para exigirla también en la base de datos, pon <code>requiere_mfa = true</code> en la tabla <code>app_owner</code> (ver README).</p>
          ) : alta ? (
            <div className="space-y-2">
              <p>Escanea este código con Google Authenticator, 1Password, Authy…</p>
              <img src={alta.qr} alt="Código QR" className="h-44 w-44 rounded bg-white p-2" />
              <p className="break-all text-xs text-slate-500">Clave manual: {alta.secreto}</p>
              <div className="flex gap-2">
                <input className="campo w-36" inputMode="numeric" placeholder="123456" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
                <Boton variante="primario" onClick={verificar}>Verificar</Boton>
              </div>
            </div>
          ) : (
            <Boton onClick={empezarAlta}>Activar verificación en dos pasos</Boton>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <Boton onClick={() => supabase?.auth.signOut()}>Cerrar sesión</Boton>
          <Boton variante="fantasma" className="text-red-600" onClick={() => supabase?.auth.signOut({ scope: 'global' })}>Cerrar sesión en todos los dispositivos</Boton>
        </div>
      </div>
    </Card>
  )
}
