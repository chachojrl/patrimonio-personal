import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './data/supabase'
import { crearLocalRepo } from './data/localRepo'
import { crearSupabaseRepo } from './data/supabaseRepo'
import { NoAutorizadoError, type Repo } from './data/repo'
import { StoreProvider } from './data/store'
import type { Datos } from './lib/tipos'
import { Layout } from './components/Layout'
import { Boton, Spinner } from './components/ui'
import { InicioPage } from './pages/InicioPage'
import { MesPage } from './pages/MesPage'
import { HistorialPage } from './pages/HistorialPage'
import { ResumenPage } from './pages/ResumenPage'
import { AjustesPage } from './pages/AjustesPage'

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
  if (error) {
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
  if (!datos) return <Spinner />
  return (
    <StoreProvider repo={repo} inicial={datos}>
      <Rutas />
    </StoreProvider>
  )
}

type EstadoAuth = { fase: 'cargando' } | { fase: 'fuera' } | { fase: 'mfa'; factorId: string } | { fase: 'dentro'; session: Session }

function ConLogin() {
  const sb = supabase!
  const [auth, setAuth] = useState<EstadoAuth>({ fase: 'cargando' })
  const repo = useMemo(() => crearSupabaseRepo(sb), [sb])

  async function evaluar(session: Session | null) {
    if (!session) return setAuth({ fase: 'fuera' })
    const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel()
    if (data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') {
      const f = await sb.auth.mfa.listFactors()
      const totp = f.data?.totp.find((x) => x.status === 'verified')
      if (totp) return setAuth({ fase: 'mfa', factorId: totp.id })
    }
    setAuth({ fase: 'dentro', session })
  }

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => evaluar(data.session))
    const { data: sub } = sb.auth.onAuthStateChange((evento, session) => {
      if (evento === 'SIGNED_OUT') setAuth({ fase: 'fuera' })
      else if (evento === 'SIGNED_IN' || evento === 'MFA_CHALLENGE_VERIFIED') setTimeout(() => evaluar(session), 0)
    })
    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (auth.fase === 'cargando') return <Spinner />
  if (auth.fase === 'fuera') return <Login />
  if (auth.fase === 'mfa') return <SegundoFactor factorId={auth.factorId} />
  return <ConDatos key={auth.session.user.id} repo={repo} />
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
  async function entrar(e: FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setError(null)
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : error.message)
    setOcupado(false)
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
      </form>
      <p className="text-xs text-slate-500">Acceso privado. No se admiten registros.</p>
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
