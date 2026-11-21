import { useStore } from '../data/store'
import { colchon } from '../lib/analisis'
import { Dinero, Info, cx } from './ui'

const TEXTO = {
  bajo: 'Menos de 3 meses: conviene reforzarlo antes que invertir más.',
  medio: 'Entre 3 y 6 meses: vas bien; lo recomendable es llegar a 6.',
  bueno: '6 meses o más: tienes un buen colchón.',
}

/** Colchón de emergencia: cuántos meses podrías vivir sin ingresos con lo que tienes disponible. */
export function ColchonCard({ compacta }: { compacta?: boolean }) {
  const { calc } = useStore()
  const r = colchon(calc)
  if (r.meses === null || !r.nivel) return null
  const color = r.nivel === 'bajo' ? 'bg-red-500' : r.nivel === 'medio' ? 'bg-amber-500' : 'bg-emerald-500'
  const meses = r.meses.toLocaleString('es-ES', { maximumFractionDigits: 1 })
  return (
    <div className="rounded-xl bg-white p-3.5 dark:bg-[#1c1c1e] sm:p-4">
      <div className="text-[13px] text-slate-500 dark:text-slate-400">
        Colchón de emergencia
        <Info texto={`Saldo disponible + cuenta remunerada, entre lo que gastas de media al mes (últimos ${r.mesesUsados} meses). Las inversiones no cuentan porque no son dinero inmediato.`} />
      </div>
      <div className={cx('mt-0.5 font-bold tracking-tight', compacta ? 'text-[22px]' : 'text-xl sm:text-2xl')}>
        {meses} {r.meses >= 0.95 && r.meses < 1.05 ? 'mes' : 'meses'}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="meter" aria-label="Meses de colchón sobre 12" aria-valuenow={Math.round(r.meses * 10) / 10} aria-valuemin={0} aria-valuemax={12}>
        <div className={cx('h-full rounded-full', color)} style={{ width: `${Math.min(100, (r.meses / 12) * 100)}%` }} />
      </div>
      {compacta ? (
        <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Objetivo: 6 meses</div>
      ) : (
        <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Dinero c={r.liquido} dash={false} /> disponibles · gastas <Dinero c={r.gastoMedio} dash={false} /> al mes. {TEXTO[r.nivel]}
        </div>
      )}
    </div>
  )
}
