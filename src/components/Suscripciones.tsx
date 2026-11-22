// Detector de suscripciones: lo que pagas cada mes en servicios que se repiten.
import { useStore } from '../data/store'
import { Card, Dinero } from './ui'
import { useEur } from '../lib/discreto'
import { detectarSuscripciones, resumenSuscripciones, type Suscripcion } from '../lib/suscripciones'
import { mesLargo } from '../lib/fechas'

const MOTIVO: Record<Suscripcion['motivo'], string> = {
  nombre: 'Servicio conocido',
  fijo: 'Gasto fijo pequeño',
  repetido: 'Se repite cada mes',
}

export function Suscripciones() {
  const { datos, actualizarConfig, avisar } = useStore()
  const eur = useEur()
  const lista = detectarSuscripciones(datos)
  if (lista.length === 0) return null
  const r = resumenSuscripciones(lista)
  const inactivas = lista.filter((s) => !s.activa)
  const noEs = (s: Suscripcion) => {
    actualizarConfig({ no_suscripciones: [...(datos.config.no_suscripciones ?? []), s.clave] })
    avisar({
      texto: `«${s.nombre}» ya no sale como suscripción.`,
      accion: { texto: 'Deshacer', fn: () => actualizarConfig({ no_suscripciones: (datos.config.no_suscripciones ?? []).filter((x) => x !== s.clave) }) },
    })
  }

  return (
    <Card titulo="Suscripciones">
      {r.activas.length > 0 ? (
        <p className="text-[15px]">
          Pagas <strong className="text-[22px] font-bold tracking-tight"><Dinero c={r.alMes} dash={false} /></strong> al mes en {r.activas.length}{' '}
          {r.activas.length === 1 ? 'suscripción' : 'suscripciones'}: <strong>{eur(r.alAnio, { dash: false })} al año</strong>.
        </p>
      ) : (
        <p className="text-sm text-slate-500">Ahora mismo no pagas ninguna suscripción que se detecte.</p>
      )}
      <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
        {r.activas.map((s) => <Fila key={s.clave} s={s} onNoEs={() => noEs(s)} />)}
      </ul>
      {inactivas.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-slate-500">Ya no las pagas · {inactivas.length}</summary>
          <ul className="mt-1 divide-y divide-slate-100 dark:divide-white/10">
            {inactivas.map((s) => <Fila key={s.clave} s={s} onNoEs={() => noEs(s)} />)}
          </ul>
        </details>
      )}
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Se detectan solas: servicios conocidos (Netflix, Spotify, el gimnasio…) en los conceptos y en las notas, gastos fijos pequeños y gastos de menos de 100 € que se repiten 3 meses seguidos con casi el mismo importe. Si alguna no lo es, quítala.
      </p>
    </Card>
  )
}

function Fila({ s, onNoEs }: { s: Suscripcion; onNoEs: () => void }) {
  const eur = useEur()
  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate font-medium">{s.nombre}</span>
        <span className="shrink-0 text-sm"><Dinero c={s.importeMes} dash={false} /> <span className="text-slate-500">/ mes</span></span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span>{MOTIVO[s.motivo]} · {s.meses} {s.meses === 1 ? 'mes' : 'meses'} · {eur(s.anual, { dash: false })} al año</span>
        {!s.activa && <span>· la última, en {mesLargo(s.ultimoMes)}</span>}
        {s.subida && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
            Subió en {mesLargo(s.subida.mes)}: {eur(s.subida.de, { dash: false })} → {eur(s.subida.a, { dash: false })}
          </span>
        )}
        <button type="button" className="ml-auto text-[#007AFF] dark:text-[#0A84FF]" onClick={onNoEs} aria-label={`${s.nombre} no es una suscripción`}>No es una suscripción</button>
      </div>
    </li>
  )
}
