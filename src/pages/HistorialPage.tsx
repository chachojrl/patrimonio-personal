import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import { BadgeEstado, Card, CeldaImporte, Dinero, Info, Kpi, cx } from '../components/ui'
import { LineaDineroTotal } from '../components/Graficos'
import { InversionesKpi } from '../components/InversionesKpi'
import { ColchonCard } from '../components/ColchonCard'
import { MESES_CORTOS, formatFecha, partes } from '../lib/fechas'

const TOOLTIP_VALOR =
  'Escribe el valor total de la cartera ese mes, no la ganancia. En blanco se conserva la última valoración más aportaciones posteriores.'

export function HistorialPage() {
  const { calc, actualizar } = useStore()
  const k = calc.kpis
  const lineas = calc.meses.map((m) => {
    const { anio, mes } = partes(m.mes.fecha)
    return { mes: `${MESES_CORTOS[mes - 1]} ${String(anio).slice(2)}`, valor: m.dineroTotal }
  })

  const cols: { t: string; info?: string }[] = [
    { t: 'Fecha' }, { t: 'Hoja' }, { t: 'Estado' }, { t: 'Ingresos' }, { t: 'Gastos' }, { t: 'Ahorro' }, { t: 'Saldo disponible' },
    { t: 'Neto del mes' }, { t: 'Inversiones (mes)' }, { t: 'Cuenta remunerada (mes)' }, { t: 'Inversión desde cuenta rem. (mes)' },
    { t: 'Inversiones acum.' }, { t: 'Cuenta rem. acum.' }, { t: 'Ahorro acumulado' }, { t: 'Dinero total' },
    { t: 'Valor real inversiones', info: TOOLTIP_VALOR }, { t: 'Estado del mes' },
  ]

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-marino dark:text-sky-300">Historial</h1>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card titulo="General">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 xl:grid-cols-2">
            <Kpi titulo="Dinero total actual" valor={k.dineroTotalActual} grande />
            <Kpi titulo="Saldo inicial total" valor={k.saldoInicialTotal} />
            <Kpi titulo="Último mes registrado" valor={k.ultimoMes ?? '–'} />
            <ColchonCard compacta />
          </div>
        </Card>
        <Card titulo="Inversiones">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 xl:grid-cols-2">
            <InversionesKpi grande />
            <Kpi titulo="Total invertido (aportado)" valor={k.totalInvertido} />
            <Kpi titulo="Ganancia / pérdida" valor={k.gananciaInversiones} verde />
          </div>
        </Card>
        <Card titulo="Cuenta remunerada">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 xl:grid-cols-2">
            <Kpi titulo="Total en cuenta remunerada" valor={k.totalCuentaRem} grande />
            <Kpi titulo="Cuenta remunerada inicial" valor={k.cuentaRemInicial} />
          </div>
        </Card>
      </div>

      <Card className="p-0 sm:p-0">
        <div className="max-h-[70vh] overflow-auto rounded-2xl">
          <table className="w-full min-w-[110rem] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                {cols.map((c, i) => (
                  <th
                    key={c.t}
                    className={cx(
                      'sticky top-0 z-10 bg-marino px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white dark:bg-sky-900',
                      i === 0 && 'left-0 z-20',
                      i >= 3 && i <= 15 && 'text-right',
                    )}
                  >
                    {c.t}
                    {c.info && <Info texto={c.info} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calc.historial.map((h) => {
                const c = h.calc
                const td = 'border-b border-slate-100 px-3 py-1.5 dark:border-slate-800'
                return (
                  <tr key={h.fecha} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className={cx(td, 'num sticky left-0 bg-white dark:bg-slate-900')}>{formatFecha(h.fecha)}</td>
                    <td className={td}>
                      {c ? <Link className="text-sky-800 hover:underline dark:text-sky-300" to={`/mes/${h.fecha.slice(0, 7)}`}>{h.nombre}</Link> : <span className="text-slate-400">{h.nombre}</span>}
                    </td>
                    <td className={cx(td, !c && 'text-slate-400')}>{c ? 'Registrado' : 'Sin hoja'}</td>
                    {c ? (
                      <>
                        <td className={cx(td, 'text-right')}><Dinero c={c.ingresosTotales} /></td>
                        <td className={cx(td, 'text-right')}><Dinero c={c.gastosTotales} /></td>
                        <td className={cx(td, 'text-right')}><Dinero c={c.ahorroTotal} /></td>
                        <td className={cx(td, 'text-right')}><Dinero c={c.saldoDisponible} /></td>
                        <td className={cx(td, 'text-right')}><Dinero c={c.neto} /></td>
                        <td className={cx(td, 'text-right')}><Dinero c={c.invMes} /></td>
                        <td className={cx(td, 'text-right')}><Dinero c={c.ctaRemMes} /></td>
                        <td className={cx(td, 'text-right')}><Dinero c={c.invDesdeCtaRem} /></td>
                        <td className={cx(td, 'text-right')}><Dinero c={c.inversionesAcum} /></td>
                        <td className={cx(td, 'text-right')}><Dinero c={c.cuentaRemAcum} /></td>
                        <td className={cx(td, 'text-right')}><Dinero c={c.ahorroAcumulado} /></td>
                        <td className={cx(td, 'text-right font-semibold')}><Dinero c={c.dineroTotal} /></td>
                        <td className={cx(td, 'w-40')}>
                          <CeldaImporte
                            ariaLabel={`Valor real inversiones ${h.nombre}`}
                            valor={c.mes.valor_real_inversiones}
                            permitirVacio
                            placeholder="—"
                            onCambio={(v) => actualizar('months', c.mes.id, { valor_real_inversiones: v })}
                          />
                        </td>
                        <td className={td}><BadgeEstado estado={c.mes.estado} /></td>
                      </>
                    ) : (
                      <td className={td} colSpan={14} />
                    )}
                  </tr>
                )
              })}
              {calc.historial.length === 0 && (
                <tr><td className="px-3 py-6 text-slate-500" colSpan={cols.length}>Aún no hay meses.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {lineas.length > 0 && (
        <Card titulo="Dinero total por mes">
          <LineaDineroTotal datos={lineas} />
        </Card>
      )}
    </div>
  )
}
