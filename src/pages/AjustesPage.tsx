import { useEffect, useRef, useState } from 'react'
import { InformePdfBoton } from '../components/InformePdfBoton'
import { useStore } from '../data/store'
import { Boton, Card, CeldaImporte, Modal } from '../components/ui'
import { descargar, exportarCSV, exportarExcel, exportarJSON, importarJSON } from '../lib/exportar'
import { supabase } from '../data/supabase'
import { FormularioContrasena } from '../components/FormularioContrasena'
import { CuentaCompartidaCard } from '../components/CuentaCompartidaCard'
import { BloqueoCard } from '../components/BloqueoCard'
import { AtajosCard } from '../components/AtajosCard'
import { useCuentas } from '../data/cuentas'
import type { Config, Datos } from '../lib/tipos'

export function AjustesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-marino dark:text-sky-300">Ajustes</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <CuentaCompartidaCard />
        <ConfigCard />
        <PlantillaCard />
        <DatosCard />
        <AparienciaCard />
        <BloqueoCard />
        <AtajosCard />
        {supabase && <SeguridadCard />}
      </div>
    </div>
  )
}

function ConfigCard() {
  const { datos, actualizarConfig } = useStore()
  const cfg = datos.config
  const compartida = useCuentas().activa?.tipo === 'compartida'
  const todos: { k: keyof Config; t: string; neg?: boolean; ayuda: string }[] = [
    compartida
      ? { k: 'ajuste_cuenta_gastos_inicial', t: 'Saldo inicial de la cuenta común', neg: true, ayuda: 'Lo que había en la cuenta común antes del primer mes.' }
      : { k: 'ajuste_cuenta_gastos_inicial', t: 'Cuenta de gastos inicial', neg: true, ayuda: 'No es saldo real: es el saldo "anterior" del primer mes para cuadrar los cálculos.' },
    { k: 'inversiones_iniciales', t: 'Inversiones iniciales', ayuda: 'Base de cálculo de inversiones antes del primer mes.' },
    { k: 'aportado_inicial_inversiones', t: 'Aportado inicial a inversiones', ayuda: 'Total aportado a inversiones antes del primer mes.' },
    { k: 'cuenta_remunerada_inicial', t: 'Cuenta remunerada inicial', ayuda: 'Saldo inicial de la cuenta remunerada.' },
  ]
  // En la cuenta compartida no hay inversiones ni cuenta remunerada iniciales
  const campos = compartida ? todos.slice(0, 1) : todos
  return (
    <Card titulo="Configuración">
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium">Mes de inicio del historial</span>
          <input
            type="month"
            className="campo mt-1"
            value={cfg.mes_inicio.slice(0, 7)}
            disabled={datos.months.length > 0}
            onChange={(e) => e.target.value && actualizarConfig({ mes_inicio: `${e.target.value}-01` })}
          />
          {datos.months.length > 0 && <span className="text-xs text-slate-500">Solo se puede cambiar cuando no hay meses.</span>}
        </label>
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
            <span className="text-xs text-slate-500">{c.ayuda}</span>
          </label>
        ))}
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          Los saldos iniciales del primer mes son ajustes de conciliación, no valoraciones históricas verificadas.
        </p>
      </div>
    </Card>
  )
}

function PlantillaCard() {
  const { datos, actualizarConfig } = useStore()
  const [ing, setIng] = useState(datos.config.plantilla_ingresos.join('\n'))
  const [gas, setGas] = useState(datos.config.plantilla_gastos.join('\n'))
  const limpiar = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)
  return (
    <Card titulo="Plantilla de conceptos">
      <p className="mb-3 text-sm text-slate-500">Se usa solo para el primer mes. Los meses siguientes copian los conceptos del mes anterior. Un concepto por línea.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Ingresos</span>
          <textarea className="campo mt-1 h-48 font-mono text-xs" value={ing} onChange={(e) => setIng(e.target.value)} onBlur={() => actualizarConfig({ plantilla_ingresos: limpiar(ing) })} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Gastos</span>
          <textarea className="campo mt-1 h-48 font-mono text-xs" value={gas} onChange={(e) => setGas(e.target.value)} onBlur={() => actualizarConfig({ plantilla_gastos: limpiar(gas) })} />
        </label>
      </div>
    </Card>
  )
}

function DatosCard() {
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
    <Card titulo="Datos y copias de seguridad">
      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-sm font-medium">Exportar</h3>
          <div className="flex flex-wrap gap-2">
            <InformePdfBoton />
            <Boton onClick={() => exportarExcel(datos).catch((e) => avisar({ texto: e.message, tipo: 'error' }))}>📗 Excel (.xlsx)</Boton>
            <Boton onClick={() => descargar(`presupuesto-copia-${new Date().toISOString().slice(0, 10)}.json`, exportarJSON(datos), 'application/json')}>💾 Copia completa (JSON)</Boton>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="self-center text-slate-500">CSV:</span>
            <Boton variante="fantasma" className="text-xs" onClick={() => exportarCSV(datos, 'historial')}>Historial</Boton>
            <Boton variante="fantasma" className="text-xs" onClick={() => exportarCSV(datos, 'incomes')}>Ingresos</Boton>
            <Boton variante="fantasma" className="text-xs" onClick={() => exportarCSV(datos, 'expenses')}>Gastos</Boton>
            <Boton variante="fantasma" className="text-xs" onClick={() => exportarCSV(datos, 'savings')}>Ahorros</Boton>
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium">Importar / restaurar</h3>
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
          <div className="flex flex-wrap gap-2">
            <Boton onClick={() => archivo.current?.click()}>📂 Restaurar copia JSON…</Boton>
          </div>
        </div>
      </div>
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
        {datos.months.length > 0 && <p>Te recomiendo exportar antes una copia JSON.</p>}
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
  return (
    <Card titulo="Apariencia">
      <div className="flex gap-2">
        {[['sistema', 'Sistema'], ['claro', 'Claro'], ['oscuro', 'Oscuro']].map(([v, t]) => (
          <Boton key={v} variante={tema === v ? 'primario' : 'secundario'} onClick={() => setTema(v)}>{t}</Boton>
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
