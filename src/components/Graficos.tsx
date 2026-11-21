import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatEUR } from '../lib/money'
import { OCULTO, useDiscreto } from '../lib/discreto'

// Colores por papel (definidos como variables CSS en index.css, con su versión oscura)
// Mismos tonos que «Dónde está tu dinero» en Inicio: el color de la app, del más oscuro al más claro.
export const COL = {
  saldo: 'var(--serie-disponible)',
  cuentaRem: 'var(--serie-remunerada)',
  inversiones: 'var(--serie-inversiones)',
  total: 'var(--serie-disponible)',
}

const eje = { fontSize: 11, fill: 'var(--text-secondary)' }
const euroCorto = (v: number) => {
  const e = v / 100
  if (Math.abs(e) >= 1000) return `${(e / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} k€`
  return `${Math.round(e)} €`
}

/** Formatos de eje y tooltip; en modo discreto ocultan las cifras. */
function useFormatos() {
  const d = useDiscreto()
  return {
    corto: d ? () => '•••' : euroCorto,
    largo: (v: unknown) => (d ? OCULTO : formatEUR(Number(v), { dash: false })),
  }
}

const estiloTooltip = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--grid)', borderRadius: 10, fontSize: 13, boxShadow: '0 4px 14px rgba(0,0,0,0.08)' },
  labelStyle: { fontWeight: 600, color: 'inherit' },
  itemStyle: { color: 'inherit' },
}

export interface PuntoDinero {
  mes: string
  Inversiones?: number
  'Cuenta remunerada'?: number
  'Saldo disponible'?: number
}

/** Leyenda con el texto en gris (el color lo lleva solo el punto), en el orden en que se apilan. */
function LeyendaSeries({ series }: { series: { nombre: string; color: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13px] text-slate-600 dark:text-slate-300">
      {series.map((x) => (
        <li key={x.nombre} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} aria-hidden />
          {x.nombre}
        </li>
      ))}
    </ul>
  )
}

/** Columnas apiladas del resumen anual */
export function BarrasDineroAnual({ datos }: { datos: PuntoDinero[] }) {
  const f = useFormatos()
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="mes" tick={eje} axisLine={false} tickLine={false} interval={0} />
          <YAxis tickFormatter={f.corto} tick={eje} axisLine={false} tickLine={false} width={56} />
          <Tooltip {...estiloTooltip} cursor={{ fill: 'var(--grid)', opacity: 0.4 }} formatter={f.largo} />
          <Legend content={() => <LeyendaSeries series={[{ nombre: 'Saldo disponible', color: COL.saldo }, { nombre: 'Cuenta remunerada', color: COL.cuentaRem }, { nombre: 'Inversiones', color: COL.inversiones }]} />} />
          <Bar dataKey="Saldo disponible" stackId="a" fill={COL.saldo} stroke="var(--surface)" strokeWidth={2} maxBarSize={36} isAnimationActive={false} />
          <Bar dataKey="Cuenta remunerada" stackId="a" fill={COL.cuentaRem} stroke="var(--surface)" strokeWidth={2} maxBarSize={36} isAnimationActive={false} />
          <Bar dataKey="Inversiones" stackId="a" fill={COL.inversiones} stroke="var(--surface)" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Línea: Dinero total por mes */
export function LineaDineroTotal({ datos }: { datos: { mes: string; valor: number }[] }) {
  const f = useFormatos()
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={datos} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="mes" tick={eje} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={f.corto} tick={eje} axisLine={false} tickLine={false} width={60} domain={['auto', 'auto']} />
          <Tooltip {...estiloTooltip} cursor={{ stroke: 'var(--grid)', strokeWidth: 1 }} formatter={(v) => [f.largo(v), 'Dinero total']} />
          <Line type="monotone" dataKey="valor" stroke={COL.total} strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface)' }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
