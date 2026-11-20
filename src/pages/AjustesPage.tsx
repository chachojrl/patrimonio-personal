// Ajustes al estilo de Apple: lista agrupada con iconos de color (como Ajustes del iPhone) y, en
// pantallas anchas, dos paneles (como Ajustes del Sistema del Mac). Cada apartado tiene su dirección
// (/ajustes/copias, /ajustes/apariencia…), así que el botón «atrás» del móvil funciona.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { nombreMiembro, useCuentas } from '../data/cuentas'
import { supabase } from '../data/supabase'
import { actualizarMiembro } from '../data/supabaseRepo'
import { Boton, CeldaImporte, Modal, cx } from '../components/ui'
import { descargar, exportarCSV, exportarExcel, exportarJSON, importarJSON } from '../lib/exportar'
import { FormularioContrasena } from '../components/FormularioContrasena'
import { CuentaCompartidaCard } from '../components/CuentaCompartidaCard'
import { AtajosCard } from '../components/AtajosCard'
import { guardarNombreLocal, leerNombreLocal, useInformePdf } from '../components/InformePdfBoton'
import { useBloqueo } from '../components/useBloqueo'
import { bloquearAhora } from '../components/Bloqueo'
import { MINUTOS_EN_SEGUNDO_PLANO } from '../lib/bloqueo'
import { NOMBRE_TEMA, useTema, type Tema } from '../lib/tema'
import { MESES, partes } from '../lib/fechas'
import { Avatar, BotonGrande, COLOR, Fila, FilaCampo, FilaLibre, Grupo, Icono, IconoApp, Interruptor, claseCampoIos, type NombreIcono } from '../components/ios'
import type { Config, Datos } from '../lib/tipos'

type Id = 'perfil' | 'informe' | 'exportar' | 'copias' | 'partida' | 'conceptos' | 'compartida' | 'seguridad' | 'faceid' | 'apariencia' | 'atajos'

interface Apartado {
  id: Id
  titulo: string
  icono: NombreIcono
  color: string
}

const APARTADOS: Record<Exclude<Id, 'perfil'>, Apartado> = {
  informe: { id: 'informe', titulo: 'Informe PDF', icono: 'documento', color: COLOR.naranja },
  exportar: { id: 'exportar', titulo: 'Exportar', icono: 'grafica', color: COLOR.verde },
  copias: { id: 'copias', titulo: 'Copias de seguridad', icono: 'archivo', color: COLOR.azul },
  partida: { id: 'partida', titulo: 'Punto de partida', icono: 'bandera', color: COLOR.amarillo },
  conceptos: { id: 'conceptos', titulo: 'Conceptos del primer mes', icono: 'lista', color: COLOR.morado },
  compartida: { id: 'compartida', titulo: 'Cuenta compartida', icono: 'casa', color: COLOR.marron },
  seguridad: { id: 'seguridad', titulo: 'Contraseña y seguridad', icono: 'candado', color: COLOR.grafito },
  faceid: { id: 'faceid', titulo: 'Face ID', icono: 'cara', color: COLOR.verde },
  apariencia: { id: 'apariencia', titulo: 'Apariencia', icono: 'luna', color: COLOR.indigo },
  atajos: { id: 'atajos', titulo: 'Siri y Atajos', icono: 'microfono', color: COLOR.rosa },
}

/** Correo de la sesión (vacío en modo local). */
function useEmail() {
  const [email, setEmail] = useState('')
  useEffect(() => {
    supabase?.auth.getUser().then((u) => setEmail(u.data.user?.email ?? ''))
  }, [])
  return email
}

export function AjustesPage() {
  const { seccion } = useParams()
  // Fondo gris de las listas de iOS mientras se está en Ajustes
  useEffect(() => {
    document.body.classList.add('fondo-ios')
    return () => document.body.classList.remove('fondo-ios')
  }, [])
  const { datos } = useStore()
  const { activa, userId, cuentas } = useCuentas()
  const [tema, setTema] = useTema()
  const bloqueo = useBloqueo()
  const email = useEmail()
  const compartida = activa?.tipo === 'compartida'
  const yo = activa?.miembros.find((m) => m.user_id && m.user_id === userId)
  const nombre = compartida ? activa?.nombre ?? '' : (yo ? nombreMiembro(yo) : '') || leerNombreLocal()

  const disponibles: Id[] = [
    'perfil', 'informe', 'exportar', 'copias', 'partida', 'conceptos',
    ...(supabase ? (['compartida', 'seguridad'] as Id[]) : []),
    'faceid', 'apariencia', 'atajos',
  ]
  if (seccion && !disponibles.includes(seccion as Id)) return <Navigate to="/ajustes" replace />
  const actual = (seccion as Id | undefined) ?? null
  // En pantallas anchas siempre hay algo a la derecha
  const enPanel: Id = actual ?? 'perfil'

  const { anio, mes } = partes(datos.config.mes_inicio)
  const nombreCompartida = cuentas?.find((c) => c.tipo === 'compartida')?.nombre
  const valores: Partial<Record<Id, string>> = {
    exportar: 'Excel, CSV',
    partida: `${MESES[mes - 1].toLowerCase()} ${anio}`,
    conceptos: String(datos.config.plantilla_ingresos.length + datos.config.plantilla_gastos.length),
    compartida: nombreCompartida ?? 'No',
    faceid: bloqueo.activo ? 'Sí' : 'No',
    apariencia: NOMBRE_TEMA[tema],
  }

  const fila = (id: Exclude<Id, 'perfil'>) => {
    if (!disponibles.includes(id)) return null
    const a = APARTADOS[id]
    return <Fila key={id} icono={a.icono} color={a.color} titulo={a.titulo} valor={valores[id]} to={`/ajustes/${id}`} activa={actual === id} valorSoloMovil />
  }

  const lista = (
    <div>
      <h1 className="mb-4 px-1 text-[34px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Ajustes</h1>
      <Grupo>
        <Link
          to={compartida && supabase ? '/ajustes/compartida' : '/ajustes/perfil'}
          className={cx(
            'ios-fila flex items-center gap-3.5 px-4 py-3 transition-colors',
            // Resaltado solo en pantallas anchas (en el móvil la lista y el detalle no se ven a la vez)
            enPanel === 'perfil' ? 'lg:bg-[#007AFF] lg:dark:bg-[#0A84FF]' : 'lg:hover:bg-slate-50 lg:dark:hover:bg-white/5',
            'active:bg-slate-200/70',
          )}
        >
          <Avatar nombre={nombre || '?'} />
          <span className="min-w-0 flex-1">
            <span className={cx('block truncate text-[20px] font-semibold leading-tight', 'text-slate-900 dark:text-white', enPanel === 'perfil' && 'lg:text-white')}>
              {nombre || 'Pon tu nombre'}
            </span>
            <span className={cx('mt-0.5 block truncate text-[13px]', 'text-slate-500 dark:text-slate-400', enPanel === 'perfil' && 'lg:text-white/80')}>
              {compartida ? 'Cuenta compartida' : 'Cuenta personal'}{email ? ` · ${email}` : ''}
            </span>
          </span>
          {(
            <svg viewBox="0 0 24 24" className={cx('h-4 w-4 text-slate-300 dark:text-slate-600', enPanel === 'perfil' && 'lg:hidden')} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m9 5 7 7-7 7" />
            </svg>
          )}
        </Link>
      </Grupo>
      <Grupo>{fila('informe')}{fila('exportar')}{fila('copias')}</Grupo>
      <Grupo>{fila('partida')}{fila('conceptos')}{fila('compartida')}</Grupo>
      <Grupo>{fila('seguridad')}{fila('faceid')}</Grupo>
      <Grupo>{fila('apariencia')}{fila('atajos')}</Grupo>
      <p className="pb-4 text-center text-[13px] text-slate-400">Presupuesto personal</p>
    </div>
  )

  const titulo = enPanel === 'perfil' ? (compartida ? activa?.nombre ?? 'Cuenta' : 'Perfil') : APARTADOS[enPanel].titulo
  const detalle = (
    <Detalle id={enPanel} titulo={titulo}>
      {enPanel === 'perfil' && <PerfilDetalle email={email} />}
      {enPanel === 'informe' && <InformeDetalle />}
      {enPanel === 'exportar' && <ExportarDetalle />}
      {enPanel === 'copias' && <CopiasDetalle />}
      {enPanel === 'partida' && <PartidaDetalle />}
      {enPanel === 'conceptos' && <ConceptosDetalle />}
      {enPanel === 'compartida' && <div className="mb-8"><CuentaCompartidaCard /></div>}
      {enPanel === 'seguridad' && <SeguridadDetalle email={email} />}
      {enPanel === 'faceid' && <FaceIdDetalle bloqueo={bloqueo} />}
      {enPanel === 'apariencia' && <AparienciaDetalle tema={tema} setTema={setTema} />}
      {enPanel === 'atajos' && <div className="mb-8"><AtajosCard /></div>}
    </Detalle>
  )

  return (
    <div className="mx-auto max-w-5xl lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-8">
      <div className={cx(actual ? 'hidden lg:block' : 'block')}>
        <div className="lg:sticky lg:top-6">{lista}</div>
      </div>
      <div className={cx(actual ? 'block' : 'hidden lg:block')}>{detalle}</div>
    </div>
  )
}

/** Pantalla de un apartado: en el móvil, con «‹ Ajustes» para volver. */
function Detalle({ id, titulo, children }: { id: Id; titulo: string; children: ReactNode }) {
  return (
    <div>
      <div className="relative mb-2 flex h-11 items-center justify-center lg:hidden">
        <Link to="/ajustes" className="absolute left-0 flex items-center gap-0.5 py-2 pr-3 text-[17px] text-[#007AFF] dark:text-[#0A84FF]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m15 5-7 7 7 7" />
          </svg>
          Ajustes
        </Link>
        <span className="max-w-[55%] truncate text-[17px] font-semibold text-slate-900 dark:text-white">{titulo}</span>
      </div>
      <h2 className="mb-5 mt-1 hidden px-1 text-[26px] font-bold tracking-tight text-slate-900 dark:text-white lg:block" id={`ajustes-${id}`}>
        {titulo}
      </h2>
      {children}
    </div>
  )
}

/** Cabecera grande de un apartado: icono, título y explicación centrados. */
function Portada({ icono, color, titulo, texto }: { icono: NombreIcono; color: string; titulo: string; texto: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col items-center rounded-[10px] bg-white px-6 py-6 text-center dark:bg-[#1c1c1e]">
      <IconoApp nombre={icono} color={color} grande />
      <h3 className="mt-3 text-[20px] font-bold text-slate-900 dark:text-white">{titulo}</h3>
      <p className="mt-1 max-w-sm text-[15px] leading-snug text-slate-500 dark:text-slate-400">{texto}</p>
    </div>
  )
}

const campoIos = 'border-transparent! bg-transparent! px-0! py-1! ring-0! shadow-none! text-slate-500! dark:text-slate-400!'

// ---------------- Perfil ----------------
function PerfilDetalle({ email }: { email: string }) {
  const { avisar } = useStore()
  const { activa, userId, recargarCuentas } = useCuentas()
  const yo = activa?.miembros.find((m) => m.user_id && m.user_id === userId)
  const guardado = yo ? yo.nombre : leerNombreLocal()
  const [valor, setValor] = useState(guardado)
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => setValor(guardado), [guardado])

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
    <>
      <div className="mb-6 flex flex-col items-center text-center">
        <Avatar nombre={valor || '?'} grande />
        <p className="mt-3 text-[24px] font-semibold text-slate-900 dark:text-white">{valor.trim() || 'Sin nombre'}</p>
        {email && <p className="text-[15px] text-slate-500">{email}</p>}
      </div>
      <Grupo pie={<>Es el nombre de la cuenta: sale en la portada del informe PDF y en el nombre del archivo.{yo ? ' Se guarda en tu perfil y se ve igual en todos tus dispositivos.' : ''}</>}>
        <FilaCampo etiqueta="Nombre">
          <input
            className={claseCampoIos}
            placeholder="Tu nombre"
            maxLength={60}
            value={valor}
            disabled={ocupado}
            onChange={(e) => setValor(e.target.value)}
            onBlur={guardar}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </FilaCampo>
      </Grupo>
      <Grupo>
        <Fila titulo="Cuenta" valor={activa ? `${activa.tipo === 'compartida' ? '🏠' : '👤'} ${activa.nombre}` : 'En este navegador'} />
        {email && <Fila titulo="Correo" valor={email} />}
      </Grupo>
    </>
  )
}

// ---------------- Informe PDF ----------------
function InformeDetalle() {
  const { generar, ocupado, compartida, activa, nombrePorDefecto, meses } = useInformePdf()
  const [nombre, setNombre] = useState(nombrePorDefecto)
  useEffect(() => setNombre(nombrePorDefecto), [nombrePorDefecto])
  const incluye = [
    'Portada con las cifras principales',
    'Gráficas de evolución, ingresos, gastos y ahorro',
    'En qué se va el dinero y de dónde viene',
    'Resumen por año e historial mensual',
    'Te deben y viajes',
    'Todo lo apuntado, mes a mes',
  ]
  return (
    <>
      <Portada
        icono="documento"
        color={COLOR.naranja}
        titulo="Informe de patrimonio"
        texto={<>Un PDF con todo lo apuntado hasta hoy en {compartida ? <>«{activa?.nombre}»</> : 'tu cuenta'}{meses ? ` (${meses} ${meses === 1 ? 'mes' : 'meses'})` : ''}.</>}
      />
      <Grupo
        titulo="Portada"
        pie={compartida ? 'En la cuenta compartida, la portada muestra el nombre de la cuenta y de quienes la compartís.' : 'Por defecto, el nombre de tu perfil. Si lo cambias aquí, solo afecta a este PDF.'}
      >
        <FilaCampo etiqueta={compartida ? 'Autor' : 'Nombre'}>
          <input className={claseCampoIos} placeholder="Tu nombre" maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </FilaCampo>
      </Grupo>
      <Grupo titulo="Incluye">
        {incluye.map((t) => (
          <Fila key={t} titulo={<span className="text-[15px]">{t}</span>} derecha={<span className="text-[#34C759]">✓</span>} />
        ))}
      </Grupo>
      <BotonGrande onClick={() => generar(nombre)} disabled={ocupado}>{ocupado ? 'Generando…' : 'Generar PDF'}</BotonGrande>
      <p className="-mt-5 mb-8 px-4 text-center text-[13px] text-slate-500">Se genera en este dispositivo. No se envía a ningún sitio.</p>
    </>
  )
}

// ---------------- Exportar ----------------
const IconoDescarga = () => <Icono nombre="descargar" className="h-5 w-5 text-[#007AFF] dark:text-[#0A84FF]" />

function ExportarDetalle() {
  const { datos, avisar } = useStore()
  return (
    <>
      <Grupo titulo="Libro completo" pie="Una hoja por mes, el historial y los resúmenes por año.">
        <Fila icono="grafica" color={COLOR.verde} titulo="Excel (.xlsx)" derecha={<IconoDescarga />} onClick={() => exportarExcel(datos).catch((e) => avisar({ texto: e.message, tipo: 'error' }))} />
      </Grupo>
      <Grupo titulo="Tablas sueltas (CSV)" pie="Se abren en Excel o Numbers. Usan «;» y coma decimal, como en España.">
        {([['historial', 'Historial'], ['incomes', 'Ingresos'], ['expenses', 'Gastos'], ['savings', 'Ahorro y traspasos']] as const).map(([t, txt]) => (
          <Fila key={t} titulo={txt} derecha={<IconoDescarga />} onClick={() => exportarCSV(datos, t)} />
        ))}
      </Grupo>
    </>
  )
}

// ---------------- Copias ----------------
function CopiasDetalle() {
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
    <>
      <Portada icono="archivo" color={COLOR.azul} titulo="Copias de seguridad" texto="Guarda de vez en cuando una copia de todo lo de esta cuenta, por ejemplo en iCloud Drive." />
      <Grupo pie="Un archivo JSON con todo: meses, ingresos, gastos, ahorros, Te deben, viajes y ajustes.">
        <Fila titulo="Descargar copia completa" accion="azul" onClick={() => descargar(`presupuesto-copia-${new Date().toISOString().slice(0, 10)}.json`, exportarJSON(datos), 'application/json')} />
      </Grupo>
      <Grupo pie="Sustituye todos los datos de esta cuenta por los de un archivo de copia. Antes te pide confirmación.">
        <Fila titulo="Restaurar una copia…" accion="rojo" onClick={() => archivo.current?.click()} />
      </Grupo>
      <Grupo titulo="Copia automática">
        <FilaLibre>Si está configurada, cada lunes se guarda sola una copia cifrada en GitHub durante 90 días.</FilaLibre>
      </Grupo>
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
    </>
  )
}

// ---------------- Punto de partida ----------------
function PartidaDetalle() {
  const { datos, actualizarConfig } = useStore()
  const cfg = datos.config
  const compartida = useCuentas().activa?.tipo === 'compartida'
  const conMeses = datos.months.length > 0
  const todos: { k: keyof Config; t: string; neg?: boolean }[] = [
    { k: 'ajuste_cuenta_gastos_inicial', t: compartida ? 'Cuenta común' : 'Cuenta de gastos', neg: true },
    { k: 'cuenta_remunerada_inicial', t: 'Cuenta remunerada' },
    { k: 'inversiones_iniciales', t: 'Inversiones (valor)' },
    { k: 'aportado_inicial_inversiones', t: 'Inversiones (aportado)' },
  ]
  // En la cuenta compartida no hay inversiones ni cuenta remunerada iniciales
  const campos = compartida ? todos.slice(0, 1) : todos
  return (
    <>
      <Grupo pie={conMeses ? 'Solo se puede cambiar cuando todavía no hay meses.' : 'El primer mes del historial.'}>
        <FilaCampo etiqueta="Mes de inicio">
          <input
            type="month"
            className={cx(claseCampoIos, 'w-auto')}
            value={cfg.mes_inicio.slice(0, 7)}
            disabled={conMeses}
            onChange={(e) => e.target.value && actualizarConfig({ mes_inicio: `${e.target.value}-01` })}
          />
        </FilaCampo>
      </Grupo>
      <Grupo
        titulo="Antes del primer mes"
        pie={compartida
          ? 'Lo que había en la cuenta común antes del primer mes.'
          : 'Cómo estaban tus cuentas antes del primer mes. «Valor» es lo que valían tus inversiones y «aportado», lo que habías metido. Son ajustes para que cuadren los cálculos, no valoraciones verificadas.'}
      >
        {campos.map((c) => (
          <FilaCampo key={c.k} etiqueta={c.t}>
            <CeldaImporte
              ariaLabel={c.t}
              valor={cfg[c.k] as number}
              permitirNegativo={c.neg}
              className={campoIos}
              onCambio={(v) => actualizarConfig({ [c.k]: v ?? 0 } as Partial<Config>)}
            />
          </FilaCampo>
        ))}
      </Grupo>
    </>
  )
}

// ---------------- Conceptos ----------------
function ConceptosDetalle() {
  const { datos, actualizarConfig } = useStore()
  const [ing, setIng] = useState(datos.config.plantilla_ingresos.join('\n'))
  const [gas, setGas] = useState(datos.config.plantilla_gastos.join('\n'))
  const limpiar = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)
  const area = 'block h-44 w-full resize-y bg-transparent text-[17px] leading-7 text-slate-900 outline-none dark:text-slate-100'
  return (
    <>
      <Grupo titulo={`Ingresos · ${limpiar(ing).length}`}>
        <FilaLibre>
          <textarea aria-label="Conceptos de ingresos" className={area} value={ing} onChange={(e) => setIng(e.target.value)} onBlur={() => actualizarConfig({ plantilla_ingresos: limpiar(ing) })} />
        </FilaLibre>
      </Grupo>
      <Grupo titulo={`Gastos · ${limpiar(gas).length}`} pie="Uno por línea. Solo se usan al crear el primer mes; después, cada mes copia los conceptos del anterior.">
        <FilaLibre>
          <textarea aria-label="Conceptos de gastos" className={area} value={gas} onChange={(e) => setGas(e.target.value)} onBlur={() => actualizarConfig({ plantilla_gastos: limpiar(gas) })} />
        </FilaLibre>
      </Grupo>
    </>
  )
}

// ---------------- Seguridad ----------------
function SeguridadDetalle({ email }: { email: string }) {
  const { avisar } = useStore()
  const [factores, setFactores] = useState<{ id: string; status: string }[]>([])
  const [alta, setAlta] = useState<{ id: string; qr: string; secreto: string } | null>(null)
  const [codigo, setCodigo] = useState('')

  async function refrescar() {
    if (!supabase) return
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
    <>
      <Grupo>
        <Fila titulo="Sesión iniciada" valor={email} />
      </Grupo>
      <Grupo titulo="Cambiar contraseña" pie="Al menos 8 caracteres.">
        <FilaLibre>
          <FormularioContrasena />
        </FilaLibre>
      </Grupo>
      <Grupo
        titulo="Verificación en dos pasos"
        pie={activo
          ? <>Para exigirla también en la base de datos, pon <code>requiere_mfa = true</code> en la tabla <code>app_owner</code> (ver README).</>
          : 'Además de la contraseña, te pide un código de una app como Google Authenticator, 1Password o Authy.'}
      >
        <Fila titulo="Estado" valor={activo ? 'Activada' : 'Desactivada'} />
        {!activo && !alta && <Fila titulo="Activar verificación en dos pasos" accion="azul" onClick={empezarAlta} />}
        {alta && (
          <FilaLibre>
            <p>Escanea este código con tu app de códigos:</p>
            <img src={alta.qr} alt="Código QR" className="my-3 h-44 w-44 rounded-lg bg-white p-2" />
            <p className="mb-3 break-all text-xs text-slate-500">Clave manual: {alta.secreto}</p>
            <div className="flex gap-2">
              <input className="campo w-36" inputMode="numeric" placeholder="123456" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
              <Boton variante="primario" onClick={verificar}>Verificar</Boton>
            </div>
          </FilaLibre>
        )}
      </Grupo>
      <Grupo>
        <Fila titulo="Cerrar sesión" accion="rojo" onClick={() => supabase?.auth.signOut()} />
        <Fila titulo="Cerrar sesión en todos los dispositivos" accion="rojo" onClick={() => supabase?.auth.signOut({ scope: 'global' })} />
      </Grupo>
    </>
  )
}

// ---------------- Face ID ----------------
function FaceIdDetalle({ bloqueo }: { bloqueo: ReturnType<typeof useBloqueo> }) {
  const { disponible, activo, ocupado, activar, desactivar } = bloqueo
  const noDisponible = disponible === false && !activo
  return (
    <>
      <Grupo
        pie={noDisponible
          ? 'Este navegador o dispositivo no ofrece Face ID ni huella para páginas web.'
          : `Al abrir la app, y si vuelves a ella tras más de ${MINUTOS_EN_SEGUNDO_PLANO} minuto, te pide Face ID, tu huella o el código del móvil. Es para este dispositivo: actívalo en cada uno donde lo quieras.`}
      >
        <Fila
          icono="cara"
          color={COLOR.verde}
          titulo="Bloquear con Face ID"
          derecha={<Interruptor etiqueta="Bloquear con Face ID" activo={activo} disabled={ocupado || noDisponible || disponible === null} onCambio={(v) => (v ? activar() : desactivar())} />}
        />
      </Grupo>
      {activo && (
        <Grupo>
          <Fila titulo="Bloquear ahora" accion="azul" onClick={bloquearAhora} />
        </Grupo>
      )}
      <Grupo titulo="Privacidad">
        <FilaLibre>La app no ve ni guarda tu cara ni tu huella: lo comprueba el propio móvil. Si algún día no funciona, en la pantalla de bloqueo puedes cerrar sesión y entrar con tu contraseña.</FilaLibre>
      </Grupo>
    </>
  )
}

// ---------------- Apariencia ----------------
function AparienciaDetalle({ tema, setTema }: { tema: Tema; setTema: (t: Tema) => void }) {
  // Con «Automático», se marca el modo que se está usando ahora
  const enUso = tema === 'sistema' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro') : tema
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 rounded-[10px] bg-white px-6 py-5 dark:bg-[#1c1c1e]">
        {(['claro', 'oscuro'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTema(t)} className="flex flex-col items-center gap-2" aria-pressed={enUso === t}>
            <span className={cx('flex h-28 w-16 flex-col gap-1.5 rounded-xl border-2 p-2', t === 'claro' ? 'bg-slate-100' : 'bg-slate-900', enUso === t ? 'border-[#007AFF]' : 'border-transparent')}>
              <span className={cx('h-2 w-8 rounded', t === 'claro' ? 'bg-slate-300' : 'bg-slate-600')} />
              <span className={cx('h-6 rounded', t === 'claro' ? 'bg-white' : 'bg-slate-700')} />
              <span className={cx('h-6 rounded', t === 'claro' ? 'bg-white' : 'bg-slate-700')} />
            </span>
            <span className="text-[15px] text-slate-900 dark:text-slate-100">{NOMBRE_TEMA[t]}</span>
            <span className={cx('flex h-5 w-5 items-center justify-center rounded-full border', enUso === t ? 'border-[#007AFF] bg-[#007AFF] text-white' : 'border-slate-300 dark:border-slate-600')}>
              {enUso === t && <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12.5 4.5 4.5L19 7" /></svg>}
            </span>
          </button>
        ))}
      </div>
      <Grupo pie="Cambia entre claro y oscuro según el modo de tu dispositivo.">
        <Fila titulo="Automático" derecha={<Interruptor etiqueta="Apariencia automática" activo={tema === 'sistema'} onCambio={(v) => setTema(v ? 'sistema' : document.documentElement.classList.contains('dark') ? 'oscuro' : 'claro')} />} />
      </Grupo>
    </>
  )
}
