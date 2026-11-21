// «¿Me lo puedo permitir?»: escribes un importe y te dice cómo quedarían tu colchón y tus ahorros.
import { useState } from 'react'
import { useStore } from '../data/store'
import { useCuentas } from '../data/cuentas'
import { simular, type Veredicto } from '../lib/permitir'
import { parseImporte } from '../lib/money'
import { useEur } from '../lib/discreto'
import { Fila, Grupo, Icono, type NombreIcono } from '../components/ios'
import { cx } from '../components/ui'

// Opciones rápidas; «Otro» deja escribir cualquier número de meses (hasta 40 años)
const PLAZOS: (number | 'otro')[] = [1, 6, 12, 24, 'otro']
const MAX_MESES = 480

const ASPECTO: Record<Veredicto, { titulo: string; icono: NombreIcono; color: string }> = {
  si: { titulo: 'Sí, te lo puedes permitir', icono: 'check', color: 'bg-[#34C759]' },
  cuidado: { titulo: 'Puedes, pero con cuidado', icono: 'alerta', color: 'bg-[#FF9500]' },
  esperar: { titulo: 'Mejor esperar', icono: 'reloj', color: 'bg-[#FF3B30]' },
}

const meses = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })} ${n >= 0.95 && n < 1.05 ? 'mes' : 'meses'}`

export function PermitirPage() {
  const { calc } = useStore()
  const compartida = useCuentas().activa?.tipo === 'compartida'
  const eur = useEur()
  const [texto, setTexto] = useState('')
  const [que, setQue] = useState('')
  const [opcion, setOpcion] = useState<number | 'otro'>(1)
  const [mesesOtro, setMesesOtro] = useState('36')
  const [entradaTxt, setEntradaTxt] = useState('')
  const [taeTxt, setTaeTxt] = useState('')
  const importe = parseImporte(texto)
  const nOtro = Math.round(Number(mesesOtro.replace(',', '.')))
  const plazos = opcion === 'otro' ? (Number.isFinite(nOtro) ? Math.min(MAX_MESES, Math.max(1, nOtro)) : 1) : opcion
  const entrada = parseImporte(entradaTxt) ?? 0
  const taeNum = Number(taeTxt.replace(',', '.').replace('%', '').trim() || '0')
  const tae = Number.isFinite(taeNum) ? Math.min(100, Math.max(0, taeNum)) : 0
  const errorPago =
    opcion === 'otro' && (!Number.isFinite(nOtro) || nOtro < 2 || nOtro > MAX_MESES) ? `Escribe entre 2 y ${MAX_MESES} meses.`
      : taeTxt.trim() && !Number.isFinite(taeNum) ? 'La TAE tiene que ser un número, por ejemplo 7,5.'
        : importe !== null && plazos > 1 && entrada > importe ? 'La entrada no puede ser mayor que el precio.'
          : null
  const valido = importe !== null && importe > 0 && !errorPago
  const s = valido ? simular(calc, importe, plazos, { tae, entrada }) : null
  const campoDerecha = 'num min-w-0 flex-1 bg-transparent text-right text-[17px] text-slate-600 outline-none placeholder:text-slate-300 dark:text-slate-300 dark:placeholder:text-slate-600'
  const sinDatos = calc.meses.length === 0

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-[34px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">¿Me lo puedo permitir?</h1>
      <p className="mb-6 text-[15px] text-slate-500 dark:text-slate-400">
        Escribe lo que cuesta y te digo cómo quedarían tu colchón y tus ahorros{compartida ? ' en esta cuenta' : ''}.
      </p>

      <Grupo>
        <label className="ios-fila block">
          <span className="ios-sep ml-4 flex min-h-[52px] items-center gap-3 pr-4">
            <span className="shrink-0 text-[17px]">Cuesta</span>
            <input
              inputMode="decimal"
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="1.200 €"
              aria-label="Importe"
              className="num min-w-0 flex-1 bg-transparent text-right text-[22px] font-semibold outline-none placeholder:font-normal placeholder:text-slate-300 dark:placeholder:text-slate-600"
            />
          </span>
        </label>
        <label className="ios-fila block">
          <span className="ios-sep ml-4 flex min-h-11 items-center gap-3 pr-4">
            <span className="shrink-0 text-[17px]">Qué es</span>
            <input
              value={que}
              onChange={(e) => setQue(e.target.value)}
              placeholder="Opcional: portátil, sofá…"
              aria-label="Qué es"
              maxLength={60}
              className="min-w-0 flex-1 bg-transparent text-right text-[17px] text-slate-600 outline-none placeholder:text-slate-300 dark:text-slate-300 dark:placeholder:text-slate-600"
            />
          </span>
        </label>
        <div className="ios-fila">
          <div className="ios-sep mx-4 py-2.5">
            <div className="mb-1.5 text-[13px] text-slate-500 dark:text-slate-400">Cómo lo pagarías</div>
            <div role="radiogroup" aria-label="Plazos" className="grid grid-cols-5 rounded-[9px] bg-[#eeeef0] p-0.5 dark:bg-[#2c2c2e]">
              {PLAZOS.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={opcion === p}
                  onClick={() => setOpcion(p)}
                  className={cx('rounded-[7px] py-1.5 text-[13px] font-medium text-slate-900 dark:text-white', opcion === p && 'bg-white shadow-sm dark:bg-[#636366]')}
                >
                  {p === 1 ? '1 pago' : p === 'otro' ? 'Otro' : `${p} meses`}
                </button>
              ))}
            </div>
          </div>
        </div>
        {opcion === 'otro' && (
          <label className="ios-fila block">
            <span className="ios-sep ml-4 flex min-h-11 items-center gap-3 pr-4">
              <span className="shrink-0 text-[17px]">Meses</span>
              <input inputMode="numeric" value={mesesOtro} onChange={(e) => setMesesOtro(e.target.value.replace(/[^\d]/g, ''))} aria-label="Número de meses" placeholder="36" className={campoDerecha} />
              {plazos >= 24 && <span className="shrink-0 text-[15px] text-slate-500 dark:text-slate-400">≈ {(plazos / 12).toLocaleString('es-ES', { maximumFractionDigits: 1 })} años</span>}
            </span>
          </label>
        )}
      </Grupo>

      {plazos > 1 && (
        <Grupo titulo="Financiación" pie={errorPago ?? 'La TAE viene en la oferta del banco o la tienda. Déjala vacía si es sin intereses. La entrada se paga al principio.'}>
          <label className="ios-fila block">
            <span className="ios-sep ml-4 flex min-h-11 items-center gap-3 pr-4">
              <span className="shrink-0 text-[17px]">Entrada</span>
              <input inputMode="decimal" value={entradaTxt} onChange={(e) => setEntradaTxt(e.target.value)} aria-label="Entrada" placeholder="0 €" className={campoDerecha} />
            </span>
          </label>
          <label className="ios-fila block">
            <span className="ios-sep ml-4 flex min-h-11 items-center gap-3 pr-4">
              <span className="shrink-0 text-[17px]">TAE</span>
              <input inputMode="decimal" value={taeTxt} onChange={(e) => setTaeTxt(e.target.value)} aria-label="TAE en porcentaje" placeholder="0 %" className={campoDerecha} />
              {taeTxt.trim() && !taeTxt.includes('%') && <span className="shrink-0 text-[17px] text-slate-500">%</span>}
            </span>
          </label>
        </Grupo>
      )}
      {plazos <= 1 && errorPago && <p className="-mt-6 mb-8 px-4 text-[13px] text-red-600 dark:text-red-400">{errorPago}</p>}

      {sinDatos ? (
        <p className="px-4 text-[15px] text-slate-500 dark:text-slate-400">Cuando tengas algún mes apuntado podré calcularlo con tus datos.</p>
      ) : !s ? (
        <p className="px-4 text-[15px] text-slate-500 dark:text-slate-400">Escribe un importe para ver el resultado.</p>
      ) : (
        <>
          <section className="mb-8 rounded-xl bg-white p-4 dark:bg-[#1c1c1e]" aria-live="polite">
            <div className="flex items-start gap-3">
              <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white', ASPECTO[s.veredicto].color)}>
                <Icono nombre={ASPECTO[s.veredicto].icono} className="h-6 w-6" grosor={2.2} />
              </span>
              <div>
                <h2 className="text-[20px] font-bold leading-tight">{ASPECTO[s.veredicto].titulo}</h2>
                <p className="mt-1 text-[15px] text-slate-600 dark:text-slate-300">
                  {que.trim() ? <>{que.trim()}, {eur(s.importe)}{s.plazos > 1 ? `${s.entrada > 0 ? `: ${eur(s.entrada)} de entrada y` : ' en'} ${s.plazos} cuotas de ${eur(s.cuota)}` : ''}. </> : null}
                  {s.motivo}
                </p>
              </div>
            </div>
          </section>

          <Grupo titulo="Los números">
            {s.plazos > 1 && (
              <>
                <Fila titulo="Cuota al mes" sub={`${s.plazos} meses${s.tae > 0 ? ` al ${s.tae.toLocaleString('es-ES')} % TAE` : ', sin intereses'}`} valor={eur(s.cuota)} />
                {s.entrada > 0 && <Fila titulo="Entrada" valor={eur(s.entrada)} />}
                {s.intereses > 0 && <Fila titulo="Intereses" sub="Lo que pagas de más por financiarlo" valor={eur(s.intereses)} />}
                <Fila titulo="Total que pagarás" valor={eur(s.totalPagado)} />
              </>
            )}
            {s.colchonAntes !== null && s.colchonDespues !== null && (
              <Fila
                titulo="Colchón de emergencia"
                sub={s.plazos > 1 && s.entrada === 0 ? 'A plazos sin entrada no baja' : `Ahora tienes ${meses(s.colchonAntes)}`}
                valor={meses(s.colchonDespues)}
              />
            )}
            <Fila
              titulo="Lo que ahorras al mes"
              sub={`Media de los últimos ${s.mesesUsados} ${s.mesesUsados === 1 ? 'mes' : 'meses'}`}
              valor={eur(s.ahorroMedio, { dash: false })}
            />
            {s.mesesDeAhorro !== null && <Fila titulo="Meses de ahorro" sub="Lo que pagarás en total, en meses de tu ahorro" valor={meses(s.mesesDeAhorro)} />}
            {s.pctPatrimonio !== null && (
              <Fila titulo="De tu patrimonio" valor={`${(s.pctPatrimonio * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`} />
            )}
            <Fila titulo="Disponible ahora" sub="Saldo + cuenta remunerada" valor={eur(s.liquido, { dash: false })} />
          </Grupo>
          <p className="-mt-6 mb-8 px-4 text-[13px] leading-snug text-slate-500 dark:text-slate-400">
            Es una orientación con tus medias de los últimos meses, no un consejo financiero. Las inversiones no cuentan como dinero disponible.
          </p>
        </>
      )}
    </div>
  )
}
