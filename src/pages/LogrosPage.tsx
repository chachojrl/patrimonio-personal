// Rachas y logros: se calculan con tus meses; no se guarda nada.
import { useStore } from '../data/store'
import { Card, cx } from '../components/ui'
import { logros, rachas, type Logro } from '../lib/logros'
import { formatFecha, mesLargo } from '../lib/fechas'

const fechaLogro = (f: string) => (f.endsWith('-01') && f.length === 10 ? mesLargo(f) : formatFecha(f))

export function LogrosPage() {
  const { datos, calc } = useStore()
  const rs = rachas(calc, datos)
  const ls = logros(calc, datos)
  const conseguidos = ls.filter((l) => l.conseguido).sort((a, b) => b.conseguido!.localeCompare(a.conseguido!))
  const pendientes = ls.filter((l) => !l.conseguido).sort((a, b) => b.progreso - a.progreso)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[34px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Logros</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tus rachas y lo que has ido consiguiendo. Se calculan solos con tus meses: {conseguidos.length} de {ls.length} logros.
        </p>
      </div>

      <section aria-labelledby="titulo-rachas">
        <h2 id="titulo-rachas" className="mb-1.5 px-1 text-[13px] text-slate-500 dark:text-slate-400">Rachas</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {rs.map((r) => (
            <div key={r.id} className="rounded-xl bg-white p-3.5 dark:bg-[#1c1c1e] sm:p-4" title={r.explicacion}>
              <div className="flex min-h-[2.25rem] items-start gap-1.5 text-[13px] leading-tight text-slate-500 dark:text-slate-400">
                <span aria-hidden className={cx(r.actual === 0 && 'grayscale')}>{r.icono}</span>
                <span>{r.titulo}</span>
              </div>
              <div className="mt-0.5 text-[26px] font-bold tracking-tight">
                {r.actual} <span className="text-[15px] font-medium text-slate-500">{r.actual === 1 ? 'mes' : 'meses'}</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Mejor racha: {r.mejor}</div>
            </div>
          ))}
        </div>
        <p className="mt-1.5 px-1 text-xs text-slate-500">El mes en curso suma cuando lo cumples; mientras tanto no rompe la racha.</p>
      </section>

      {conseguidos.length > 0 && (
        <Card titulo={`Conseguidos · ${conseguidos.length}`}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {conseguidos.map((l) => <FilaLogro key={l.id} l={l} />)}
          </ul>
        </Card>
      )}

      <Card titulo="Por conseguir">
        {pendientes.length === 0 ? (
          <p className="text-sm text-slate-500">¡Los tienes todos!</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {pendientes.map((l) => <FilaLogro key={l.id} l={l} />)}
          </ul>
        )}
      </Card>
    </div>
  )
}

function FilaLogro({ l }: { l: Logro }) {
  const si = !!l.conseguido
  return (
    <li className={cx('flex items-center gap-3 rounded-lg p-2.5', si ? 'bg-amber-50 dark:bg-amber-400/10' : 'bg-slate-50 dark:bg-white/5')}>
      <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl', si ? 'bg-white shadow-sm dark:bg-white/10' : 'bg-slate-200 opacity-60 grayscale dark:bg-white/10')} aria-hidden>
        {l.icono}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">{l.titulo}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{si ? `Conseguido en ${fechaLogro(l.conseguido!)}` : l.descripcion}</div>
        {!si && (
          <>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="meter" aria-label={`Progreso de ${l.titulo}`} aria-valuenow={Math.round(l.progreso * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.round(l.progreso * 100)}%` }} />
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">{l.textoProgreso}</div>
          </>
        )}
      </div>
    </li>
  )
}
