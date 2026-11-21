import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import { nombreMiembro, useCuentas } from '../data/cuentas'
import { Card, cx } from '../components/ui'
import { describir, enSegundaPersona, etiquetaDia, limpiar, type Cambio } from '../lib/actividad'
import { useEur } from '../lib/discreto'

/** Carga el historial y lo vuelve a leer cuando cambian los datos (también por cambios en tiempo real). */
export function useActividad(limite = 300): Cambio[] | null | undefined {
  const { repo, datos } = useStore()
  const [cambios, setCambios] = useState<Cambio[] | null | undefined>(undefined)
  useEffect(() => {
    if (!repo.leerCambios) {
      setCambios(null)
      return
    }
    const t = setTimeout(() => {
      repo.leerCambios!(limite).then((c) => setCambios(c ? limpiar(c) : null), () => undefined)
    }, cambios === undefined ? 0 : 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, datos, limite])
  return cambios
}

/** Nombre de quien hizo el cambio («Tú» si fuiste tú). */
function useQuien() {
  const { activa, userId } = useCuentas()
  return (uid: string | null) => {
    if (!uid) return 'Alguien'
    if (uid === userId) return 'Tú'
    const m = activa?.miembros.find((x) => x.user_id === uid)
    return m ? nombreMiembro(m) : 'Alguien que ya no es miembro'
  }
}

export function LineaCambio({ c, compacta }: { c: Cambio; compacta?: boolean }) {
  const eur = useEur()
  const quien = useQuien()
  const { userId } = useCuentas()
  const nombre = quien(c.user_id)
  const yo = c.user_id === userId
  const hora = new Date(c.creado_en).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return (
    <li className={cx('flex items-start gap-3', compacta ? 'py-1.5' : 'py-2.5')}>
      <span
        aria-hidden
        className={cx(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          yo ? 'bg-marino/10 text-marino dark:bg-sky-900/50 dark:text-sky-300' : 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300',
        )}
      >
        {nombre.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 text-sm">
        <strong>{nombre}</strong> {(yo ? enSegundaPersona : (f: string) => f)(describir(c, (x) => eur(x, { dash: false })))}
      </span>
      <span className="shrink-0 text-xs text-slate-500">{compacta ? etiquetaCorta(c.creado_en) : hora}</span>
    </li>
  )
}

function etiquetaCorta(iso: string) {
  const d = etiquetaDia(iso)
  const hora = new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return d === 'Hoy' ? hora : d === 'Ayer' ? `ayer ${hora}` : new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export function ActividadPage() {
  const cambios = useActividad()
  const { activa, userId } = useCuentas()
  const [quien, setQuien] = useState<string | 'todos'>('todos')
  const compartida = activa?.tipo === 'compartida'
  const filtrados = useMemo(() => (cambios ?? []).filter((c) => quien === 'todos' || c.user_id === quien), [cambios, quien])
  const porDia = useMemo(() => {
    const g: { dia: string; items: Cambio[] }[] = []
    for (const c of filtrados) {
      const dia = etiquetaDia(c.creado_en)
      if (g.at(-1)?.dia !== dia) g.push({ dia, items: [] })
      g.at(-1)!.items.push(c)
    }
    return g
  }, [filtrados])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[34px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Actividad</h1>
        <p className="text-sm text-slate-500">
          {compartida ? 'Quién ha cambiado qué en esta cuenta compartida.' : 'Lo que has cambiado en tu cuenta.'} Se guarda un año.
        </p>
      </div>

      {compartida && activa && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por persona">
          {[{ id: 'todos', txt: 'Todos' }, ...activa.miembros.filter((m) => m.user_id).map((m) => ({ id: m.user_id!, txt: m.user_id === userId ? 'Tú' : nombreMiembro(m) }))].map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={quien === o.id}
              onClick={() => setQuien(o.id)}
              className={cx('rounded-full border px-3 py-1 text-sm', quien === o.id ? 'border-marino bg-marino text-white dark:border-sky-700 dark:bg-sky-800' : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800')}
            >
              {o.txt}
            </button>
          ))}
        </div>
      )}

      {cambios === undefined ? (
        <Card><p className="text-sm text-slate-500">Cargando…</p></Card>
      ) : cambios === null ? (
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            El historial necesita Supabase y la migración <code>0009_historial_compra_viajes.sql</code>.
          </p>
        </Card>
      ) : porDia.length === 0 ? (
        <Card><p className="text-sm text-slate-500">Todavía no hay cambios apuntados. A partir de ahora, cada cambio aparecerá aquí.</p></Card>
      ) : (
        porDia.map((g) => (
          <Card key={g.dia} titulo={g.dia}>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {g.items.map((c) => <LineaCambio key={c.id} c={c} />)}
            </ul>
          </Card>
        ))
      )}
    </div>
  )
}

/** Tarjeta para Inicio (cuenta compartida): los últimos cambios. */
export function UltimosCambios() {
  const cambios = useActividad(30)
  if (!cambios || cambios.length === 0) return null
  return (
    <Card titulo="Últimos cambios" accion={<Link to="/actividad" className="text-xs text-sky-700 hover:underline dark:text-sky-400">Ver todo →</Link>}>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {cambios.slice(0, 5).map((c) => <LineaCambio key={c.id} c={c} compacta />)}
      </ul>
    </Card>
  )
}
