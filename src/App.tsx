import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase, urlDeLaApp, vieneDeRecuperacion } from './data/supabase'
import { crearLocalRepo } from './data/localRepo'
import { cargarCuentas, crearSupabaseRepo } from './data/supabaseRepo'
import { NoAutorizadoError, type Repo } from './data/repo'
import { StoreProvider } from './data/store'
import type { Cuenta, Datos } from './lib/tipos'
import { CuentasProvider, cuentaGuardada, guardarCuenta, type CuentasCtx } from './data/cuentas'
import { Layout } from './components/Layout'
import { Boton, Spinner } from './components/ui'
import { FormularioContrasena } from './components/FormularioContrasena'
import { InicioPage } from './pages/InicioPage'
import { MesPage } from './pages/MesPage'
import { HistorialPage } from './pages/HistorialPage'
import { ResumenPage } from './pages/ResumenPage'
import { AjustesPage } from './pages/AjustesPage'
import { BuscarPage } from './pages/BuscarPage'
import { TeDebenPage } from './pages/TeDebenPage'

export default function App() {
  return supabase ? <ConLogin /> : <ConLocal />
}

function ConLocal() {
  const repo = useMemo(() => crearLocalRepo(), [])
  return <ConDatos repo={repo} />
}

function Rutas() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<InicioPage />} />
          <Route path="mes/:ym" element={<MesPage />} />
          <Route path="historial" element={<HistorialPage />} />
          <Route path="resumen" element={<ResumenPage />} />
          <Route path="resumen/:anio" element={<ResumenPage />} />
          <Route path="buscar" element={<BuscarPage />} />
          <Route path="te-deben" element={<TeDebenPage />} />
          <Route path="ajustes" element={<AjustesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

function ConDatos({ repo }: { repo: Repo }) {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState<Error | null>(null)
  useEffect(() => {
    repo.cargar().then(setDatos, setError)
  }, [repo])
  if (error) return <ErrorCarga error={error} />
  if (!datos) return <Spinner />
  return (
    <StoreProvider repo={repo} inicial={datos}>
      <Rutas />
    </StoreProvider>
  )
}

function ErrorCarga({ error }: { error: Error }) {
  return (
    <Pantalla titulo={error instanceof NoAutorizadoError ? 'Acceso no autorizado' : 'No se pudieron cargar los datos'}>
      <p className="text-sm text-slate-600 dark:text-slate-300">{error.message}</p>
      {error instanceof NoAutorizadoError && (
        <p className="text-sm text-slate-500">Añade tu email a la tabla <code>app_owner</code> en Supabase (ver README).</p>
      )}
      <div className="flex gap-2">
        <Boton onClick={() => location.reload()}>Reintentar</Boton>
        {supabase && <Boton onClick={() => supabase!.auth.signOut()}>Cerrar sesión</Boton>}
      </div>
    </Pantalla>
  )
}

type EstadoAuth = { fase: 'cargando' } | { fase: 'fuera' } | { fase: 'mfa'; factorId: string } | { fase: 'nueva-clave' } | { fase: 'dentro'; session: Session }

function ConLogin() {
  const sb = supabase!
  const [auth, setAuth] = useState<EstadoAuth>({ fase: 'cargando' })
  const recuperando = useRef(vieneDeRecuperacion)

  async function evaluar(session: Session | null) {
    if (!session) return setAuth({ fase: 'fuera' })
    const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel()
    if (data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') {
      const f = await sb.auth.mfa.listFactors()
      const totp = f.data?.totp.find((x) => x.status === 'verified')
      if (totp) return setAuth({ fase: 'mfa', factorId: totp.id })
    }
    if (recuperando.current) return setAuth({ fase: 'nueva-clave' })
    setAuth({ fase: 'dentro', session })
  }

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => evaluar(data.session))
    const { data: sub } = sb.auth.onAuthStateChange((evento, session) => {
      if (evento === 'PASSWORD_RECOVERY') {
        recuperando.current = true
        setTimeout(() => evaluar(session), 0)
      } else if (evento === 'SIGNED_OUT') setAuth({ fase: 'fuera' })
      else if (evento === 'SIGNED_IN' || evento === 'MFA_CHALLENGE_VERIFIED') setTimeout(() => evaluar(session), 0)
    })
    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (auth.fase === 'cargando') return <Spinner />
  if (auth.fase === 'fuera') return <Login />
  if (auth.fase === 'mfa') return <SegundoFactor factorId={auth.factorId} />
  if (auth.fase === 'nueva-clave')
    return (
      <NuevaContrasena
        onHecho={async () => {
          recuperando.current = false
          const { data } = await sb.auth.getSession()
          evaluar(data.session)
        }}
      />
    )
  return <ConCuentas key={auth.session.user.id} session={auth.session} />
}

/** Carga las cuentas del usuario y abre la activa (la personal por defecto). */
function ConCuentas({ session }: { session: Session }) {
  const sb = supabase!
  const [cuentas, setCuentas] = useState<Cuenta[] | null | undefined>(undefined)
  const [activaId, setActivaId] = useState<string | null>(cuentaGuardada())
  const [error, setError] = useState<Error | null>(null)

  async function recargarCuentas() {
    setCuentas(await cargarCuentas(sb))
  }
  useEffect(() => {
    recargarCuentas().catch(setError)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activa = cuentas ? (cuentas.find((c) => c.id === activaId) ?? cuentas[0] ?? null) : null
  const repo = useMemo(() => crearSupabaseRepo(sb, activa?.id ?? null), [sb, activa?.id])

  if (error) return <ErrorCarga error={error} />
  if (cuentas === undefined) return <Spinner />
  const valor: CuentasCtx = {
    cuentas,
    activa,
    userId: session.user.id,
    cambiar: (id) => {
      guardarCuenta(id)
      setActivaId(id)
    },
    recargarCuentas,
  }
  return (
    <CuentasProvider valor={valor}>
      <ConDatos key={activa?.id ?? 'sin-cuentas'} repo={repo} />
    </CuentasProvider>
  )
}

function Pantalla({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-10 w-10" />
          <h1 className="text-xl font-bold text-marino dark:text-sky-300">{titulo}</h1>
        </div>
        {children}
      </div>
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [modo, setModo] = useState<'entrar' | 'olvido' | 'enviado'>('entrar')

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setError(null)
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : error.message)
    setOcupado(false)
  }

  async function enviarEnlace(e: FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setError(null)
    const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: urlDeLaApp() })
    setOcupado(false)
    if (error) {
      setError(/rate limit/i.test(error.message) ? 'Se han enviado demasiados emails. Espera un rato y vuelve a intentarlo.' : error.message)
      return
    }
    setModo('enviado')
  }

  if (modo === 'enviado') {
    return (
      <Pantalla titulo="Revisa tu email">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Si <strong>{email}</strong> tiene cuenta, recibirás un enlace para crear una contraseña nueva. Ábrelo en este dispositivo o en cualquier otro.
        </p>
        <p className="text-xs text-slate-500">¿No llega? Mira en la carpeta de spam. El enlace caduca en una hora.</p>
        <Boton className="w-full" onClick={() => setModo('entrar')}>Volver</Boton>
      </Pantalla>
    )
  }

  if (modo === 'olvido') {
    return (
      <Pantalla titulo="Recuperar contraseña">
        <form onSubmit={enviarEnlace} className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">Escribe tu email y te enviaremos un enlace para crear una contraseña nueva.</p>
          <label className="block text-sm">
            Email
            <input className="campo mt-1" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Boton type="submit" variante="primario" className="w-full" disabled={ocupado}>{ocupado ? 'Enviando…' : 'Enviar enlace'}</Boton>
          <Boton variante="fantasma" className="w-full" onClick={() => { setModo('entrar'); setError(null) }}>Volver</Boton>
        </form>
      </Pantalla>
    )
  }

  return (
    <Pantalla titulo="Presupuesto personal">
      <form onSubmit={entrar} className="space-y-3">
        <label className="block text-sm">
          Email
          <input className="campo mt-1" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm">
          Contraseña
          <input className="campo mt-1" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Boton type="submit" variante="primario" className="w-full" disabled={ocupado}>{ocupado ? 'Entrando…' : 'Entrar'}</Boton>
        <button type="button" className="w-full text-center text-sm text-sky-700 hover:underline dark:text-sky-400" onClick={() => { setModo('olvido'); setError(null) }}>
          ¿Has olvidado tu contraseña?
        </button>
      </form>
      <p className="text-xs text-slate-500">Acceso privado. No se admiten registros.</p>
    </Pantalla>
  )
}

/** Formulario de contraseña nueva (tras abrir el enlace de recuperación). */
function NuevaContrasena({ onHecho }: { onHecho: () => void }) {
  return (
    <Pantalla titulo="Nueva contraseña">
      <p className="text-sm text-slate-600 dark:text-slate-300">Elige una contraseña nueva para tu cuenta.</p>
      <FormularioContrasena textoBoton="Guardar y entrar" onHecho={onHecho} />
      <Boton variante="fantasma" className="w-full" onClick={() => supabase!.auth.signOut()}>Cancelar</Boton>
    </Pantalla>
  )
}

function SegundoFactor({ factorId }: { factorId: string }) {
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  async function verificar(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase!.auth.mfa.challengeAndVerify({ factorId, code: codigo.trim() })
    if (error) setError('Código incorrecto.')
  }
  return (
    <Pantalla titulo="Verificación en dos pasos">
      <form onSubmit={verificar} className="space-y-3">
        <label className="block text-sm">
          Código de tu app de autenticación
          <input className="campo mt-1 text-center text-2xl tracking-widest" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Boton type="submit" variante="primario" className="w-full">Verificar</Boton>
        <Boton variante="fantasma" className="w-full" onClick={() => supabase!.auth.signOut()}>Cancelar</Boton>
      </form>
    </Pantalla>
  )
}
