import { useStore } from '../data/store'
import { nombreMiembro, useCuentas } from '../data/cuentas'
import { repartoCompartida } from '../lib/analisis'
import { Card, Dinero, Info } from './ui'

/** Cuenta compartida: lo que pone cada uno además de su aportación (gastos a medias o de uno solo). */
export function RepartoCompartidaCard({ monthId }: { monthId: string }) {
  const { datos } = useStore()
  const { activa, userId } = useCuentas()
  if (activa?.tipo !== 'compartida') return null
  const miembros = activa.miembros.filter((m) => m.user_id)
  if (miembros.length < 2) return null
  const r = repartoCompartida(datos, monthId, miembros.map((m) => m.user_id!))
  if (r.aMedias === 0 && r.propios === 0) return null
  const nombre = (uid: string) => {
    const m = miembros.find((x) => x.user_id === uid)!
    return m.user_id === userId ? 'Tú' : nombreMiembro(m)
  }
  return (
    <Card titulo={<>Reparto del mes <Info texto="Los gastos proporcionales los cubren las aportaciones automáticas. Los gastos «a medias» o que paga uno solo los pone cada uno aparte: esto es lo que le toca a cada uno además de su aportación." /></>}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="py-1 font-semibold" />
              <th className="py-1 text-right font-semibold">Aportación</th>
              <th className="py-1 text-right font-semibold">A medias</th>
              <th className="py-1 text-right font-semibold">Solo suyo</th>
              <th className="py-1 text-right font-semibold">Además pone</th>
            </tr>
          </thead>
          <tbody>
            {r.miembros.map((m) => (
              <tr key={m.user_id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1.5 font-medium">{nombre(m.user_id)}</td>
                <td className="py-1.5 text-right"><Dinero c={m.aportacion} /></td>
                <td className="py-1.5 text-right"><Dinero c={m.aMedias} /></td>
                <td className="py-1.5 text-right"><Dinero c={m.propios} /></td>
                <td className="py-1.5 text-right font-semibold"><Dinero c={m.extra} dash={false} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {r.miembros.map((m, i) => (
          <span key={m.user_id}>{i > 0 && ' · '}{nombre(m.user_id)} {m.user_id === userId ? 'pones' : 'pone'} <Dinero c={m.extra} dash={false} /> en la cuenta común además de la aportación</span>
        ))}
        .
      </p>
    </Card>
  )
}
