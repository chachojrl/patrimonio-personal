import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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

export interface PuntoFuturo {
  etiqueta: string
  /** Para el tooltip: «noviembre de 2036 · 45 años». */
  titulo: string
  /** Proyección normal (ya en euros de hoy y sin impuestos, si toca). */
  Normal: number
  /** De cada 10 simulaciones, 8 quedan entre estos dos valores. */
  rango: [number, number]
  gastos: number
  remunerada: number
  inversiones: number
  impuestos: number
  /** Desglose: lo que ya tienes hoy, lo que pondrás tú y lo que rinde. */
  hoy: number
  puesto: number
  rentabilidad: number
}

const SERIES_DESGLOSE = [
  { clave: 'hoy', nombre: 'Lo que tienes hoy', color: COL.saldo },
  { clave: 'puesto', nombre: 'Lo que pondrás tú', color: COL.cuentaRem },
  { clave: 'rentabilidad', nombre: 'Lo que rinde', color: COL.inversiones },
] as const

function TooltipFuturo({ active, payload, f }: { active?: boolean; payload?: readonly { payload?: PuntoFuturo }[]; f: ReturnType<typeof useFormatos> }) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  const fila = (texto: string, v: number, fuerte = false) => (
    <div className={fuerte ? 'flex justify-between gap-4 font-semibold' : 'flex justify-between gap-4'}><span>{texto}</span><span className="num">{f.largo(v)}</span></div>
  )
  return (
    <div className="min-w-[13rem] space-y-1.5 rounded-[10px] border border-[var(--grid)] bg-[var(--surface)] p-2.5 text-[12px] shadow-lg">
      <div className="text-[13px] font-semibold">{p.titulo}</div>
      <div>
        {fila('Lo más probable', p.Normal, true)}
        <div className="text-slate-500">8 de cada 10 veces, entre {f.largo(p.rango[0])} y {f.largo(p.rango[1])}</div>
      </div>
      <div className="border-t border-[var(--grid)] pt-1.5">
        {fila('Cuenta de gastos', p.gastos)}
        {fila('Cuenta remunerada', p.remunerada)}
        {fila('Inversiones', p.inversiones)}
        {p.impuestos > 0 && fila('Impuestos al vender', -p.impuestos)}
      </div>
      <div className="border-t border-[var(--grid)] pt-1.5">
        {fila('Lo que tienes hoy', p.hoy)}
        {fila('Lo que pondrás tú', p.puesto)}
        {fila('Lo que rinde', p.rentabilidad)}
      </div>
    </div>
  )
}

/**
 * Proyección del patrimonio. «escenarios»: la línea normal y la banda donde caen 8 de cada 10 simulaciones;
 * «desglose»: áreas apiladas con lo que tienes hoy, lo que pondrás tú y lo que rinde (el interés compuesto).
 */
export function LineaProyeccion({ datos, meta, modo = 'escenarios' }: { datos: PuntoFuturo[]; meta?: number | null; modo?: 'escenarios' | 'desglose' }) {
  const f = useFormatos()
  const max = Math.max(...datos.map((d) => (modo === 'escenarios' ? d.rango[1] : d.hoy + d.puesto + d.rentabilidad)))
  const verMeta = meta != null && meta > 0 && meta <= max * 1.15
  const lineaMeta = verMeta && (
    <ReferenceLine y={meta!} stroke="var(--serie-inversiones)" strokeDasharray="4 4" label={{ value: 'Libertad financiera', position: 'insideTopLeft', fontSize: 11, fill: 'var(--text-secondary)' }} />
  )
  const comun = (
    <>
      <CartesianGrid vertical={false} stroke="var(--grid)" />
      <XAxis dataKey="etiqueta" tick={eje} axisLine={false} tickLine={false} minTickGap={24} />
      <YAxis tickFormatter={f.corto} tick={eje} axisLine={false} tickLine={false} width={60} domain={[0, 'auto']} />
      <Tooltip content={(props) => <TooltipFuturo active={props.active} payload={props.payload as never} f={f} />} cursor={{ stroke: 'var(--grid)', strokeWidth: 1 }} />
    </>
  )
  return (
    <div className="h-72 w-full" role="img" aria-label={modo === 'escenarios' ? 'Gráfica de la proyección de tu patrimonio, con el margen entre años buenos y malos' : 'Gráfica de lo que tienes hoy, lo que pondrás tú y lo que rinde'}>
      <ResponsiveContainer>
        {modo === 'escenarios' ? (
          <ComposedChart data={datos} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            {comun}
            {lineaMeta}
            <Area type="monotone" dataKey="rango" stroke="none" fill={COL.inversiones} fillOpacity={0.22} isAnimationActive={false} activeDot={false} />
            <Line type="monotone" dataKey="Normal" stroke={COL.total} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            <Legend content={() => <LeyendaSeries series={[{ nombre: 'Lo más probable', color: COL.total }, { nombre: '8 de cada 10 veces', color: COL.inversiones }]} />} />
          </ComposedChart>
        ) : (
          <AreaChart data={datos} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            {comun}
            {lineaMeta}
            {SERIES_DESGLOSE.map((x) => (
              <Area key={x.clave} type="monotone" dataKey={x.clave} name={x.nombre} stackId="d" stroke={x.color} fill={x.color} fillOpacity={0.75} isAnimationActive={false} />
            ))}
            <Legend content={() => <LeyendaSeries series={SERIES_DESGLOSE.map((x) => ({ nombre: x.nombre, color: x.color }))} />} />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
