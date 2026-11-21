import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { Card, Dinero, Kpi, cx } from '../components/ui'
import { BarrasDineroAnual, type PuntoDinero } from '../components/Graficos'
import { aniosConMeses, resumenAnual } from '../lib/calculos'
import { MESES, MESES_CORTOS } from '../lib/fechas'
import { formatPct } from '../lib/money'

export function ResumenPage() {
  const { anio: anioParam } = useParams()
  const navigate = useNavigate()
  const { calc } = useStore()
  const anios = aniosConMeses(calc)
  const anio = Number(anioParam) || anios.at(-1) || new Date().getFullYear()
  const r = resumenAnual(calc, anio)
  const lista = anios.includes(anio) ? anios : [...anios, anio].sort()

  const grafico: PuntoDinero[] = r.filas.map((f) =>
    f.calc && f.calc.conMovimientos
      ? { mes: MESES_CORTOS[f.mes - 1], Inversiones: f.calc.inversionesAcum, 'Cuenta remunerada': f.calc.cuentaRemAcum, 'Saldo disponible': f.calc.saldoDisponible }
      : { mes: MESES_CORTOS[f.mes - 1] },
  )

  const th0 = 'px-3 py-2.5 text-[13px] font-medium text-slate-500 dark:text-slate-400'
  const th = `${th0} text-right`
  const td0 = 'px-3 py-2.5 border-b border-slate-100 dark:border-white/10'
  const td = `${td0} text-right`
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[34px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Resumen {anio}</h1>
        {lista.length > 1 && (
          <div className="flex flex-wrap gap-0.5 rounded-[9px] bg-[#e3e3e8] p-0.5 dark:bg-[#1c1c1e]" role="tablist" aria-label="Año">
            {lista.map((a) => (
              <button
                key={a}
                type="button"
                role="tab"
                aria-selected={a === anio}
                onClick={() => navigate(`/resumen/${a}`)}
                className={cx('rounded-[7px] px-3 py-1 text-[13px] font-medium', a === anio ? 'bg-white text-slate-900 shadow-sm dark:bg-[#636366] dark:text-white' : 'text-slate-700 dark:text-slate-300')}
              >
                {a}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Ingresos del año" valor={r.total.ingresos} grande />
        <Kpi titulo="Gastos del año" valor={r.total.gastos} grande />
        <Kpi titulo="Ahorro desde ingresos" valor={r.total.ahorroDesdeIngresos} grande />
        <Kpi titulo="% de ahorro sobre ingresos" valor={formatPct(r.total.pctAhorro) || '–'} grande />
      </div>

      <Card titulo="Dónde está el dinero cada mes">
        <BarrasDineroAnual datos={grafico} />
      </Card>

      {/* Móvil: lista de meses */}
      <section className="md:hidden" aria-label="Meses del año">
        <div className="overflow-hidden rounded-xl bg-white dark:bg-[#1c1c1e]">
          {r.filas.filter((f) => f.calc).map((f) => {
            const c = f.calc!
            return (
              <Link key={f.mes} to={`/mes/${c.mes.fecha.slice(0, 7)}`} className="ios-fila flex items-stretch active:bg-slate-100 dark:active:bg-white/10">
                <span className="ios-sep ml-4 flex min-h-11 flex-1 items-center gap-3 py-2.5 pr-4">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px]">{MESES[f.mes - 1]}</span>
                    <span className="block text-[13px] text-slate-500 dark:text-slate-400"><Dinero c={c.ingresosTotales} /> entran · <Dinero c={c.gastosTotales} /> salen</span>
                  </span>
                  <span className="text-right">
                    <Dinero c={c.neto} verde className="block text-[17px] font-semibold" />
                    <span className="block text-[13px] text-slate-500 dark:text-slate-400">{formatPct(c.pctAhorro) || '–'} ahorro</span>
                  </span>
                </span>
              </Link>
            )
          })}
          <div className="ios-fila">
            <div className="ios-sep ml-4 flex min-h-11 items-center justify-between py-2.5 pr-4 text-[17px] font-semibold">
              <span>Total del año</span>
              <Dinero c={r.total.neto} verde />
            </div>
          </div>
        </div>
      </section>

      <Card className="hidden p-0 sm:p-0 md:block">
        <div className="overflow-x-auto rounded-xl">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b border-slate-200 dark:border-white/15">
              <tr>
                <th className={cx(th0, 'text-left')}>Mes</th>
                <th className={th}>Ingresos</th>
                <th className={th}>Gastos</th>
                <th className={th}>Neto</th>
                <th className={th}>Ahorro desde ingresos</th>
                <th className={th}>% ahorro</th>
                <th className={th}>Saldo disponible</th>
                <th className={th}>Dinero total</th>
              </tr>
            </thead>
            <tbody>
              {r.filas.map((f) => {
                const c = f.calc
                return (
                  <tr key={f.mes} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className={cx(td0, 'text-left')}>
                      {c ?  <Link className="text-marino hover:underline dark:text-sky-300" to={`/mes/${c.mes.fecha.slice(0, 7)}`}>{MESES[f.mes - 1]}</Link> : <span className="text-slate-400">{MESES[f.mes - 1]}</span>}
                    </td>
                    <td className={td}>{c && <Dinero c={c.ingresosTotales} />}</td>
                    <td className={td}>{c && <Dinero c={c.gastosTotales} />}</td>
                    <td className={td}>{c && <Dinero c={c.neto} />}</td>
                    <td className={td}>{c && <Dinero c={c.ahorroDesdeIngresos} />}</td>
                    <td className={cx(td, 'num')}>{c && formatPct(c.pctAhorro)}</td>
                    <td className={td}>{c && <Dinero c={c.saldoDisponible} />}</td>
                    <td className={td}>{c && <Dinero c={c.dineroTotal} />}</td>
                  </tr>
                )
              })}
              <tr className="font-semibold [&>td]:border-0 [&>td]:border-t [&>td]:border-slate-300 dark:[&>td]:border-white/20">
                <td className={cx(td0, 'text-left')}>Total año</td>
                <td className={td}><Dinero c={r.total.ingresos} /></td>
                <td className={td}><Dinero c={r.total.gastos} /></td>
                <td className={td}><Dinero c={r.total.neto} /></td>
                <td className={td}><Dinero c={r.total.ahorroDesdeIngresos} /></td>
                <td className={cx(td, 'num')}>{formatPct(r.total.pctAhorro)}</td>
                <td className={td}><Dinero c={r.total.saldoDisponible} /></td>
                <td className={td}><Dinero c={r.total.dineroTotal} /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 text-[13px] text-slate-500 dark:text-slate-400">En la fila Total, saldo disponible y dinero total son los del último mes con datos del año.</p>
      </Card>
    </div>
  )
}
