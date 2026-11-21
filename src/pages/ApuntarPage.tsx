import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { useCuentas } from '../data/cuentas'
import { Boton, Card } from '../components/ui'
import { anadirGasto, deshacerApunte, mesesOrdenados, separarImporteNota } from '../lib/operaciones'
import { normalizar } from '../lib/buscar'
import { useEur } from '../lib/discreto'
import { nombreMes } from '../lib/fechas'
import type { Gasto } from '../lib/tipos'

/**
 * Apuntar un gasto desde un enlace (Atajos de iOS, Siri, un marcador…):
 *   #/apuntar?gasto=Supermercado&importe=12,50&nota=Mercadona[&cuenta=compartida]
 * Siempre pide confirmar con un toque: un enlace nunca apunta nada por sí solo.
 */
export function ApuntarPage() {
  // Cada enlace distinto empieza de cero (si ya estabas en esta pantalla, no arrastra el resultado anterior)
  const { search } = useLocation()
  return <Apuntar key={search} />
}

function Apuntar() {
  const [params] = useSearchParams()
  const { datos, aplicar, actualizar, repo, obtener } = useStore()
  const { cuentas, activa, cambiar } = useCuentas()
  const eur = useEur()

  // ¿En qué cuenta? (opcional: cuenta=personal | compartida)
  const quiere = params.get('cuenta')
  useEffect(() => {
    if (!cuentas || !activa || !quiere) return
    const destino = cuentas.find((c) => c.tipo === (quiere === 'compartida' ? 'compartida' : 'personal'))
    if (destino && destino.id !== activa.id) cambiar(destino.id)
  }, [cuentas, activa, quiere, cambiar])

  const mes = mesesOrdenados(datos).filter((m) => m.estado === 'Abierto').at(-1)
  const gastos = mes ? datos.expenses.filter((g) => g.month_id === mes.id && !g.aportacion_cuenta).sort((a, b) => a.orden - b.orden) : []
  const buscado = normalizar(params.get('gasto') ?? '')
  const encontrado = useMemo(
    () => (buscado ? gastos.find((g) => normalizar(g.concepto) === buscado) ?? gastos.find((g) => normalizar(g.concepto).includes(buscado)) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buscado, mes?.id, gastos.length],
  )
  const inicial = separarImporteNota(`${params.get('importe') ?? ''} ${params.get('nota') ?? ''}`)
  const [gastoId, setGastoId] = useState(encontrado?.id ?? '')
  const [texto, setTexto] = useState(inicial.importe ? `${(inicial.importe / 100).toFixed(2).replace('.', ',')}${inicial.nota ? ` ${inicial.nota}` : ''}` : '')
  const [hecho, setHecho] = useState<{ apunteId: string; gasto: Gasto; importe: number; deshecho: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!gastoId && encontrado) setGastoId(encontrado.id)
  }, [encontrado, gastoId])

  if (!mes) {
    return (
      <Card titulo="Apuntar gasto">
        <p className="text-sm text-slate-600 dark:text-slate-300">No hay ningún mes abierto. <Link to="/" className="text-sky-700 underline dark:text-sky-400">Crea el mes</Link> y vuelve a intentarlo.</p>
      </Card>
    )
  }

  function apuntar() {
    const { importe, nota } = separarImporteNota(texto)
    const g = gastos.find((x) => x.id === gastoId)
    if (!g) return setError('Elige a qué gasto sumarlo.')
    if (importe === null || importe <= 0) return setError('Escribe el importe (y, si quieres, una nota detrás).')
    const r = anadirGasto(obtener(), g.id, importe, undefined, nota)
    aplicar(r.datos, [() => repo.insertar('expense_entries', [r.apunte])], mes!.id)
    actualizar('expenses', g.id, { importe: r.gasto.importe })
    setHecho({ apunteId: r.apunte.id, gasto: g, importe, deshecho: false })
    setError(null)
  }

  function deshacer() {
    if (!hecho) return
    const r = deshacerApunte(obtener(), hecho.apunteId)
    if (!r.gasto) return
    aplicar(r.datos, [() => repo.borrar('expense_entries', [hecho.apunteId])], mes!.id)
    actualizar('expenses', r.gasto.id, { importe: r.gasto.importe })
    setHecho({ ...hecho, deshecho: true })
  }

  if (hecho) {
    return (
      <Card titulo={hecho.deshecho ? 'Deshecho' : 'Apuntado'}>
        <p className="text-lg">
          {hecho.deshecho ? 'No se ha apuntado nada.' : <>{eur(hecho.importe, { dash: false })} en <strong>{hecho.gasto.concepto}</strong> ({nombreMes(mes.fecha)}).</>}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {!hecho.deshecho && <Boton onClick={deshacer}>Deshacer</Boton>}
          <Link to={`/mes/${mes.fecha.slice(0, 7)}`} className="inline-flex items-center rounded-lg bg-marino px-3 py-2 text-sm font-medium text-white dark:bg-sky-700">Ver el mes</Link>
        </div>
      </Card>
    )
  }

  return (
    <Card titulo={`Apuntar gasto · ${nombreMes(mes.fecha)}${activa?.tipo === 'compartida' ? ` · ${activa.nombre}` : ''}`}>
      <div className="space-y-3">
        <label className="block text-sm">
          Gasto
          <select className="campo mt-1 text-base" value={gastoId} onChange={(e) => setGastoId(e.target.value)}>
            <option value="" disabled>Elige…</option>
            {gastos.map((g) => <option key={g.id} value={g.id}>{g.concepto}</option>)}
          </select>
        </label>
        {buscado && !encontrado && <p className="text-xs text-amber-700 dark:text-amber-400">No hay ningún gasto «{params.get('gasto')}» este mes: elige uno de la lista.</p>}
        <label className="block text-sm">
          Importe (y nota opcional)
          <input className="campo num mt-1 text-base" inputMode="decimal" placeholder="12,50 Mercadona" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && apuntar()} autoFocus={!inicial.importe} />
        </label>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <Boton variante="primario" className="w-full py-3 text-base" onClick={apuntar} autoFocus={!!inicial.importe}>Apuntar</Boton>
      </div>
    </Card>
  )
}
