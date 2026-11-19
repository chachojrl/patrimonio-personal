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

  const th0 = 'px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-white'
  const th = `${th0} text-right`
  const td0 = 'px-3 py-2 border-b border-slate-100 dark:border-slate-800'
  const td = `${td0} text-right`
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-marino dark:text-sky-300">Resumen {anio}</h1>
        <label className="flex items-center gap-2 text-sm">
          Año
          <select className="campo w-28" value={anio} onChange={(e) => navigate(`/resumen/${e.target.value}`)}>
            {lista.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Ingresos del año" valor={r.total.ingresos} grande />
        <Kpi titulo="Gastos del año" valor={r.total.gastos} grande />
        <Kpi titulo="Ahorro desde ingresos" valor={r.total.ahorroDesdeIngresos} grande />
        <Kpi titulo="% de ahorro sobre ingresos" valor={formatPct(r.total.pctAhorro) || '–'} grande />
      </div>

      <Card className="p-0 sm:p-0">
        <div className="overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-marino dark:bg-sky-900">
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
                  <tr key={f.mes} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className={cx(td0, 'text-left')}>
                      {c ? <Link className="text-sky-800 hover:underline dark:text-sky-300" to={`/mes/${c.mes.fecha.slice(0, 7)}`}>{MESES[f.mes - 1]}</Link> : <span className="text-slate-400">{MESES[f.mes - 1]}</span>}
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
              <tr className="bg-emerald-50 font-semibold dark:bg-emerald-900/20">
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
        <p className="px-4 py-3 text-xs italic text-slate-500">En la fila Total, saldo disponible y dinero total corresponden al último mes con datos del año.</p>
      </Card>

      <Card titulo={`Dinero total por mes en ${anio}: inversiones, cuenta remunerada y saldo disponible`}>
        <BarrasDineroAnual datos={grafico} />
      </Card>
    </div>
  )
}
