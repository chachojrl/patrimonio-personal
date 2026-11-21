// «¿Me lo puedo permitir?»: escribes un importe y te dice cómo quedarían tu colchón y tus ahorros.
import { useState } from 'react'
import { useStore } from '../data/store'
import { useCuentas } from '../data/cuentas'
import { simular, type Veredicto } from '../lib/permitir'
import { parseImporte } from '../lib/money'
import { useEur } from '../lib/discreto'
import { Fila, Grupo, Icono, type NombreIcono } from '../components/ios'
import { cx } from '../components/ui'

const PLAZOS = [1, 3, 6, 12, 24]

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
  const [plazos, setPlazos] = useState(1)
  const importe = parseImporte(texto)
  const valido = importe !== null && importe > 0
  const s = valido ? simular(calc, importe, plazos) : null
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
                  aria-checked={plazos === p}
                  onClick={() => setPlazos(p)}
                  className={cx('rounded-[7px] py-1.5 text-[13px] font-medium text-slate-900 dark:text-white', plazos === p && 'bg-white shadow-sm dark:bg-[#636366]')}
                >
                  {p === 1 ? '1 pago' : `${p} meses`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Grupo>

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
                  {que.trim() ? <>{que.trim()}, {eur(s.importe)}{s.plazos > 1 ? ` en ${s.plazos} cuotas de ${eur(s.cuota)}` : ''}. </> : null}
                  {s.motivo}
                </p>
              </div>
            </div>
          </section>

          <Grupo titulo="Los números">
            {s.plazos > 1 && <Fila titulo="Cuota al mes" valor={eur(s.cuota)} />}
            {s.colchonAntes !== null && s.colchonDespues !== null && (
              <Fila
                titulo="Colchón de emergencia"
                sub={s.plazos > 1 ? 'A plazos no baja de golpe' : `Ahora tienes ${meses(s.colchonAntes)}`}
                valor={s.plazos > 1 ? meses(s.colchonAntes) : `${meses(s.colchonDespues)}`}
              />
            )}
            <Fila
              titulo="Lo que ahorras al mes"
              sub={`Media de los últimos ${s.mesesUsados} ${s.mesesUsados === 1 ? 'mes' : 'meses'}`}
              valor={eur(s.ahorroMedio, { dash: false })}
            />
            {s.mesesDeAhorro !== null && <Fila titulo="Meses de ahorro que supone" valor={meses(s.mesesDeAhorro)} />}
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
