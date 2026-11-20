import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import { BadgeEstado, Card, Dinero, Kpi, cx } from '../components/ui'
import { CrearMesBoton } from '../components/CrearMes'
import { InversionesKpi } from '../components/InversionesKpi'
import { useCuentas } from '../data/cuentas'
import { UltimosCambios } from './ActividadPage'
import { ColchonCard } from '../components/ColchonCard'
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
  const nPersonas = new Set(pendientes.map((x) => x.persona.trim().toLowerCase())).size
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-marino dark:text-sky-300">Índice de hojas</h1>
        <CrearMesBoton />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Dinero total actual" valor={k.dineroTotalActual} grande />
        <Kpi titulo="Último mes registrado" valor={k.ultimoMes ?? '–'} grande />
        {!compartida && (
          <>
            <InversionesKpi />
            <Kpi titulo="Total en cuenta remunerada" valor={k.totalCuentaRem} />
          </>
        )}
      </div>

      {!compartida && <ColchonCard />}
      {compartida && <UltimosCambios />}

      {pendientes.length > 0 && (
        <Link
          to="/te-deben"
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
        >
          <span>
            🤝 Te deben <strong><Dinero c={totalDeben} dash={false} /></strong>{' '}
            <span className="text-slate-500">({nPersonas === 1 ? '1 persona' : `${nPersonas} personas`})</span>
          </span>
          <span className="text-sky-700 dark:text-sky-400">Ver →</span>
        </Link>
      )}

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
        <Card className="p-0 sm:p-0">
          {anios.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800" role="tablist" aria-label="Año">
              <span className="mr-1 text-sm text-slate-500">Año:</span>
              {anios.map((a) => (
                <button
                  key={a}
                  type="button"
                  role="tab"
                  aria-selected={a === anioVisible}
                  onClick={() => elegirAnio(a)}
                  className={cx(
                    'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                    a === anioVisible
                      ? 'bg-marino text-white dark:bg-sky-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          )}
          {/* Escritorio: tabla */}
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="bg-marino text-left text-white dark:bg-sky-900">
                <th className="px-4 py-3 font-semibold">Hoja</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 text-right font-semibold">Ingresos</th>
                <th className="px-4 py-3 text-right font-semibold">Gastos</th>
                <th className="px-4 py-3 text-right font-semibold">Saldo disponible</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr
                  key={f.clave}
                  className={cx(
                    'border-b border-slate-100 dark:border-slate-800',
                    f.tipo === 'Resumen anual' && 'bg-emerald-50 font-semibold dark:bg-emerald-900/20',
                    f.tipo === 'Historial' && 'bg-amber-50 font-semibold dark:bg-amber-900/20',
                    f.tipo !== 'Mes' && i > 0 && 'border-t-8 border-t-white dark:border-t-slate-900',
                  )}
                >
                  <td className={cx('px-4 py-2.5', f.tipo === 'Mes' && 'pl-8')}>
                    <Link to={f.to} className="text-sky-800 hover:underline dark:text-sky-300">{f.hoja}</Link>
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
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
            {filas.map((f) => (
              <li key={f.clave}>
                <Link
                  to={f.to}
                  className={cx(
                    'flex items-center justify-between gap-3 px-4 py-3',
                    f.tipo === 'Resumen anual' && 'bg-emerald-50 dark:bg-emerald-900/20',
                    f.tipo === 'Historial' && 'bg-amber-50 dark:bg-amber-900/20',
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
      )}
      <p className="text-xs italic text-slate-500">El índice se actualiza solo con cada cambio.</p>
    </div>
  )
}
