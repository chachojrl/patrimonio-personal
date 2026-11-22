// Ajustes al estilo de Apple: lista agrupada con iconos de color (como Ajustes del iPhone) y, en
// pantallas anchas, dos paneles (como Ajustes del Sistema del Mac). Cada apartado tiene su dirección
// (/ajustes/copias, /ajustes/apariencia…), así que el botón «atrás» del móvil funciona.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { nombreMiembro, useCuentas } from '../data/cuentas'
import { supabase } from '../data/supabase'
import { actualizarMiembro } from '../data/supabaseRepo'
import { Boton, CeldaImporte, Dinero, Modal, cx } from '../components/ui'
import { ACENTOS, guardarFechaCopia, haceCuanto, leerFechaCopia, mesesSinCerrar, setPreferencias, usePreferencias } from '../lib/preferencias'
import { setDiscreto, useDiscreto } from '../lib/discreto'
import { empezarRecorrido } from '../lib/guia'
import { descargar, exportarCSV, exportarExcel, exportarJSON, importarJSON } from '../lib/exportar'
import { FormularioContrasena } from '../components/FormularioContrasena'
import { CuentaCompartidaCard, conQuien } from '../components/CuentaCompartidaCard'
import { AtajosCard } from '../components/AtajosCard'
import { SelectorPeriodo, guardarNombreLocal, leerNombreLocal, useInformePdf, useSelectorPeriodo } from '../components/InformePdfBoton'
import { useBloqueo } from '../components/useBloqueo'
import { bloquearAhora } from '../components/Bloqueo'
import { MINUTOS_EN_SEGUNDO_PLANO } from '../lib/bloqueo'
import { NOMBRE_TEMA, useTema, type Tema } from '../lib/tema'
import { MESES, MESES_CORTOS, fechaDesdeIndice, indiceMes, mesActual, mesLargo, nombreMes, partes } from '../lib/fechas'
import { Avatar, BotonGrande, COLOR, Fila, FilaCampo, FilaLibre, Grupo, Icono, IconoApp, Interruptor, claseCampoIos, type NombreIcono } from '../components/ios'
import type { Config, Datos, TramoTae } from '../lib/tipos'
import { GUIA, textoFicha } from '../components/guiaUso'
import { formatEUR, formatTae, parsePct } from '../lib/money'
import { interesesEstimados, taeDelMes } from '../lib/calculos'

type Id = 'perfil' | 'guia' | 'informe' | 'exportar' | 'copias' | 'partida' | 'intereses' | 'conceptos' | 'compartida' | 'seguridad' | 'faceid' | 'discreto' | 'apariencia' | 'recordatorios' | 'atajos'

interface Apartado {
  id: Id
  titulo: string
  icono: NombreIcono
  color: string
}

const APARTADOS: Record<Exclude<Id, 'perfil'>, Apartado> = {
  guia: { id: 'guia', titulo: 'Guía de uso', icono: 'libro', color: COLOR.turquesa },
  informe: { id: 'informe', titulo: 'Informe PDF', icono: 'documento', color: COLOR.naranja },
  exportar: { id: 'exportar', titulo: 'Exportar', icono: 'grafica', color: COLOR.verde },
  copias: { id: 'copias', titulo: 'Copias de seguridad', icono: 'archivo', color: COLOR.azul },
  partida: { id: 'partida', titulo: 'Punto de partida', icono: 'bandera', color: COLOR.amarillo },
  intereses: { id: 'intereses', titulo: 'Cuenta remunerada', icono: 'billete', color: COLOR.verde },
  conceptos: { id: 'conceptos', titulo: 'Conceptos del primer mes', icono: 'lista', color: COLOR.morado },
  compartida: { id: 'compartida', titulo: 'Cuentas compartidas', icono: 'casa', color: COLOR.marron },
  seguridad: { id: 'seguridad', titulo: 'Contraseña y seguridad', icono: 'candado', color: COLOR.grafito },
  faceid: { id: 'faceid', titulo: 'Face ID', icono: 'cara', color: COLOR.verde },
  discreto: { id: 'discreto', titulo: 'Modo discreto', icono: 'ojoTachado', color: COLOR.indigo },
  apariencia: { id: 'apariencia', titulo: 'Apariencia', icono: 'paleta', color: COLOR.azul },
  recordatorios: { id: 'recordatorios', titulo: 'Recordatorios', icono: 'campana', color: COLOR.naranja },
  atajos: { id: 'atajos', titulo: 'Siri y Atajos', icono: 'microfono', color: COLOR.rosa },
}

/** Palabras con las que se encuentra cada apartado en el buscador de Ajustes (además del título). */
const CLAVES: Record<Exclude<Id, 'perfil'>, string> = {
  guia: 'ayuda tutorial como funciona recorrido aprender empezar manual instrucciones preguntas',
  informe: 'pdf patrimonio imprimir',
  exportar: 'excel xlsx csv numbers descargar tablas',
  copias: 'copia seguridad backup json restaurar icloud',
  partida: 'saldos iniciales inicio primer mes inversiones cuenta remunerada',
  intereses: 'tae interes intereses rentabilidad retencion hacienda banco ahorro',
  conceptos: 'plantilla ingresos gastos primer mes',
  compartida: 'pareja casa compartir invitar miembros',
  seguridad: 'contraseña verificacion dos pasos 2fa sesion cerrar',
  faceid: 'bloqueo huella codigo bloquear',
  discreto: 'ocultar cifras importes privacidad ojo',
  apariencia: 'tema oscuro claro color centimos redondear verde rojo',
  recordatorios: 'aviso cerrar mes notificacion',
  atajos: 'siri atajos shortcuts apuntar enlace',
}

const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

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
  const prefs = usePreferencias()
  const discreto = useDiscreto()
  const [busqueda, setBusqueda] = useState('')
  const bloqueo = useBloqueo()
  const email = useEmail()
  const compartida = activa?.tipo === 'compartida'
  const yo = activa?.miembros.find((m) => m.user_id && m.user_id === userId)
  const nombre = compartida ? activa?.nombre ?? '' : (yo ? nombreMiembro(yo) : '') || leerNombreLocal()

  const disponibles: Id[] = [
    'perfil', 'guia', 'informe', 'exportar', 'copias', 'partida', ...(compartida ? [] : (['intereses'] as Id[])), 'conceptos',
    ...(supabase ? (['compartida', 'seguridad'] as Id[]) : []),
    'faceid', 'discreto', 'apariencia', 'recordatorios', 'atajos',
  ]
  if (seccion && !disponibles.includes(seccion as Id)) return <Navigate to="/ajustes" replace />
  const actual = (seccion as Id | undefined) ?? null
  // En pantallas anchas siempre hay algo a la derecha
  const enPanel: Id = actual ?? 'perfil'

  const { anio, mes } = partes(datos.config.mes_inicio)
  const compartidas = cuentas?.filter((c) => c.tipo === 'compartida') ?? []
  const valores: Partial<Record<Id, string>> = {
    exportar: 'Excel, CSV',
    partida: `${MESES[mes - 1].toLowerCase()} ${anio}`,
    intereses: taeActual(datos.config) > 0 ? `${formatTae(taeActual(datos.config))} TAE` : 'Sin TAE',
    conceptos: String(datos.config.plantilla_ingresos.length + datos.config.plantilla_gastos.length),
    compartida: compartidas.length === 0 ? 'Ninguna' : compartidas.length === 1 ? compartidas[0].nombre : String(compartidas.length),
    faceid: bloqueo.activo ? 'Sí' : 'No',
    discreto: prefs.discretoAlAbrir ? 'Al abrir' : discreto ? 'Activado' : 'No',
    apariencia: NOMBRE_TEMA[tema],
    recordatorios: prefs.recordarCierre ? 'Sí' : 'No',
  }
  const fechaCopia = leerFechaCopia()
  const subs: Partial<Record<Id, string>> = {
    compartida: compartidas.length ? compartidas.map((c) => `${c.nombre} (${conQuien(c, userId).con.replace(/^./, (l) => l.toLowerCase())})`).join(' · ') : undefined,
    copias: fechaCopia ? `Última descargada aquí: ${haceCuanto(fechaCopia)}` : 'Aún no has descargado ninguna en este dispositivo',
  }

  const fila = (id: Exclude<Id, 'perfil'>) => {
    if (!disponibles.includes(id)) return null
    const a = APARTADOS[id]
    return <Fila key={id} icono={a.icono} color={a.color} titulo={a.titulo} sub={subs[id]} valor={valores[id]} to={`/ajustes/${id}`} activa={actual === id} valorSoloMovil />
  }

  const q = sinTildes(busqueda.trim())
  const encontrados = q
    ? (Object.keys(APARTADOS) as Exclude<Id, 'perfil'>[]).filter((id) => disponibles.includes(id) && sinTildes(`${APARTADOS[id].titulo} ${CLAVES[id]}`).includes(q))
    : []

  const lista = (
    <div>
      <h1 className="mb-3 px-1 text-[34px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Ajustes</h1>
      <label className="mb-6 flex h-9 items-center gap-1.5 rounded-[10px] bg-[#e3e3e8] px-2 text-slate-500 dark:bg-[#1c1c1e] dark:text-slate-400">
        <Icono nombre="lupa" className="h-[18px] w-[18px] shrink-0" grosor={2.2} />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setBusqueda('')}
          placeholder="Buscar"
          aria-label="Buscar en Ajustes"
          className="min-w-0 flex-1 bg-transparent text-[17px] text-slate-900 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-400"
        />
      </label>
      {q ? (
        encontrados.length > 0 ? (
          <Grupo>{encontrados.map(fila)}</Grupo>
        ) : (
          <p className="mb-8 px-4 py-6 text-center text-[15px] text-slate-500 dark:text-slate-400">Nada en Ajustes coincide con «{busqueda.trim()}».</p>
        )
      ) : (
      <>
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
      <Grupo>{fila('guia')}</Grupo>
      <Grupo>{fila('informe')}{fila('exportar')}{fila('copias')}</Grupo>
      <Grupo>{fila('partida')}{fila('intereses')}{fila('conceptos')}{fila('compartida')}</Grupo>
      <Grupo>{fila('seguridad')}{fila('faceid')}{fila('discreto')}</Grupo>
      <Grupo>{fila('apariencia')}{fila('recordatorios')}{fila('atajos')}</Grupo>
      {supabase && <CerrarSesion />}
      </>
      )}
      <p className="pb-4 text-center text-[13px] text-slate-400">Presupuesto personal</p>
    </div>
  )

  const titulo = enPanel === 'perfil' ? (compartida ? activa?.nombre ?? 'Cuenta' : 'Perfil') : APARTADOS[enPanel].titulo
  const detalle = (
    <Detalle id={enPanel} titulo={titulo}>
      {enPanel === 'perfil' && <PerfilDetalle email={email} />}
      {enPanel === 'guia' && <GuiaDetalle />}
      {enPanel === 'informe' && <InformeDetalle />}
      {enPanel === 'exportar' && <ExportarDetalle />}
      {enPanel === 'copias' && <CopiasDetalle />}
      {enPanel === 'partida' && <PartidaDetalle />}
      {enPanel === 'intereses' && <InteresesDetalle />}
      {enPanel === 'conceptos' && <ConceptosDetalle />}
      {enPanel === 'compartida' && <div className="mb-8"><CuentaCompartidaCard /></div>}
      {enPanel === 'seguridad' && <SeguridadDetalle email={email} />}
      {enPanel === 'faceid' && <FaceIdDetalle bloqueo={bloqueo} />}
      {enPanel === 'discreto' && <DiscretoDetalle />}
      {enPanel === 'apariencia' && <AparienciaDetalle tema={tema} setTema={setTema} />}
      {enPanel === 'recordatorios' && <RecordatoriosDetalle />}
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

/** Botón «Cerrar sesión» al final de Ajustes, con la opción de cerrarla en todos los dispositivos. */
function CerrarSesion() {
  const [preguntando, setPreguntando] = useState(false)
  return (
    <>
      <Grupo>
        <button
          type="button"
          onClick={() => setPreguntando(true)}
          className="block min-h-11 w-full px-4 text-center text-[17px] text-[#FF3B30] active:bg-slate-200/70 dark:text-[#FF453A] dark:active:bg-white/10"
        >
          Cerrar sesión
        </button>
      </Grupo>
      <Modal
        abierto={preguntando}
        onCerrar={() => setPreguntando(false)}
        titulo="¿Cerrar sesión?"
        pie={
          <>
            <Boton onClick={() => setPreguntando(false)}>Cancelar</Boton>
            <Boton variante="peligro" onClick={() => supabase?.auth.signOut()}>Cerrar sesión</Boton>
          </>
        }
      >
        <p>Para volver a entrar necesitarás tu correo y tu contraseña.</p>
        <button type="button" className="text-left text-[15px] text-[#FF3B30] underline dark:text-[#FF453A]" onClick={() => supabase?.auth.signOut({ scope: 'global' })}>
          Cerrar sesión en todos los dispositivos
        </button>
      </Modal>
    </>
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
        <h2 className="max-w-[55%] truncate text-[17px] font-semibold text-slate-900 dark:text-white">{titulo}</h2>
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
        <Fila titulo="Cuenta" valor={activa ? `${activa.nombre}${activa.tipo === 'compartida' ? ' (compartida)' : ''}` : 'En este navegador'} />
        {email && <Fila titulo="Correo" valor={email} />}
      </Grupo>
    </>
  )
}

// ---------------- Guía de uso ----------------
function GuiaDetalle() {
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const q = sinTildes(busca.trim())
  const grupos = GUIA.map((g) => ({
    ...g,
    fichas: g.fichas.filter((f) => (!f.nube || supabase) && (!q || textoFicha(f).includes(q))),
  })).filter((g) => g.fichas.length > 0)
  const todas = GUIA.flatMap((g) => g.fichas.filter((f) => !f.nube || supabase).map((f) => f.titulo))
  const todasAbiertas = todas.every((t) => abiertas.has(t))
  const alternar = (t: string) => setAbiertas((s) => {
    const n = new Set(s)
    if (n.has(t)) n.delete(t)
    else n.add(t)
    return n
  })
  return (
    <>
      <Portada
        icono="libro"
        color={COLOR.turquesa}
        titulo="Cómo funciona la app"
        texto="Todo lo que puedes hacer, explicado paso a paso. Toca una ficha para leerla o busca lo que necesites."
      />
      <BotonGrande onClick={empezarRecorrido}>Hacer el recorrido guiado</BotonGrande>
      <label className="mb-2 flex h-9 items-center gap-1.5 rounded-[10px] bg-[#e3e3e8] px-2 text-slate-500 dark:bg-[#1c1c1e] dark:text-slate-400">
        <Icono nombre="lupa" className="h-[18px] w-[18px] shrink-0" grosor={2.2} />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setBusca('')}
          placeholder="Buscar en la guía: huchas, TAE, cerrar mes…"
          aria-label="Buscar en la guía"
          className="min-w-0 flex-1 bg-transparent text-[17px] text-slate-900 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-400"
        />
      </label>
      {!q && (
        <div className="mb-4 flex justify-end px-1">
          <button type="button" className="text-[15px] text-[#007AFF] dark:text-[#0A84FF]" onClick={() => setAbiertas(todasAbiertas ? new Set() : new Set(todas))}>
            {todasAbiertas ? 'Cerrar todas' : 'Abrir todas'}
          </button>
        </div>
      )}
      {grupos.length === 0 && <p className="mb-8 px-4 text-[15px] text-slate-500">No hay nada en la guía sobre «{busca.trim()}».</p>}
      {grupos.map((g) => (
        <Grupo key={g.grupo} titulo={g.grupo}>
          {g.fichas.map((f) => {
            const sel = !!q || abiertas.has(f.titulo)
            return (
              <div key={f.titulo} className="ios-fila">
                <button
                  type="button"
                  aria-expanded={sel}
                  onClick={() => alternar(f.titulo)}
                  className="flex w-full items-stretch text-left active:bg-slate-200/70 dark:active:bg-white/10"
                >
                  <span className="py-[9px] pl-4"><IconoApp nombre={f.icono} color={f.color} /></span>
                  <span className="ios-sep ml-3 flex min-h-11 flex-1 items-center gap-3 py-2.5 pr-4">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] leading-tight text-slate-900 dark:text-slate-100">{f.titulo}</span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-slate-500 dark:text-slate-400">{f.resumen}</span>
                    </span>
                    <svg viewBox="0 0 24 24" className={cx('h-4 w-4 shrink-0 text-slate-300 transition-transform dark:text-slate-600', sel && 'rotate-90')} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 5 7 7-7 7" /></svg>
                  </span>
                </button>
                {sel && (
                  <div className="ml-[60px] space-y-3 pb-4 pr-4">
                    {f.secciones.map((sec, i) => (
                      <div key={i}>
                        {sec.titulo && <h4 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{sec.titulo}</h4>}
                        <ul className="space-y-1.5 text-[15px] leading-snug text-slate-700 dark:text-slate-300">
                          {sec.pasos.map((p) => (
                            <li key={p} className="flex gap-2">
                              <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" aria-hidden />
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {f.consejo && (
                      <p className="flex gap-2 rounded-lg bg-sky-50 px-3 py-2 text-[14px] leading-snug text-sky-900 dark:bg-sky-400/10 dark:text-sky-200">
                        <Icono nombre="brillo" className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{f.consejo}</span>
                      </p>
                    )}
                    {f.ir && (
                      <Link to={f.ir.to} className="inline-flex min-h-9 items-center gap-1 text-[15px] font-medium text-[#007AFF] dark:text-[#0A84FF]">
                        {f.ir.texto}
                        <Icono nombre="siguiente" className="h-4 w-4" grosor={2.4} />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </Grupo>
      ))}
    </>
  )
}

// ---------------- Informe PDF ----------------
function InformeDetalle() {
  const { generar, ocupado, compartida, activa, nombrePorDefecto, meses } = useInformePdf()
  const periodo = useSelectorPeriodo()
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
        texto={<>Un PDF con lo apuntado en {compartida ? <>«{activa?.nombre}»</> : 'tu cuenta'}: de todo{meses ? ` (${meses} ${meses === 1 ? 'mes' : 'meses'})` : ''}, de un año o de los meses que elijas.</>}
      />
      <Grupo
        titulo="Portada"
        pie={compartida ? 'En la cuenta compartida, la portada muestra el nombre de la cuenta y de quienes la compartís.' : 'Por defecto, el nombre de tu perfil. Si lo cambias aquí, solo afecta a este PDF.'}
      >
        <FilaCampo etiqueta={compartida ? 'Autor' : 'Nombre'}>
          <input className={claseCampoIos} placeholder="Tu nombre" maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </FilaCampo>
      </Grupo>
      <Grupo
        titulo="Periodo"
        pie={periodo.error ?? (periodo.meses === 0
          ? 'No hay meses apuntados en ese periodo.'
          : `Entran ${periodo.meses} ${periodo.meses === 1 ? 'mes' : 'meses'}. Las cifras de la portada son las del final del periodo.`)}
      >
        <SelectorPeriodo s={periodo} />
      </Grupo>
      <Grupo titulo="Incluye">
        {incluye.map((t) => (
          <Fila key={t} titulo={<span className="text-[15px]">{t}</span>} derecha={<Icono nombre="check" className="h-5 w-5 text-[#34C759]" grosor={2.4} />} />
        ))}
      </Grupo>
      <BotonGrande onClick={() => generar(nombre, periodo.periodo)} disabled={ocupado || !!periodo.error || periodo.meses === 0}>{ocupado ? 'Generando…' : 'Generar PDF'}</BotonGrande>
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
  const [ultima, setUltima] = useState(leerFechaCopia)

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
      <Grupo pie={<>Un archivo JSON con todo: meses, ingresos, gastos, ahorros, Te deben, viajes, huchas y ajustes. {ultima ? `La última que descargaste en este dispositivo fue ${haceCuanto(ultima)}.` : 'Todavía no has descargado ninguna en este dispositivo.'}</>}>
        <Fila titulo="Descargar copia completa" accion="azul" onClick={() => {
          descargar(`presupuesto-copia-${new Date().toISOString().slice(0, 10)}.json`, exportarJSON(datos), 'application/json')
          guardarFechaCopia()
          setUltima(new Date())
        }} />
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

// ---------------- Cuenta remunerada (TAE) ----------------
/** TAE que vale este mes (o la del último tramo si empieza más adelante, para no mostrar «Sin TAE» al ponerla). */
function taeActual(cfg: Config): number {
  const hoy = taeDelMes(cfg, mesActual())
  if (hoy > 0) return hoy
  const tramos = [...(cfg.tae_cuenta_rem ?? [])].sort((a, b) => b.desde.localeCompare(a.desde))
  return tramos[0]?.tae ?? 0
}

/** Campo para un porcentaje: se escribe libre y se guarda al salir. */
function CampoPct({ valor, onCambio, ariaLabel, max = 100 }: { valor: number; onCambio: (v: number) => void; ariaLabel: string; max?: number }) {
  const [texto, setTexto] = useState(String(valor).replace('.', ','))
  useEffect(() => setTexto(String(valor).replace('.', ',')), [valor])
  const guardar = () => {
    const v = parsePct(texto)
    if (v === null || v < 0 || v > max) return setTexto(String(valor).replace('.', ','))
    if (v !== valor) onCambio(v)
  }
  return (
    <span className="flex items-center gap-1">
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        className={cx(claseCampoIos, 'w-16! shrink-0')}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <span className="text-[17px] text-slate-500 dark:text-slate-400">%</span>
    </span>
  )
}

function InteresesDetalle() {
  const { datos, calc, actualizarConfig } = useStore()
  const eur = (c: number) => formatEUR(c, { dash: false })
  const cfg = datos.config
  const tramos = [...(cfg.tae_cuenta_rem ?? [])].sort((a, b) => b.desde.localeCompare(a.desde))
  const guardar = (nuevos: TramoTae[]) => actualizarConfig({ tae_cuenta_rem: [...nuevos].sort((a, b) => a.desde.localeCompare(b.desde)) })
  const cambiar = (i: number, t: Partial<TramoTae>) => {
    const nuevos = tramos.map((x, j) => (j === i ? { ...x, ...t } : x))
    // Dos TAE desde el mismo mes no tienen sentido: se queda la que acabas de tocar
    guardar(nuevos.filter((x, j) => j === i || x.desde !== nuevos[i].desde))
  }
  const anadir = () => {
    const ultimoMes = calc.meses[calc.meses.length - 1]?.mes.fecha
    // La primera TAE empieza este mes (los meses anteriores ya tienen sus saldos reales)
    const desde = tramos.length === 0 ? mesActual() : (ultimoMes && ultimoMes > tramos[0].desde ? ultimoMes : mesActual())
    guardar([...tramos.filter((x) => x.desde !== desde), { desde, tae: tramos[0]?.tae ?? 2 }])
  }

  const tae = taeActual(cfg)
  const saldo = calc.kpis.totalCuentaRem
  const alMes = interesesEstimados(saldo, tae, cfg.retencion_intereses)
  const pago = cfg.pago_intereses ?? 'mes-siguiente'
  const ultimo = calc.meses[calc.meses.length - 1]
  const proximoCobro = ultimo ? fechaDesdeIndice(indiceMes(ultimo.mes.fecha) + 1) : null
  // Meses para elegir «desde»: desde el primero de la app (o la TAE más antigua) hasta dos años después de hoy
  const primero = [cfg.mes_inicio, calc.meses[0]?.mes.fecha, ...tramos.map((t) => t.desde)].filter(Boolean).sort()[0] as string
  const opcionesMes: string[] = []
  for (let i = indiceMes(primero); i <= indiceMes(mesActual()) + 24; i++) opcionesMes.push(fechaDesdeIndice(i))

  return (
    <>
      <Portada
        icono="billete"
        color={COLOR.verde}
        titulo="Intereses de la cuenta remunerada"
        texto="Pon la TAE de tu cuenta y los intereses se suman solos a la cuenta remunerada y a tu dinero total el mes en que te los paga el banco. Si te paga otra cifra, escríbela en el mes y manda esa."
      />
      <Grupo
        titulo="TAE"
        pie={tramos.length > 1
          ? 'Cada mes genera intereses con la TAE que vale desde ese mes. Los meses anteriores a la primera no generan intereses.'
          : '«Desde» es el primer mes que genera intereses con esta TAE. Si tu banco la cambia, añade otra desde el mes en que cambia: los meses anteriores siguen con la de antes.'}
      >
        {tramos.map((t, i) => (
          <div key={t.desde} className="ios-fila">
            <div className="ios-sep ml-4 flex min-h-11 items-center gap-3 py-1.5 pr-4">
              <span className="text-[17px] text-slate-900 dark:text-slate-100">Desde</span>
              <select
                aria-label="Desde el mes"
                className={cx(claseCampoIos, 'min-w-0 flex-1 cursor-pointer appearance-none text-left! text-[#007AFF]! dark:text-[#0A84FF]!')}
                value={t.desde}
                onChange={(e) => cambiar(i, { desde: e.target.value })}
              >
                {opcionesMes.map((m) => <option key={m} value={m}>{MESES_CORTOS[partes(m).mes - 1]} {partes(m).anio}</option>)}
              </select>
              <CampoPct ariaLabel={`TAE desde ${nombreMes(t.desde)}`} valor={t.tae} max={50} onCambio={(v) => cambiar(i, { tae: v })} />
              <button
                type="button"
                aria-label={`Quitar la TAE desde ${nombreMes(t.desde)}`}
                className="-mr-1 rounded-full p-1.5 text-[#FF3B30] active:bg-slate-200/70 dark:text-[#FF453A] dark:active:bg-white/10"
                onClick={() => guardar(tramos.filter((_, j) => j !== i))}
              >
                <Icono nombre="papelera" className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
        <Fila titulo={tramos.length === 0 ? 'Poner la TAE' : 'Cambió la TAE…'} accion="azul" onClick={anadir} />
      </Grupo>
      <Grupo
        titulo="Cuándo te paga el banco"
        pie={pago === 'mes-siguiente'
          ? 'Los intereses que genera un mes se suman en la hoja del mes siguiente, que es cuando te llegan. Por ejemplo, los de noviembre aparecen en diciembre.'
          : 'Los intereses de cada mes se suman en ese mismo mes.'}
      >
        <Fila
          titulo="El día 1 del mes siguiente"
          sub="Lo de noviembre te llega el 1 de diciembre"
          seleccionada={pago === 'mes-siguiente'}
          onClick={() => pago !== 'mes-siguiente' && actualizarConfig({ pago_intereses: 'mes-siguiente' })}
        />
        <Fila
          titulo="El último día del mismo mes"
          sub="Lo de noviembre te llega el 30 de noviembre"
          seleccionada={pago === 'mismo-mes'}
          onClick={() => pago !== 'mismo-mes' && actualizarConfig({ pago_intereses: 'mismo-mes' })}
        />
      </Grupo>
      <Grupo
        titulo="Hacienda"
        pie="Lo que se queda Hacienda de los intereses (en España, el 19 % de los primeros 6.000 € al año). La app suma los intereses netos, lo que de verdad te llega."
      >
        <FilaCampo etiqueta="Retención">
          <CampoPct ariaLabel="Retención sobre los intereses" valor={cfg.retencion_intereses} onCambio={(v) => actualizarConfig({ retencion_intereses: v })} />
        </FilaCampo>
      </Grupo>
      {tae > 0 && saldo > 0 && (
        <Grupo titulo="Así queda">
          <FilaLibre>
            Con <strong>{eur(saldo)}</strong> en la cuenta remunerada al {formatTae(tae)} TAE generas unos{' '}
            <strong className="text-emerald-700 dark:text-emerald-400">{eur(alMes)} al mes</strong> netos
            {' '}(unos {eur(interesesAnuales(saldo, tae, cfg.retencion_intereses))} en un año, si no mueves el dinero).
          </FilaLibre>
          {pago === 'mes-siguiente' && calc.kpis.interesesPendientes > 0 && proximoCobro && (
            <Fila
              titulo="Próximo cobro"
              sub={`1 de ${mesLargo(proximoCobro)} · lo de ${MESES[partes(ultimo!.mes.fecha).mes - 1].toLowerCase()}`}
              derecha={<Dinero c={calc.kpis.interesesPendientes} dash={false} className="text-[17px] text-emerald-700 dark:text-emerald-400" />}
            />
          )}
          {calc.kpis.interesesTotales > 0 && <Fila titulo="Intereses hasta ahora" derecha={<Dinero c={calc.kpis.interesesTotales} dash={false} className="text-[17px] text-slate-500" />} />}
        </Grupo>
      )}
    </>
  )
}

/** Intereses netos de 12 meses seguidos sin mover el dinero (cada mes sobre el saldo con los anteriores). */
function interesesAnuales(saldo: number, tae: number, retencion: number) {
  let s = saldo
  for (let i = 0; i < 12; i++) s += interesesEstimados(s, tae, retencion)
  return s - saldo
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

// ---------------- Modo discreto ----------------
function DiscretoDetalle() {
  const discreto = useDiscreto()
  const { discretoAlAbrir } = usePreferencias()
  return (
    <>
      <Grupo pie="Cambia los importes por •••• € en pantalla. También puedes activarlo o quitarlo con el ojo de la parte de arriba.">
        <Fila icono="ojoTachado" color={COLOR.indigo} titulo="Ocultar cifras" derecha={<Interruptor etiqueta="Ocultar cifras" activo={discreto} onCambio={setDiscreto} />} />
      </Grupo>
      <Grupo pie="Cada vez que abras la app, empezará con las cifras ocultas. Útil si la abres delante de otras personas. Es para este dispositivo.">
        <Fila titulo="Ocultar al abrir la app" derecha={<Interruptor etiqueta="Ocultar al abrir la app" activo={discretoAlAbrir} onCambio={(v) => setPreferencias({ discretoAlAbrir: v })} />} />
      </Grupo>
      <Grupo titulo="Privacidad">
        <FilaLibre>Solo afecta a lo que se ve en pantalla. El informe PDF, las exportaciones y las copias llevan siempre los importes reales.</FilaLibre>
      </Grupo>
    </>
  )
}

// ---------------- Recordatorios ----------------
function RecordatoriosDetalle() {
  const { datos } = useStore()
  const { recordarCierre } = usePreferencias()
  const abiertos = mesesSinCerrar(datos.months)
  return (
    <>
      <Grupo pie="Si un mes ya ha terminado y sigue abierto, Inicio te lo recuerda con un aviso hasta que lo cierres.">
        <Fila icono="campana" color={COLOR.naranja} titulo="Recordar cerrar el mes" derecha={<Interruptor etiqueta="Recordar cerrar el mes" activo={recordarCierre} onCambio={(v) => setPreferencias({ recordarCierre: v })} />} />
      </Grupo>
      <Grupo titulo="Ahora mismo">
        {abiertos.length === 0 ? (
          <FilaLibre>No tienes meses pasados sin cerrar.</FilaLibre>
        ) : (
          abiertos.map((f) => <Fila key={f} titulo={nombreMes(f).replace('-', ' ')} valor="Abierto" to={`/mes/${f.slice(0, 7)}`} />)
        )}
      </Grupo>
    </>
  )
}

// ---------------- Apariencia ----------------
function MiniPantalla({ modo }: { modo: 'claro' | 'oscuro' }) {
  const claro = modo === 'claro'
  return (
    <span className={cx('flex flex-1 flex-col gap-1.5 px-2 pt-3', claro ? 'bg-[#f2f2f7]' : 'bg-black')}>
      <span className={cx('h-2 w-3/5 rounded-sm', claro ? 'bg-slate-800' : 'bg-slate-200')} />
      <span className={cx('h-7 rounded', claro ? 'bg-white' : 'bg-[#2c2c2e]')} />
      <span className={cx('h-5 rounded', claro ? 'bg-white' : 'bg-[#2c2c2e]')} />
      <span className={cx('h-5 rounded', claro ? 'bg-white' : 'bg-[#2c2c2e]')} />
    </span>
  )
}

const Marcado = ({ si }: { si: boolean }) => (
  <span className={cx('flex h-[22px] w-[22px] items-center justify-center rounded-full border', si ? 'border-[#007AFF] bg-[#007AFF] text-white dark:border-[#0A84FF] dark:bg-[#0A84FF]' : 'border-slate-300 dark:border-slate-600')}>
    {si && <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12.5 4.5 4.5L19 7" /></svg>}
  </span>
)

function AparienciaDetalle({ tema, setTema }: { tema: Tema; setTema: (t: Tema) => void }) {
  const prefs = usePreferencias()
  const opciones: { t: Tema; pantalla: ReactNode }[] = [
    { t: 'claro', pantalla: <MiniPantalla modo="claro" /> },
    { t: 'oscuro', pantalla: <MiniPantalla modo="oscuro" /> },
    { t: 'sistema', pantalla: <><MiniPantalla modo="claro" /><MiniPantalla modo="oscuro" /></> },
  ]
  return (
    <>
      <Grupo titulo="Tema" pie="Automático sigue el modo claro u oscuro del dispositivo.">
        <div className="grid grid-cols-3 gap-2 px-3 py-5">
          {opciones.map(({ t, pantalla }) => (
            <button key={t} type="button" onClick={() => setTema(t)} aria-pressed={tema === t} className="flex flex-col items-center gap-2.5">
              <span className={cx('flex h-[132px] w-[72px] overflow-hidden rounded-[14px] border', tema === t ? 'border-[#007AFF] ring-2 ring-[#007AFF]/40' : 'border-slate-300 dark:border-slate-600')}>{pantalla}</span>
              <span className="text-[15px] text-slate-900 dark:text-slate-100">{NOMBRE_TEMA[t]}</span>
              <Marcado si={tema === t} />
            </button>
          ))}
        </div>
      </Grupo>

      <Grupo titulo="Color de la app" pie="Se usa en botones, enlaces y en la pestaña elegida. Es para este dispositivo.">
        <div className="flex flex-wrap gap-4 px-4 py-3.5" role="radiogroup" aria-label="Color de la app">
          {ACENTOS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={prefs.acento === a.id}
              aria-label={a.nombre}
              title={a.nombre}
              onClick={() => setPreferencias({ acento: a.id })}
              className={cx('h-11 w-11 rounded-full border-[3px] border-white dark:border-[#1c1c1e]', prefs.acento === a.id && 'ring-2')}
              style={{ backgroundColor: a.color, ['--tw-ring-color' as string]: a.color }}
            />
          ))}
        </div>
      </Grupo>

      <Grupo titulo="Cifras">
        <div className="ios-fila">
          <div className="ios-sep ml-4 flex min-h-[52px] items-center gap-3 pr-4">
            <span className="flex-1 text-[17px] text-slate-900 dark:text-slate-100">Céntimos</span>
            <span role="radiogroup" aria-label="Céntimos" className="flex rounded-[9px] bg-[#eeeef0] p-0.5 dark:bg-[#2c2c2e]">
              {([[false, 'Mostrar'], [true, 'Redondear']] as const).map(([v, txt]) => (
                <button
                  key={txt}
                  type="button"
                  role="radio"
                  aria-checked={prefs.redondear === v}
                  onClick={() => setPreferencias({ redondear: v })}
                  className={cx('rounded-[7px] px-3.5 py-1.5 text-[13px] font-medium text-slate-900 dark:text-white', prefs.redondear === v && 'bg-white shadow-sm dark:bg-[#636366]')}
                >
                  {txt}
                </button>
              ))}
            </span>
          </div>
        </div>
        <Fila titulo="Saldos positivos en verde" derecha={<Interruptor etiqueta="Saldos positivos en verde" activo={prefs.positivosVerde} onCambio={(v) => setPreferencias({ positivosVerde: v })} />} />
        <Fila titulo="Negativos en rojo" derecha={<Interruptor etiqueta="Negativos en rojo" activo={prefs.negativosRojo} onCambio={(v) => setPreferencias({ negativosRojo: v })} />} />
      </Grupo>

      <Grupo titulo="Vista previa" pie="Así se ven los importes en la app. El PDF y las exportaciones siempre llevan céntimos.">
        <Fila titulo="Ahorro del mes" derecha={<Dinero c={93760} verde dash={false} className="text-[17px]" />} />
        <Fila titulo="Saldo en negativo" derecha={<Dinero c={-8437} dash={false} className="text-[17px]" />} />
      </Grupo>
    </>
  )
}
