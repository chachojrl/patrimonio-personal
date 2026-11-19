import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { formatEUR, formatPct } from '../lib/money'

// Colores por papel (definidos como variables CSS en index.css, con su versión oscura)
export const COL = {
  inversiones: 'var(--series-1)',
  cuentaRem: 'var(--series-2)',
  saldo: 'var(--series-3)',
  ingresos: 'var(--series-1)',
  gastos: 'var(--series-2)',
  disponible: 'var(--series-1)',
  gastado: 'var(--series-2)',
}

const eje = { fontSize: 11, fill: 'var(--text-secondary)' }
const euroCorto = (v: number) => {
  const e = v / 100
  if (Math.abs(e) >= 1000) return `${(e / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} k€`
  return `${Math.round(e)} €`
}

const estiloTooltip = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--grid)', borderRadius: 8, fontSize: 12 },
  labelStyle: { fontWeight: 600, color: 'inherit' },
  itemStyle: { color: 'inherit' },
}

/** Donut "Porcentaje de ingresos gastado" */
export function DonutGastado({ pctGastado }: { pctGastado: number }) {
  const datos = [
    { nombre: 'Disponible', valor: 1 - pctGastado, color: COL.disponible },
    { nombre: 'Gastado', valor: pctGastado, color: COL.gastado },
  ]
  const vacio = pctGastado === 0 && datos[0].valor === 1
  return (
    <div className="w-full">
      <div className="relative h-48 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={datos}
            dataKey="valor"
            nameKey="nombre"
            innerRadius="62%"
            outerRadius="92%"
            startAngle={90}
            endAngle={-270}
            stroke="var(--surface)"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {datos.map((d) => <Cell key={d.nombre} fill={d.color} />)}
          </Pie>
          <Tooltip {...estiloTooltip} formatter={(v) => formatPct(Number(v))} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-2xl font-bold">{formatPct(pctGastado)}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{vacio ? 'sin ingresos' : 'gastado'}</span>
      </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
        {datos.map((d) => (
          <span key={d.nombre} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
            {d.nombre} {formatPct(d.valor)}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Columnas agrupadas Ingresos vs Gastos */
export function BarrasIngresosGastos({ ingresos, gastos }: { ingresos: number; gastos: number }) {
  const datos = [{ nombre: 'Este mes', Ingresos: ingresos, Gastos: gastos }]
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <BarChart data={datos} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="nombre" tick={eje} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={euroCorto} tick={eje} axisLine={false} tickLine={false} width={56} />
          <Tooltip {...estiloTooltip} cursor={{ fill: 'var(--grid)', opacity: 0.4 }} formatter={(v) => formatEUR(Number(v), { dash: false })} />
          <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Ingresos" fill={COL.ingresos} radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false} />
          <Bar dataKey="Gastos" fill={COL.gastos} radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface PuntoDinero {
  mes: string
  Inversiones?: number
  'Cuenta remunerada'?: number
  'Saldo disponible'?: number
}

/** Columnas apiladas del resumen anual */
export function BarrasDineroAnual({ datos }: { datos: PuntoDinero[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="mes" tick={eje} axisLine={false} tickLine={false} interval={0} />
          <YAxis tickFormatter={euroCorto} tick={eje} axisLine={false} tickLine={false} width={56} />
          <Tooltip {...estiloTooltip} cursor={{ fill: 'var(--grid)', opacity: 0.4 }} formatter={(v) => formatEUR(Number(v), { dash: false })} />
          <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Inversiones" stackId="a" fill={COL.inversiones} stroke="var(--surface)" strokeWidth={1} maxBarSize={40} isAnimationActive={false} />
          <Bar dataKey="Cuenta remunerada" stackId="a" fill={COL.cuentaRem} stroke="var(--surface)" strokeWidth={1} maxBarSize={40} isAnimationActive={false} />
          <Bar dataKey="Saldo disponible" stackId="a" fill={COL.saldo} stroke="var(--surface)" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Línea: Dinero total por mes */
export function LineaDineroTotal({ datos }: { datos: { mes: string; valor: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={datos} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="mes" tick={eje} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={euroCorto} tick={eje} axisLine={false} tickLine={false} width={60} domain={['auto', 'auto']} />
          <Tooltip {...estiloTooltip} formatter={(v) => [formatEUR(Number(v), { dash: false }), 'Dinero total']} />
          <Line type="monotone" dataKey="valor" stroke={COL.inversiones} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'var(--surface)' }} activeDot={{ r: 6 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
