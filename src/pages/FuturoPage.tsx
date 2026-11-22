// Futuro: cuánto podrías tener si sigues así, y cuándo podrías vivir de tus ahorros.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import { useCuentas } from '../data/cuentas'
import { Card, Dinero, Info, cx } from '../components/ui'
import { LineaProyeccion, type PuntoFuturo } from '../components/Graficos'
import { useEur } from '../lib/discreto'
import { formatTae } from '../lib/money'
import { MESES_CORTOS, mesActual, mesLargo, partes } from '../lib/fechas'
import { base, conceptosRecientes, cuandoLlega, escenarios, libertadFinanciera } from '../lib/futuro'
import { estadosHuchas } from '../lib/huchas'
import { iconoHucha } from '../components/HuchaTarjeta'
import { Icono, type NombreIcono } from '../components/ios'

const PLAZOS = [5, 10, 20, 30] as const
const HITOS = [1000000, 2500000, 5000000, 10000000, 25000000, 50000000, 100000000] // 10k € … 1M €

export function FuturoPage() {
  const { datos, calc, actualizarConfig } = useStore()
  const compartida = useCuentas().activa?.tipo === 'compartida'
  const eur = useEur()
  const cfg = datos.config
  const [anios, setAnios] = useState<(typeof PLAZOS)[number]>(10)
  const [extra, setExtra] = useState(0) // euros al mes
  const [rent, setRent] = useState(cfg.rentabilidad_inversiones)
  const [deHoy, setDeHoy] = useState(true)
  const [retirada, setRetirada] = useState(cfg.pct_retirada)
  const [inflacion, setInflacion] = useState(cfg.inflacion)

  const b = useMemo(() => base(calc, datos), [calc, datos])
  const params = { rentabilidad: rent, extra: extra * 100, inflacion }
  // Proyección larga (50 años) para encontrar fechas; la gráfica enseña el plazo elegido
  const largo = useMemo(() => escenarios(b, cfg, params, 600), [b, cfg, rent, extra, inflacion]) // eslint-disable-line react-hooks/exhaustive-deps
  const libertad = useMemo(
    () => libertadFinanciera(calc, { ...datos, config: { ...datos.config, pct_retirada: retirada } }, largo.normal),
    [calc, datos, largo, retirada],
  )
  const conceptos = useMemo(() => conceptosRecientes(calc, datos), [calc, datos])

  if (calc.meses.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-[34px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Futuro</h1>
        <Card><p className="text-sm text-slate-500">Cuando tengas algún mes apuntado, aquí verás cuánto podrías tener en el futuro y cuándo podrías vivir de tus ahorros.</p></Card>
      </div>
    )
  }

  const meses = anios * 12
  const paso = meses <= 120 ? 1 : 3
  const valor = (p: { total: number; totalReal: number }) => (deHoy ? p.totalReal : p.total)
  const datosGrafica: PuntoFuturo[] = []
  for (let t = 0; t <= meses; t += paso) {
    const { anio, mes } = partes(largo.normal[t].fecha)
    datosGrafica.push({
      etiqueta: meses <= 60 ? `${MESES_CORTOS[mes - 1]} ${String(anio).slice(2)}` : String(anio),
      Pesimista: valor(largo.pesimista[t]),
      Normal: valor(largo.normal[t]),
      Optimista: valor(largo.optimista[t]),
    })
  }
  const fin = largo.normal[meses]
  const ganancia = fin.total - largo.normal[0].total - fin.aportado

  // Hitos: patrimonio redondo, huchas y libertad financiera
  const hitos: { fecha: string; texto: string; icono: NombreIcono }[] = []
  const siguiente = HITOS.find((h) => h > largo.normal[0].total)
  if (siguiente) {
    const p = cuandoLlega(largo.normal, siguiente)
    if (p) hitos.push({ fecha: p.fecha, texto: `Llegas a ${eur(siguiente, { dash: false }).replace(',00', '')}`, icono: 'diana' })
  }
  for (const e of estadosHuchas(datos, mesActual())) {
    if (!e.hucha.conseguida_en && e.mesEstimado) hitos.push({ fecha: e.mesEstimado, texto: `Llenas «${e.hucha.nombre}»`, icono: iconoHucha(e.hucha.emoji) })
  }
  if (libertad?.fecha && !compartida && libertad.progreso < 1) hitos.push({ fecha: libertad.fecha, texto: 'Libertad financiera', icono: 'sol' })
  hitos.sort((a, b2) => a.fecha.localeCompare(b2.fecha))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[34px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Futuro</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Lo que podrías tener si sigues como hasta ahora. Es una estimación: el futuro no está escrito, pero ayuda a ver hacia dónde vas.
        </p>
      </div>

      <Card titulo="Tu patrimonio">
          <div className="mb-3 grid grid-cols-4 gap-0.5 rounded-[9px] bg-[#e3e3e8] p-0.5 dark:bg-white/10" role="tablist" aria-label="Plazo">
            {PLAZOS.map((a) => (
              <button
                key={a}
                type="button"
                role="tab"
                aria-selected={a === anios}
                onClick={() => setAnios(a)}
                className={cx('rounded-[7px] px-1 py-1 text-[13px] font-medium', a === anios ? 'bg-white text-slate-900 shadow-sm dark:bg-[#636366] dark:text-white' : 'text-slate-700 dark:text-slate-300')}
              >
                {a} años
              </button>
            ))}
          </div>
        <p className="text-[15px]">
          En {anios} años ({mesLargo(fin.fecha)}) tendrías unos{' '}
          <strong className="text-[22px] font-bold tracking-tight"><Dinero c={valor(fin)} dash={false} /></strong>
          {deHoy && <span className="text-slate-500"> en euros de hoy</span>}.
        </p>
        <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
          Hoy tienes {eur(largo.normal[0].total, { dash: false })}. En estos años pondrías {eur(fin.aportado, { dash: false })} más y{' '}
          {eur(ganancia, { dash: false })} serían rentabilidad e intereses{deHoy ? `: ${eur(fin.total, { dash: false })} en euros de entonces` : ''}.
        </p>
        <div className="mt-3"><LineaProyeccion datos={datosGrafica} meta={!compartida && libertad ? libertad.numero : null} /></div>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={deHoy} onChange={(e) => setDeHoy(e.target.checked)} />
          En euros de hoy (descontando un {formatTae(inflacion)} de inflación al año)
        </label>
      </Card>

      <Card titulo="Juega con los números">
        <div className="space-y-4">
          <Deslizador
            etiqueta="Ahorro extra al mes"
            valor={extra}
            min={0}
            max={2000}
            paso={25}
            texto={extra === 0 ? 'Nada' : `+${eur(extra * 100, { dash: false })}`}
            onCambio={setExtra}
            ayuda="Lo que podrías ahorrar de más cada mes. Se suma a inversiones."
          />
          <Deslizador
            etiqueta="Rentabilidad de las inversiones"
            valor={rent}
            min={0}
            max={12}
            paso={0.5}
            texto={`${formatTae(rent)} al año`}
            onCambio={setRent}
            onSoltar={(v) => v !== cfg.rentabilidad_inversiones && actualizarConfig({ rentabilidad_inversiones: v })}
            ayuda="Un fondo indexado global ha dado históricamente en torno a un 5–7 % al año, con años buenos y malos. Pesimista y optimista son 2 puntos menos y más. Se guarda para la próxima vez."
          />
        </div>
        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-[13px] text-slate-600 dark:bg-white/5 dark:text-slate-300">
          Se parte de lo que tienes hoy ({eur(largo.normal[0].total, { dash: false })}) y de tu ahorro medio
          {b.mesesMedia > 0 ? ` de los últimos ${b.mesesMedia === 1 ? 'mes' : `${b.mesesMedia} meses`}` : ''}: <strong>{eur(b.netoMedio, { dash: false })} al mes</strong>
          {' '}(ingresos − gastos), de los que {eur(b.aInversiones, { dash: false })} van a inversiones y {eur(b.aRemunerada, { dash: false })} a la cuenta remunerada
          {cfg.tae_cuenta_rem.length > 0 ? ', que genera intereses con tu TAE' : ''}.
          {b.netoMedio <= 0 && ' Ahora mismo gastas lo mismo o más de lo que ingresas, así que el patrimonio solo crece con la rentabilidad.'}
        </div>
      </Card>

      {hitos.length > 0 && (
        <Card titulo="Hitos">
          <ul className="divide-y divide-slate-100 dark:divide-white/10">
            {hitos.slice(0, 6).map((h) => (
              <li key={h.texto} className="flex items-center gap-3 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-marino/10 text-marino dark:bg-sky-400/15 dark:text-sky-300" aria-hidden>
                  <Icono nombre={h.icono} className="h-5 w-5" />
                </span>
                <span className="flex-1 text-sm">{h.texto}</span>
                <span className="text-sm text-slate-500">{mesLargo(h.fecha)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!compartida && libertad && (
        <Card titulo="Libertad financiera">
          <p className="text-[13px] text-slate-500 dark:text-slate-400">
            Cuánto necesitarías para vivir de tus ahorros: si cada año sacas un {formatTae(retirada)} de lo que tienes invertido, el dinero debería durarte toda la vida (la «regla del 4 %»).
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[13px] text-slate-500">Tu número</div>
              <div className="text-[28px] font-bold tracking-tight"><Dinero c={libertad.numero} dash={false} /></div>
              <div className="text-xs text-slate-500">
                {eur(libertad.gastoAnual, { dash: false })} al año de gastos ÷ {formatTae(retirada)}
                {libertad.excluidoAnual > 0 && ` (sin ${eur(libertad.excluidoAnual, { dash: false })} que no tendrías)`}
              </div>
            </div>
            <div>
              <div className="text-[13px] text-slate-500">Llevas</div>
              <div className="text-[28px] font-bold tracking-tight">{Math.min(999, Math.round(libertad.progreso * 100))} %</div>
              <div className="text-xs text-slate-500">
                {libertad.progreso >= 1
                  ? '¡Ya podrías vivir de tus ahorros!'
                  : libertad.fecha
                    ? `Llegarías en ${mesLargo(libertad.fecha)} (en ${libertad.meses! >= 24 ? `${Math.round(libertad.meses! / 12)} años` : `${libertad.meses} meses`}), en euros de hoy`
                    : 'A este ritmo no llegarías en los próximos 50 años: prueba a ahorrar algo más arriba.'}
              </div>
            </div>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="meter" aria-label="Progreso hacia la libertad financiera" aria-valuenow={Math.round(Math.min(1, libertad.progreso) * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, libertad.progreso * 100)}%` }} />
          </div>

          <div className="mt-5 space-y-4">
            <Deslizador
              etiqueta="Lo que sacarías al año"
              valor={retirada}
              min={2.5}
              max={6}
              paso={0.25}
              texto={formatTae(retirada)}
              onCambio={setRetirada}
              onSoltar={(v) => v !== cfg.pct_retirada && actualizarConfig({ pct_retirada: v })}
              ayuda="Cuanto menos saques, más tarda en llegar pero más seguro es. El 3,5–4 % es lo habitual."
            />
            <Deslizador
              etiqueta="Inflación"
              valor={inflacion}
              min={0}
              max={6}
              paso={0.5}
              texto={`${formatTae(inflacion)} al año`}
              onCambio={setInflacion}
              onSoltar={(v) => v !== cfg.inflacion && actualizarConfig({ inflacion: v })}
              ayuda="Para pasar las cifras del futuro a euros de hoy. El objetivo del Banco Central Europeo es el 2 %."
            />
          </div>

          {conceptos.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-[#007AFF] dark:text-[#0A84FF]">Quitar gastos que entonces no tendrías</summary>
              <p className="mt-2 text-xs text-slate-500">Por ejemplo, la hipoteca si ya estará pagada o la comida de la oficina. Media al mes de los últimos meses.</p>
              <ul className="mt-2 divide-y divide-slate-100 dark:divide-white/10">
                {conceptos.slice(0, 20).map((c) => {
                  const fuera = cfg.fire_excluidos.includes(c.clave)
                  return (
                    <li key={c.clave}>
                      <label className="flex items-center gap-2 py-1.5 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={!fuera}
                          onChange={() => actualizarConfig({ fire_excluidos: fuera ? cfg.fire_excluidos.filter((x) => x !== c.clave) : [...cfg.fire_excluidos, c.clave] })}
                        />
                        <span className={cx('flex-1', fuera && 'text-slate-400 line-through')}>{c.concepto}</span>
                        <Dinero c={c.medioMes} dash={false} className={cx('text-sm', fuera && 'text-slate-400')} />
                      </label>
                    </li>
                  )
                })}
              </ul>
            </details>
          )}
        </Card>
      )}

      <p className="px-1 text-xs text-slate-500">
        Las rentabilidades pasadas no garantizan las futuras. Ni la proyección ni la libertad financiera tienen en cuenta impuestos sobre las ganancias de las inversiones.
        {' '}La TAE de la cuenta remunerada se cambia en <Link to="/ajustes/intereses" className="underline">Ajustes → Cuenta remunerada</Link>.
      </p>
    </div>
  )
}

function Deslizador({ etiqueta, valor, min, max, paso, texto, onCambio, onSoltar, ayuda }: {
  etiqueta: string; valor: number; min: number; max: number; paso: number; texto: string
  onCambio: (v: number) => void; onSoltar?: (v: number) => void; ayuda?: string
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{etiqueta}{ayuda && <Info texto={ayuda} />}</span>
        <span className="num text-slate-600 dark:text-slate-300">{texto}</span>
      </span>
      <input
        type="range"
        className="mt-1.5 w-full accent-marino dark:accent-sky-400"
        min={min}
        max={max}
        step={paso}
        value={valor}
        aria-label={etiqueta}
        aria-valuetext={texto}
        onChange={(e) => onCambio(Number(e.target.value))}
        onPointerUp={(e) => onSoltar?.(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => onSoltar?.(Number((e.target as HTMLInputElement).value))}
        onBlur={(e) => onSoltar?.(Number(e.target.value))}
      />
    </label>
  )
}
