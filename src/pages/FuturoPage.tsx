// Futuro: cuánto podrías tener si sigues así, y cuándo podrías vivir de tus ahorros.
import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import { useCuentas } from '../data/cuentas'
import { Card, Dinero, Info, cx } from '../components/ui'
import { LineaProyeccion, type PuntoFuturo } from '../components/Graficos'
import { PlanesFuturo } from '../components/PlanesFuturo'
import { useEur } from '../lib/discreto'
import { formatTae } from '../lib/money'
import { MESES_CORTOS, mesActual, mesLargo, partes } from '../lib/fechas'
import {
  base, conceptosRecientes, cuandoLlega, edadEn, libertadFinanciera, llegadaPercentil, proyectar, simular, sobranteMes,
  type Parametros, type PuntoProyeccion,
} from '../lib/futuro'
import { estadosHuchas } from '../lib/huchas'
import { iconoHucha } from '../components/HuchaTarjeta'
import { Icono, type NombreIcono } from '../components/ios'

const PLAZOS = [5, 10, 20, 30] as const
const HITOS = [1000000, 2500000, 5000000, 10000000, 25000000, 50000000, 100000000] // 10k € … 1M €
/** La proyección larga (para encontrar fechas) llega a 50 años. */
const LARGO = 600

const enAnios = (m: number) => (m >= 24 ? `${Math.round(m / 12)} años` : `${m} ${m === 1 ? 'mes' : 'meses'}`)

export function FuturoPage() {
  const { datos, calc, actualizarConfig } = useStore()
  const compartida = useCuentas().activa?.tipo === 'compartida'
  const eur = useEur()
  const cfg = datos.config
  const [anios, setAnios] = useState<(typeof PLAZOS)[number]>(10)
  const [extra, setExtra] = useState(0) // euros al mes
  const [rent, setRent] = useState(cfg.rentabilidad_inversiones)
  const [comision, setComision] = useState(cfg.comision_inversiones)
  const [crec, setCrec] = useState(cfg.crecimiento_ahorro)
  const [vol, setVol] = useState(cfg.volatilidad)
  const [deHoy, setDeHoy] = useState(true)
  const [retirada, setRetirada] = useState(cfg.pct_retirada)
  const [inflacion, setInflacion] = useState(cfg.inflacion)
  const [invertir, setInvertir] = useState(false)
  const [modo, setModo] = useState<'escenarios' | 'desglose'>('escenarios')
  const impuestos = cfg.impuestos_futuro
  const eventos = cfg.eventos_futuro

  const b = useMemo(() => base(calc, datos), [calc, datos])
  const params: Parametros = useMemo(
    () => ({ rentabilidad: rent, extra: extra * 100, inflacion, crecimiento: crec, comision, invertirSobrante: invertir, eventos }),
    [rent, extra, inflacion, crec, comision, invertir, eventos],
  )
  const normal = useMemo(() => proyectar(b, cfg, params, LARGO), [b, cfg, params])
  const libertad = useMemo(
    () => libertadFinanciera(calc, { ...datos, config: { ...datos.config, pct_retirada: retirada } }, normal, { eventos, impuestos }),
    [calc, datos, normal, retirada, eventos, impuestos],
  )
  // Muchas proyecciones con años buenos y malos (la mediana coincide con la normal)
  // (con valores diferidos: mientras arrastras un deslizador, la banda se pone al día un instante después)
  const paramsSim = useDeferredValue(params)
  const volSim = useDeferredValue(vol)
  const alcanza = useDeferredValue(!compartida && libertad ? libertad.alcanza : undefined)
  const sim = useMemo(() => simular(b, cfg, paramsSim, LARGO, { volatilidad: volSim, meta: alcanza }), [b, cfg, paramsSim, volSim, alcanza])
  const meses = anios * 12
  // Lo mismo, pero invirtiendo lo que sobra (o sin invertirlo, si ya lo estás probando)
  const alternativa = useMemo(() => proyectar(b, cfg, { ...params, invertirSobrante: !invertir }, meses), [b, cfg, params, invertir, meses])
  const conceptos = useMemo(() => conceptosRecientes(calc, datos), [calc, datos])

  if (calc.meses.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-[34px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Futuro</h1>
        <Card><p className="text-sm text-slate-500">Cuando tengas algún mes apuntado, aquí verás cuánto podrías tener en el futuro y cuándo podrías vivir de tus ahorros.</p></Card>
      </div>
    )
  }

  const infMes = Math.pow(1 + inflacion / 100, 1 / 12)
  const factor = (t: number) => (deHoy ? 1 / Math.pow(infMes, t) : 1)
  const imp = (p: PuntoProyeccion) => (impuestos ? p.impuestos : 0)
  /** Lo que se enseña: sin impuestos (si se cuentan) y en euros de hoy (si se elige). */
  const valor = (p: PuntoProyeccion) => Math.round((p.total - imp(p)) * factor(p.t))
  const edad = (fecha: string) => edadEn(cfg, fecha)
  const conEdad = (fecha: string) => { const e = edad(fecha); return e !== null ? `${mesLargo(fecha)} · ${e} años` : mesLargo(fecha) }

  const paso = meses <= 120 ? 1 : 3
  const datosGrafica: PuntoFuturo[] = []
  for (let t = 0; t <= meses; t += paso) {
    const n = normal[t]
    const f = factor(t)
    const neto = n.total > 0 ? (n.total - imp(n)) / n.total : 1
    const { anio, mes } = partes(n.fecha)
    const e = edad(n.fecha)
    const v = valor(n)
    const hoy = Math.round(normal[0].total * f)
    const puesto = Math.round(n.aportado * f)
    datosGrafica.push({
      etiqueta: meses <= 60 ? `${MESES_CORTOS[mes - 1]} ${String(anio).slice(2)}` : e !== null ? `${e} años` : String(anio),
      titulo: conEdad(n.fecha),
      Normal: v,
      rango: [Math.round(sim.p10[t] * neto * f), Math.round(sim.p90[t] * neto * f)],
      gastos: Math.round(n.gastos * f),
      remunerada: Math.round(n.remunerada * f),
      inversiones: Math.round(n.inversiones * f),
      impuestos: Math.round(imp(n) * f),
      hoy,
      puesto,
      rentabilidad: v - hoy - puesto,
    })
  }
  const fin = normal[meses]
  const finNeto = fin.total > 0 ? (fin.total - imp(fin)) / fin.total : 1
  const ganancia = fin.total - normal[0].total - fin.aportado
  const rangoFin = [Math.round(sim.p10[meses] * finNeto * factor(meses)), Math.round(sim.p90[meses] * finNeto * factor(meses))]
  const edadFin = edad(fin.fecha)

  // Lo que se queda parado en la cuenta de gastos
  const sobrante = sobranteMes(b)
  const altFin = alternativa[meses]
  const difInvertir = (invertir ? valor(fin) - valor(altFin) : valor(altFin) - valor(fin))
  const parado = (invertir ? altFin.gastos : fin.gastos) - b.gastos

  // Hitos: patrimonio redondo, huchas, tus planes y libertad financiera
  const hitos: { fecha: string; texto: string; icono: NombreIcono }[] = []
  const siguiente = HITOS.find((h) => h > normal[0].total)
  if (siguiente) {
    const p = cuandoLlega(normal, siguiente)
    if (p) hitos.push({ fecha: p.fecha, texto: `Llegas a ${eur(siguiente, { dash: false }).replace(',00', '')}`, icono: 'diana' })
  }
  for (const e of estadosHuchas(datos, mesActual())) {
    if (!e.hucha.conseguida_en && e.mesEstimado) hitos.push({ fecha: e.mesEstimado, texto: `Llenas «${e.hucha.nombre}»`, icono: iconoHucha(e.hucha.emoji) })
  }
  for (const e of eventos) if (e.desde >= normal[0].fecha) hitos.push({ fecha: e.desde, texto: e.nombre, icono: 'calendario' })
  if (libertad?.fecha && !compartida && libertad.progreso < 1) hitos.push({ fecha: libertad.fecha, texto: 'Libertad financiera', icono: 'sol' })
  hitos.sort((a, b2) => a.fecha.localeCompare(b2.fecha))

  // Libertad financiera con años buenos y malos
  const llegaMitad = llegadaPercentil(sim, 0.5)
  const llega90 = llegadaPercentil(sim, 0.9)
  const fechaEn = (t: number) => normal[t].fecha

  const segmento = (activo: boolean) => cx('rounded-[7px] px-1 py-1 text-[13px] font-medium', activo ? 'bg-white text-slate-900 shadow-sm dark:bg-[#636366] dark:text-white' : 'text-slate-700 dark:text-slate-300')

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
            <button key={a} type="button" role="tab" aria-selected={a === anios} onClick={() => setAnios(a)} className={segmento(a === anios)}>
              {a} años
            </button>
          ))}
        </div>
        <p className="text-[15px]">
          En {anios} años ({mesLargo(fin.fecha)}{edadFin !== null ? `, con ${edadFin} años` : ''}) tendrías unos{' '}
          <strong className="text-[22px] font-bold tracking-tight"><Dinero c={valor(fin)} dash={false} /></strong>
          {(deHoy || impuestos) && <span className="text-slate-500"> {[deHoy && 'en euros de hoy', impuestos && 'después de impuestos'].filter(Boolean).join(' y ')}</span>}.
        </p>
        <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
          Contando años buenos y malos, 8 de cada 10 veces tendrías entre {eur(rangoFin[0], { dash: false })} y {eur(rangoFin[1], { dash: false })}.
        </p>
        <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
          Hoy tienes {eur(normal[0].total, { dash: false })}. En estos años pondrías {eur(fin.aportado, { dash: false })} más y{' '}
          {eur(ganancia, { dash: false })} serían rentabilidad e intereses
          {impuestos && imp(fin) > 0 ? `; al venderlo pagarías unos ${eur(imp(fin), { dash: false })} de impuestos` : ''}
          {deHoy ? ` (${eur(fin.total - imp(fin), { dash: false })} en euros de entonces)` : ''}.
        </p>

        <div className="mt-3 grid max-w-xs grid-cols-2 gap-0.5 rounded-[9px] bg-[#e3e3e8] p-0.5 dark:bg-white/10" role="tablist" aria-label="Tipo de gráfica">
          <button type="button" role="tab" aria-selected={modo === 'escenarios'} onClick={() => setModo('escenarios')} className={segmento(modo === 'escenarios')}>Escenarios</button>
          <button type="button" role="tab" aria-selected={modo === 'desglose'} onClick={() => setModo('desglose')} className={segmento(modo === 'desglose')}>De dónde sale</button>
        </div>
        <div className="mt-2"><LineaProyeccion datos={datosGrafica} modo={modo} meta={!compartida && libertad ? libertad.numero : null} /></div>
        <p className="mt-1 text-xs text-slate-500">Toca o pasa por encima de la gráfica para ver cada momento por cuentas y cuánto es tuyo y cuánto rentabilidad.</p>
        <div className="mt-2 space-y-1.5">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={deHoy} onChange={(e) => setDeHoy(e.target.checked)} />
            En euros de hoy (descontando un {formatTae(inflacion)} de inflación al año)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={impuestos} onChange={(e) => actualizarConfig({ impuestos_futuro: e.target.checked })} />
            Descontar impuestos al vender las inversiones
            <Info texto="IRPF del ahorro sobre la ganancia: 19 % hasta 6.000 €, 21 % hasta 50.000 €, 23 % hasta 200.000 €, 27 % hasta 300.000 € y 30 % por encima. Los intereses de la cuenta remunerada ya llegan con la retención descontada." />
          </label>
        </div>
      </Card>

      <Card titulo="Juega con los números">
        <div className="space-y-4">
          <Deslizador
            etiqueta="Ahorro extra al mes"
            valor={extra} min={0} max={2000} paso={25}
            texto={extra === 0 ? 'Nada' : `+${eur(extra * 100, { dash: false })}`}
            onCambio={setExtra}
            ayuda="Lo que podrías ahorrar de más cada mes. Se suma a inversiones."
          />
          <Deslizador
            etiqueta="Rentabilidad de las inversiones"
            valor={rent} min={0} max={12} paso={0.5}
            texto={`${formatTae(rent)} al año`}
            onCambio={setRent}
            onSoltar={(v) => v !== cfg.rentabilidad_inversiones && actualizarConfig({ rentabilidad_inversiones: v })}
            ayuda="Un fondo indexado global ha dado históricamente en torno a un 5–7 % al año, con años buenos y malos. Se guarda para la próxima vez."
          />
          <Deslizador
            etiqueta="Comisiones de tus fondos"
            valor={comision} min={0} max={2} paso={0.05}
            texto={`${formatTae(comision)} al año`}
            onCambio={setComision}
            onSoltar={(v) => v !== cfg.comision_inversiones && actualizarConfig({ comision_inversiones: v })}
            ayuda="Lo que te cobra el fondo cada año (TER o gastos corrientes). Un indexado suele cobrar 0,1–0,3 %; un fondo de banco, 1–2 %. Se resta de la rentabilidad."
          />
          <Deslizador
            etiqueta="Subida de tu ahorro cada año"
            valor={crec} min={0} max={6} paso={0.5}
            texto={crec === 0 ? 'Nada' : `${formatTae(crec)} al año`}
            onCambio={setCrec}
            onSoltar={(v) => v !== cfg.crecimiento_ahorro && actualizarConfig({ crecimiento_ahorro: v })}
            ayuda="Con los años el sueldo y los gastos suelen subir, y lo que ahorras también. Si sube como la inflación, en euros de hoy ahorras siempre lo mismo."
          />
          <Deslizador
            etiqueta="Altibajos de las inversiones"
            valor={vol} min={0} max={30} paso={1}
            texto={`${formatTae(vol)}`}
            onCambio={setVol}
            onSoltar={(v) => v !== cfg.volatilidad && actualizarConfig({ volatilidad: v })}
            ayuda="Cuánto suben y bajan de un año a otro (volatilidad). Un fondo de acciones global ronda el 15 %; uno mixto, el 8–10 %. Se simulan 300 futuros posibles para dibujar la banda."
          />
        </div>
        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-[13px] text-slate-600 dark:bg-white/5 dark:text-slate-300">
          Se parte de lo que tienes hoy ({eur(normal[0].total, { dash: false })}) y de tu ahorro medio
          {b.mesesMedia > 0 ? ` de los últimos ${b.mesesMedia === 1 ? 'mes' : `${b.mesesMedia} meses`}` : ''}: <strong>{eur(b.netoMedio, { dash: false })} al mes</strong>
          {' '}(ingresos − gastos), de los que {eur(b.aInversiones, { dash: false })} van a inversiones y {eur(b.aRemunerada, { dash: false })} a la cuenta remunerada
          {cfg.tae_cuenta_rem.length > 0 ? ', que genera intereses con tu TAE' : ''}.
          {crec > 0 && ` Cada año ahorrarías un ${formatTae(crec)} más.`}
          {eventos.length > 0 && ` Cuenta con ${eventos.length === 1 ? 'el cambio' : `los ${eventos.length} cambios`} de «Tus planes».`}
          {b.netoMedio <= 0 && ' Ahora mismo gastas lo mismo o más de lo que ingresas, así que el patrimonio solo crece con la rentabilidad.'}
        </div>

        {sobrante > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
            <div className="flex items-start gap-2">
              <Icono nombre="alerta" className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                {invertir ? (
                  <>Estás probando a <strong>invertir lo que te sobra</strong> cada mes ({eur(sobrante, { dash: false })}). En {anios} años tendrías {eur(difInvertir, { dash: false })} más que dejándolo en la cuenta de gastos{deHoy ? ' (en euros de hoy)' : ''}.</>
                ) : (
                  <>Cada mes se quedan unos <strong>{eur(sobrante, { dash: false })}</strong> en la cuenta de gastos sin dar nada. En {anios} años serían {eur(parado, { dash: false })} parados;
                    invertidos, tendrías {eur(difInvertir, { dash: false })} más{deHoy ? ' (en euros de hoy)' : ''}. Deja siempre un colchón para imprevistos.</>
                )}
                <div className="mt-2">
                  <button type="button" onClick={() => setInvertir(!invertir)} className="rounded-lg bg-white px-2.5 py-1 text-[13px] font-medium text-amber-900 shadow-sm hover:bg-amber-100 dark:bg-white/10 dark:text-amber-100">
                    {invertir ? 'Dejarlo en la cuenta' : 'Probar a invertirlo'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      <PlanesFuturo />

      {hitos.length > 0 && (
        <Card titulo="Hitos">
          <ul className="divide-y divide-slate-100 dark:divide-white/10">
            {hitos.slice(0, 8).map((h) => (
              <li key={`${h.fecha}-${h.texto}`} className="flex items-center gap-3 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-marino/10 text-marino dark:bg-sky-400/15 dark:text-sky-300" aria-hidden>
                  <Icono nombre={h.icono} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1 text-sm">{h.texto}</span>
                <span className="shrink-0 text-right text-sm text-slate-500">
                  {mesLargo(h.fecha)}
                  {edad(h.fecha) !== null && <span className="block text-xs">a los {edad(h.fecha)}</span>}
                </span>
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
                ({eur(libertad.gastoAnual, { dash: false })} al año de gastos
                {libertad.impuestosAnual > 0 && ` + ${eur(libertad.impuestosAnual, { dash: false })} de impuestos al sacarlo`}) ÷ {formatTae(retirada)}
                {libertad.excluidoAnual > 0 && `, sin ${eur(libertad.excluidoAnual, { dash: false })} que no tendrías`}
                {libertad.numeroLlegada !== null && `. Con tus planes, cuando llegues necesitarás ${eur(libertad.numeroLlegada, { dash: false })}.`}
              </div>
            </div>
            <div>
              <div className="text-[13px] text-slate-500">Llevas</div>
              <div className="text-[28px] font-bold tracking-tight">{Math.min(999, Math.round(libertad.progreso * 100))} %</div>
              <div className="text-xs text-slate-500">
                {libertad.progreso >= 1
                  ? '¡Ya podrías vivir de tus ahorros!'
                  : libertad.fecha
                    ? `Llegarías en ${mesLargo(libertad.fecha)} (en ${enAnios(libertad.meses!)}${edad(libertad.fecha) !== null ? `, a los ${edad(libertad.fecha)}` : ''}), en euros de hoy`
                    : 'A este ritmo no llegarías en los próximos 50 años: prueba a ahorrar algo más arriba.'}
              </div>
            </div>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="meter" aria-label="Progreso hacia la libertad financiera" aria-valuenow={Math.round(Math.min(1, libertad.progreso) * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, libertad.progreso * 100)}%` }} />
          </div>
          {libertad.progreso < 1 && llegaMitad !== null && (
            <p className="mt-3 text-[13px] text-slate-600 dark:text-slate-300">
              Con años buenos y malos: la mitad de las veces llegas antes de <strong>{mesLargo(fechaEn(llegaMitad))}</strong>
              {llega90 !== null
                ? <> y 9 de cada 10, antes de <strong>{mesLargo(fechaEn(llega90))}</strong>{edad(fechaEn(llega90)) !== null && ` (a los ${edad(fechaEn(llega90))})`}.</>
                : ', pero con mala suerte podrías no llegar en 50 años.'}
            </p>
          )}

          <div className="mt-5 space-y-4">
            <Deslizador
              etiqueta="Lo que sacarías al año"
              valor={retirada} min={2.5} max={6} paso={0.25}
              texto={formatTae(retirada)}
              onCambio={setRetirada}
              onSoltar={(v) => v !== cfg.pct_retirada && actualizarConfig({ pct_retirada: v })}
              ayuda="Cuanto menos saques, más tarda en llegar pero más seguro es. El 3,5–4 % es lo habitual."
            />
            <Deslizador
              etiqueta="Inflación"
              valor={inflacion} min={0} max={6} paso={0.5}
              texto={`${formatTae(inflacion)} al año`}
              onCambio={setInflacion}
              onSoltar={(v) => v !== cfg.inflacion && actualizarConfig({ inflacion: v })}
              ayuda="Para pasar las cifras del futuro a euros de hoy y actualizar los importes de tus planes. El objetivo del Banco Central Europeo es el 2 %."
            />
          </div>

          {conceptos.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-[#007AFF] dark:text-[#0A84FF]">Quitar gastos que entonces no tendrías</summary>
              <p className="mt-2 text-xs text-slate-500">Por ejemplo, la comida de la oficina. Si algo se acaba en una fecha (la hipoteca), mejor añádelo en «Tus planes». Media al mes de los últimos meses.</p>
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
        Las rentabilidades pasadas no garantizan las futuras. Los impuestos son una estimación con los tramos actuales del IRPF del ahorro{impuestos ? '' : ' (ahora no se descuentan)'}.
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
