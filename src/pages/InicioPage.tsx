import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import { BadgeEstado, Card, Dinero, cx } from '../components/ui'
import { CrearMesBoton } from '../components/CrearMes'
import { FilaInversiones } from '../components/InversionesKpi'
import { Icono } from '../components/ios'
import { usePreferencias, mesesSinCerrar } from '../lib/preferencias'
import { anioParaAviso } from '../lib/anioEnCifras'
import { empezarRecorrido, guiaVista, marcarGuiaVista } from '../lib/guia'
import { OCULTO, useDiscreto, useEur } from '../lib/discreto'
import { formatEUR, formatTae, type Cents } from '../lib/money'
import { MESES, MESES_CORTOS } from '../lib/fechas'
import type { ReactNode } from 'react'
import { useCuentas } from '../data/cuentas'
import { UltimosCambios } from './ActividadPage'
import { ColchonCard } from '../components/ColchonCard'
import { TarjetaHucha } from '../components/HuchaTarjeta'
import { LogrosCard } from '../components/Logros'
import { dineroLibre, estadosHuchas } from '../lib/huchas'
import { mesActual } from '../lib/fechas'
import { aniosConMeses, resumenAnual } from '../lib/calculos'
import { partes } from '../lib/fechas'
import type { EstadoMes } from '../lib/tipos'

interface FilaIndice {
  clave: string
  hoja: string
  tipo: 'Resumen anual' | 'Mes' | 'Historial'
  to: string
  estado?: EstadoMes
  ingresos?: number
  gastos?: number
  saldo?: number | null
}

const CLAVE_ANIO = 'inicio.anio'

function leerAnioGuardado(): number | null {
  try {
    const v = Number(localStorage.getItem(CLAVE_ANIO))
    return Number.isInteger(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

/** Índice de hojas (equivale a la macro ActualizarIndice, pero siempre al día). */
export function InicioPage() {
  const { calc, datos, modo } = useStore()
  const discreto = useDiscreto()
  const eur = useEur()
  const compartida = useCuentas().activa?.tipo === 'compartida'
  const anios = aniosConMeses(calc)
  const [anioElegido, setAnioElegido] = useState<number | null>(leerAnioGuardado)
  const anioActual = new Date().getFullYear()
  // Año mostrado: el elegido si existe; si no, el actual (si tiene meses) o el último con meses.
  const anioVisible =
    anioElegido !== null && anios.includes(anioElegido)
      ? anioElegido
      : anios.includes(anioActual)
        ? anioActual
        : anios[anios.length - 1]
  const elegirAnio = (a: number) => {
    setAnioElegido(a)
    try {
      localStorage.setItem(CLAVE_ANIO, String(a))
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  }

  const filas: FilaIndice[] = []
  for (const anio of anios.filter((a) => a === anioVisible)) {
    const r = resumenAnual(calc, anio)
    filas.push({ clave: `r${anio}`, hoja: `Resumen ${anio}`, tipo: 'Resumen anual', to: `/resumen/${anio}`, ingresos: r.total.ingresos, gastos: r.total.gastos, saldo: r.total.saldoDisponible })
    for (const m of calc.meses.filter((x) => partes(x.mes.fecha).anio === anio)) {
      filas.push({ clave: m.mes.id, hoja: m.nombre, tipo: 'Mes', to: `/mes/${m.mes.fecha.slice(0, 7)}`, estado: m.mes.estado, ingresos: m.ingresosTotales, gastos: m.gastosTotales, saldo: m.saldoDisponible })
    }
  }
  if (calc.meses.length > 0) filas.push({ clave: 'hist', hoja: 'Historial', tipo: 'Historial', to: '/historial' })

  const k = calc.kpis
  const pendientes = datos.debts.filter((x) => !x.devuelto_en)
  const totalDeben = pendientes.reduce((a, x) => a + x.importe, 0)
  const personas = [...new Map(pendientes.map((x) => [x.persona.trim().toLowerCase(), x.persona.trim()])).values()]
  const { recordarCierre } = usePreferencias()
  const sinCerrar = recordarCierre ? mesesSinCerrar(datos.months) : []
  const ultimo = calc.meses.at(-1)
  const anterior = calc.meses.at(-2)
  const variacion = ultimo && anterior ? ultimo.dineroTotal - anterior.dineroTotal : null
  const serie = calc.meses.slice(-12)
  const anioAviso = anioParaAviso()
  const [ofrecerGuia, setOfrecerGuia] = useState(() => !guiaVista())
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[34px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Inicio</h1>
        <CrearMesBoton />
      </div>

      {ofrecerGuia && (
        <section className="rounded-xl bg-white p-4 dark:bg-[#1c1c1e]" aria-labelledby="titulo-guia">
          <div className="flex items-start gap-3">
            <span className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[7px] bg-[#30B0C7] text-white"><Icono nombre="libro" className="h-[18px] w-[18px]" /></span>
            <div className="min-w-0 flex-1">
              <h2 id="titulo-guia" className="text-[15px] font-semibold">¿Es tu primera vez?</h2>
              <p className="text-[13px] text-slate-500 dark:text-slate-400">Te enseño en un minuto dónde está cada cosa. Luego lo tienes en Ajustes › Guía de uso.</p>
              <div className="mt-2.5 flex gap-2">
                <button type="button" onClick={() => { setOfrecerGuia(false); empezarRecorrido() }} className="min-h-9 rounded-full bg-marino px-4 text-[15px] font-semibold text-white dark:bg-sky-700">Enséñame</button>
                <button type="button" onClick={() => { marcarGuiaVista(); setOfrecerGuia(false) }} className="min-h-9 rounded-full px-3 text-[15px] text-slate-500 dark:text-slate-400">Ahora no</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {sinCerrar.length > 0 && (
        <Link
          to={`/mes/${sinCerrar[0].slice(0, 7)}`}
          className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-[15px] active:bg-slate-100 dark:bg-[#1c1c1e] dark:active:bg-white/10"
        >
          <span className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[7px] bg-[#FF9500] text-white"><Icono nombre="campana" className="h-[18px] w-[18px]" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{sinCerrar.length === 1 ? `${nombreLargo(sinCerrar[0])} sigue abierto` : `${sinCerrar.length} meses pasados siguen abiertos`}</span>
            <span className="block text-[13px] text-slate-500 dark:text-slate-400">Ciérralo cuando tengas todo apuntado. Puedes quitar este aviso en Ajustes.</span>
          </span>
          <Chevron />
        </Link>
      )}

      {anioAviso !== null && anios.includes(anioAviso) && (
        <Link to={`/anio/${anioAviso}`} className="flex items-center gap-3 rounded-xl bg-marino px-4 py-3 text-white active:opacity-90 dark:bg-sky-800">
          <span className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[7px] bg-white/15"><Icono nombre="estrella" className="h-[18px] w-[18px]" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Ya está tu {anioAviso} en cifras</span>
            <span className="block text-[13px] opacity-80">Tu año resumido en unas pocas pantallas</span>
          </span>
          <Icono nombre="siguiente" className="h-5 w-5 shrink-0 opacity-80" grosor={2.2} />
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section className="rounded-xl bg-white p-4 dark:bg-[#1c1c1e]" aria-labelledby="titulo-patrimonio" data-guia="patrimonio">
          <h2 id="titulo-patrimonio" className="text-[15px] text-slate-500 dark:text-slate-400">{compartida ? 'Dinero de la cuenta' : 'Patrimonio'}</h2>
          <CifraGrande c={k.dineroTotalActual} />
          {variacion !== null && anterior && (
            <p className={cx('mt-0.5 text-[15px] font-semibold', variacion >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
              {variacion > 0 && !discreto && '+'}
              <Dinero c={variacion} dash={false} /> respecto a {nombreLargo(anterior.mes.fecha).split(' ')[0].toLowerCase()}
            </p>
          )}
          {serie.length >= 2 ? (
            <>
              <Evolucion valores={serie.map((m) => m.dineroTotal)} meses={serie.length} />
              <div className="mt-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{nombreCorto(serie[0].mes.fecha)}</span>
                <span>{nombreCorto(serie[serie.length - 1].mes.fecha)}</span>
              </div>
            </>
          ) : (
            <p className="mt-3 text-[13px] text-slate-500 dark:text-slate-400">{k.ultimoMes ? `Último mes: ${k.ultimoMes}. ` : ''}La gráfica de evolución aparece cuando tengas dos meses.</p>
          )}
        </section>

        <div className="space-y-6">
          {ultimo && (
            <section aria-labelledby="titulo-mes">
              <h2 id="titulo-mes" className="mb-1.5 px-4 text-[13px] text-slate-500 dark:text-slate-400">
                {nombreLargo(ultimo.mes.fecha)} · {ultimo.mes.estado === 'Abierto' ? 'abierto' : 'cerrado'}
              </h2>
              <div className="overflow-hidden rounded-xl bg-white dark:bg-[#1c1c1e]">
                <FilaCifra to={`/mes/${ultimo.mes.fecha.slice(0, 7)}`} titulo="Ingresos" c={ultimo.ingresosTotales} />
                <FilaCifra to={`/mes/${ultimo.mes.fecha.slice(0, 7)}`} titulo="Gastos" c={ultimo.gastosTotales} />
                <FilaCifra to={`/mes/${ultimo.mes.fecha.slice(0, 7)}`} titulo="Ingresos menos gastos" c={ultimo.neto} fuerte verde />
              </div>
            </section>
          )}

          {!compartida && ultimo && (
            <section aria-labelledby="titulo-donde">
              <h2 id="titulo-donde" className="mb-1.5 px-4 text-[13px] text-slate-500 dark:text-slate-400">Dónde está tu dinero</h2>
              <div className="overflow-hidden rounded-xl bg-white dark:bg-[#1c1c1e]">
                <Reparto partes={[ultimo.saldoDisponible, k.totalCuentaRem, k.totalInversiones]} />
                <FilaCifra titulo="Disponible" c={ultimo.saldoDisponible} marca={<Marca n={0} />} />
                <FilaCifra
                  titulo="Cuenta remunerada"
                  sub={
                    ultimo.interesesCtaRem > 0
                      ? `+${eur(ultimo.interesesCtaRem, { dash: false })} de intereses cobrados este mes${ultimo.interesesReales ? '' : ` (${formatTae(ultimo.tae)} TAE)`}`
                      : k.interesesPendientes > 0
                        ? `Unos ${eur(k.interesesPendientes, { dash: false })} de intereses el 1 de ${MESES[partes(ultimo.mes.fecha).mes % 12].toLowerCase()}`
                        : undefined
                  }
                  c={k.totalCuentaRem}
                  marca={<Marca n={1} />}
                />
                <FilaInversiones marca={<Marca n={2} />} />
              </div>
            </section>
          )}
        </div>
      </div>

      {(!compartida || pendientes.length > 0) && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {!compartida && <ColchonCard compacta />}
          {!compartida && <LogrosCard />}
          {pendientes.length > 0 && (
            <Link to="/te-deben" className="rounded-xl bg-white p-3.5 active:bg-slate-100 dark:bg-[#1c1c1e] dark:active:bg-white/10 sm:p-4">
              <div className="text-[13px] text-slate-500 dark:text-slate-400">Te deben</div>
              <div className="mt-0.5 text-[22px] font-bold tracking-tight"><Dinero c={totalDeben} dash={false} /></div>
              <div className="mt-1.5 truncate text-xs text-slate-500 dark:text-slate-400">{listaNombres(personas)}</div>
            </Link>
          )}
        </div>
      )}

      <HuchasInicio />

      {compartida && <UltimosCambios />}

      {filas.length === 0 ? (
        <Card>
          <p className="mb-2 font-medium">Todavía no hay ningún mes.</p>
          <p className="mb-4 text-sm text-slate-500">
            Crea tu primer mes para empezar. Si ya tienes ahorros o inversiones, puedes indicar los saldos iniciales en{' '}
            <Link to="/ajustes" className="text-sky-700 underline dark:text-sky-400">Ajustes</Link>.
            {modo === 'local' && ' (Ahora estás en modo local.)'}
          </p>
          <CrearMesBoton />
        </Card>
      ) : (
        <section aria-labelledby="titulo-hojas">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 px-4">
          <h2 id="titulo-hojas" className="text-[13px] text-slate-500 dark:text-slate-400">Meses y resúmenes</h2>
          {anios.length > 1 && (
            <div className="flex flex-wrap gap-0.5 rounded-[9px] bg-[#e3e3e8] p-0.5 dark:bg-[#1c1c1e]" role="tablist" aria-label="Año">
              {anios.map((a) => (
                <button
                  key={a}
                  type="button"
                  role="tab"
                  aria-selected={a === anioVisible}
                  onClick={() => elegirAnio(a)}
                  className={cx(
                    'rounded-[7px] px-3 py-1 text-[13px] font-medium transition-colors',
                    a === anioVisible
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-[#636366] dark:text-white'
                      : 'text-slate-700 dark:text-slate-300',
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          )}
        </div>
        <Card className="overflow-hidden p-0 sm:p-0">
          {/* Escritorio: tabla */}
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[13px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="px-4 py-2.5 font-medium">Hoja</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 text-right font-medium">Ingresos</th>
                <th className="px-4 py-2.5 text-right font-medium">Gastos</th>
                <th className="px-4 py-2.5 text-right font-medium">Saldo disponible</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr
                  key={f.clave}
                  className={cx(
                    'border-b border-slate-100 last:border-0 dark:border-slate-800',
                    f.tipo !== 'Mes' && 'font-semibold',
                    f.tipo !== 'Mes' && i > 0 && 'border-t-8 border-t-[#f2f2f7] dark:border-t-black',
                  )}
                >
                  <td className={cx('px-4 py-2.5', f.tipo === 'Mes' && 'pl-8')}>
                    <Link to={f.to} className="text-marino hover:underline dark:text-sky-300">{f.hoja}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{f.tipo}</td>
                  <td className="px-4 py-2.5">{f.estado && <BadgeEstado estado={f.estado} />}</td>
                  <td className="px-4 py-2.5 text-right"><Dinero c={f.ingresos} /></td>
                  <td className="px-4 py-2.5 text-right"><Dinero c={f.gastos} /></td>
                  <td className="px-4 py-2.5 text-right"><Dinero c={f.saldo} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Móvil: tarjetas */}
          <ul className="divide-y divide-slate-200/70 dark:divide-white/10 md:hidden">
            {filas.map((f) => (
              <li key={f.clave}>
                <Link
                  to={f.to}
                  className={cx(
                    'flex items-center justify-between gap-3 px-4 py-3',
                    'active:bg-slate-100 dark:active:bg-white/10',
                  )}
                >
                  <div className={cx(f.tipo === 'Mes' && 'pl-3')}>
                    <div className={cx('font-medium', f.tipo !== 'Mes' && 'font-semibold')}>{f.hoja}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      {f.tipo}
                      {f.estado && <BadgeEstado estado={f.estado} />}
                    </div>
                  </div>
                  {f.tipo !== 'Historial' && (
                    <div className="text-right text-xs">
                      <div className="text-sm font-semibold"><Dinero c={f.saldo} /></div>
                      <div className="text-slate-500">
                        <Dinero c={f.ingresos} /> / <Dinero c={f.gastos} />
                      </div>
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        </section>
      )}
    </div>
  )
}

const nombreLargo = (fecha: string) => {
  const { anio, mes } = partes(fecha)
  return `${MESES[mes - 1]} ${anio}`
}
const nombreCorto = (fecha: string) => {
  const { anio, mes } = partes(fecha)
  return `${MESES_CORTOS[mes - 1].toLowerCase()} ${anio}`
}
const listaNombres = (xs: string[]) =>
  xs.length <= 2 ? xs.join(' y ') : `${xs.slice(0, 2).join(', ')} y ${xs.length - 2} más`

const Chevron = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m9 5 7 7-7 7" />
  </svg>
)

/** La cifra principal: euros en grande y los céntimos más pequeños y suaves. */
function CifraGrande({ c }: { c: Cents }) {
  const discreto = useDiscreto()
  const { redondear } = usePreferencias()
  if (discreto) return <p className="num mt-0.5 text-[40px] font-bold leading-tight tracking-tight text-slate-400" aria-label="Importe oculto">{OCULTO}</p>
  const texto = formatEUR(c, { dash: false, redondear })
  const [euros, centimos] = texto.replace(' €', '').split(',')
  return (
    <p className={cx('num mt-0.5 flex items-baseline leading-tight', c < 0 && 'text-red-600 dark:text-red-400')}>
      <span className="text-[40px] font-bold tracking-tight">{euros}</span>
      <span className="ml-0.5 text-[22px] font-semibold text-slate-500 dark:text-slate-400">{centimos !== undefined ? `,${centimos} €` : ' €'}</span>
    </p>
  )
}

/** Línea con la evolución del patrimonio (sin ejes: el detalle está en Historial). */
function Evolucion({ valores, meses }: { valores: number[]; meses: number }) {
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const rango = max - min || 1
  const W = 300
  const H = 60
  const pts = valores.map((v, i) => [(i / (valores.length - 1)) * W, 6 + (1 - (v - min) / rango) * (H - 12)] as const)
  const sube = valores[valores.length - 1] >= valores[0]
  return (
    <Link to="/historial" className="mt-3 block" aria-label={`Evolución en los últimos ${meses} meses: ${sube ? 'al alza' : 'a la baja'}. Ver el historial.`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-16 w-full overflow-visible text-marino dark:text-sky-300" aria-hidden>
        <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </Link>
  )
}

// Mismos colores que en las gráficas de Resumen (variables en index.css)
const TONOS = ['bg-[var(--serie-disponible)]', 'bg-[var(--serie-remunerada)]', 'bg-[var(--serie-inversiones)]']
const Marca = ({ n }: { n: number }) => <span className={cx('h-2.5 w-2.5 rounded-[3px]', TONOS[n])} aria-hidden />

/** Barra con el reparto entre disponible, cuenta remunerada e inversiones. */
function Reparto({ partes: valores }: { partes: number[] }) {
  const pos = valores.map((v) => Math.max(0, v))
  const total = pos.reduce((a, b) => a + b, 0)
  if (total <= 0) return null
  return (
    <div className="mx-4 mb-1.5 mt-3.5 flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
      {pos.map((v, i) => v > 0 && <div key={i} className={TONOS[i]} style={{ flexGrow: v }} />)}
    </div>
  )
}

/** Fila de lista con un importe a la derecha. */
function FilaCifra({ titulo, sub, c, to, marca, fuerte, verde }: { titulo: string; sub?: string; c: Cents; to?: string; marca?: ReactNode; fuerte?: boolean; verde?: boolean }) {
  const contenido = (
    <>
      {marca && <span className="flex items-center pl-4">{marca}</span>}
      <span className={cx('ios-sep flex min-h-11 flex-1 items-center gap-2 py-2 pr-4', marca ? 'ml-2.5' : 'ml-4')}>
        <span className={cx('flex-1 text-[17px]', fuerte && 'font-semibold')}>
          {titulo}
          {sub && <span className="block text-[13px] font-normal text-slate-500 dark:text-slate-400">{sub}</span>}
        </span>
        <Dinero c={c} dash={false} verde={verde} className={cx('text-[17px]', fuerte && 'font-semibold')} />
        {to && <Chevron />}
      </span>
    </>
  )
  return to ? (
    <Link to={to} className="ios-fila flex items-stretch active:bg-slate-100 dark:active:bg-white/10">{contenido}</Link>
  ) : (
    <div className="ios-fila flex items-stretch">{contenido}</div>
  )
}

/** Las huchas en curso (hasta 4), con lo que queda libre. */
function HuchasInicio() {
  const { datos, calc } = useStore()
  const enCurso = estadosHuchas(datos, mesActual()).filter((e) => !e.hucha.conseguida_en)
  if (enCurso.length === 0) return null
  const l = dineroLibre(calc, datos)
  return (
    <section aria-labelledby="titulo-huchas">
      <div className="mb-1.5 flex items-center justify-between gap-2 px-4">
        <h2 id="titulo-huchas" className="text-[13px] text-slate-500 dark:text-slate-400">
          Huchas · <Dinero c={l.reservado} dash={false} /> reservados, <Dinero c={l.libre} dash={false} /> libres
        </h2>
        <Link to="/huchas" className="shrink-0 text-[13px] text-[#007AFF] dark:text-[#0A84FF]">Ver todas</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {enCurso.slice(0, 4).map((e) => <TarjetaHucha key={e.hucha.id} e={e} compacta />)}
      </div>
    </section>
  )
}
