import { useMemo, useState, type FormEvent } from 'react'
import { useStore } from '../data/store'
import { Boton, Card, CeldaFecha, CeldaImporte, CeldaTexto, Dinero, Kpi, cx } from '../components/ui'
import { parseImporte } from '../lib/money'
import { useEur } from '../lib/discreto'
import { formatFecha, hoyISO } from '../lib/fechas'
import { uid } from '../lib/operaciones'
import type { Deuda } from '../lib/tipos'

/** Dinero que te deben: no entra en los meses ni en el dinero total. */
export function TeDebenPage() {
  const { datos, actualizar, borrar, insertar, avisar } = useStore()
  const eur = useEur()
  const pendientes = datos.debts.filter((x) => !x.devuelto_en)
  const devueltas = datos.debts.filter((x) => x.devuelto_en).sort((a, b) => (b.devuelto_en ?? '').localeCompare(a.devuelto_en ?? ''))
  const total = pendientes.reduce((a, x) => a + x.importe, 0)

  // Pendientes agrupados por persona (la que más debe primero)
  const grupos = useMemo(() => {
    const m = new Map<string, Deuda[]>()
    for (const x of pendientes) {
      const k = x.persona.trim().toLowerCase()
      m.set(k, [...(m.get(k) ?? []), x])
    }
    return [...m.values()]
      .map((filas) => ({ persona: filas[0].persona.trim() || 'Sin nombre', filas: filas.sort((a, b) => a.fecha.localeCompare(b.fecha)), total: filas.reduce((a, x) => a + x.importe, 0) }))
      .sort((a, b) => b.total - a.total)
  }, [pendientes])

  function devolver(filas: Deuda[]) {
    const hoy = hoyISO()
    for (const x of filas) actualizar('debts', x.id, { devuelto_en: hoy })
    const suma = filas.reduce((a, x) => a + x.importe, 0)
    avisar({
      texto: `Marcado como devuelto: ${eur(suma, { dash: false })}`,
      accion: { texto: 'Deshacer', fn: () => filas.forEach((x) => actualizar('debts', x.id, { devuelto_en: null })) },
    })
  }

  function quitar(x: Deuda) {
    borrar('debts', x.id)
    avisar({ texto: `Borrado: ${x.persona || 'Sin nombre'} · ${eur(x.importe, { dash: false })}`, accion: { texto: 'Deshacer', fn: () => insertar('debts', x) } })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-marino dark:text-sky-300">Te deben</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Te deben en total" valor={total} grande />
        <Kpi titulo="Personas" valor={String(grupos.length)} grande />
      </div>

      <NuevaDeuda />

      {grupos.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-300">Nadie te debe nada. 🎉</p>
        </Card>
      ) : (
        grupos.map((g) => (
          <Card
            key={g.persona}
            titulo={<>{g.persona} · <Dinero c={g.total} dash={false} /></>}
            accion={<Boton variante="secundario" className="text-xs" onClick={() => devolver(g.filas)}>✓ {g.filas.length > 1 ? 'Todo devuelto' : 'Devuelto'}</Boton>}
          >
            <div className="hidden grid-cols-[1fr_1fr_8.5rem_8rem_5.5rem] gap-x-1 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid">
              <span>Persona</span><span>Concepto</span><span>Fecha</span><span className="text-right">Importe</span><span />
            </div>
            {g.filas.map((x) => (
              <div key={x.id} className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-x-1 border-b border-slate-100 py-1 dark:border-slate-800 sm:grid-cols-[1fr_1fr_8.5rem_8rem_5.5rem] sm:py-0">
                <CeldaTexto ariaLabel="Persona" valor={x.persona} onCambio={(v) => actualizar('debts', x.id, { persona: v })} className="font-medium sm:font-normal" />
                <CeldaImporte ariaLabel={`Importe que te debe ${x.persona}`} valor={x.importe} onCambio={(v) => actualizar('debts', x.id, { importe: v ?? 0 })} className="sm:order-4" />
                <CeldaTexto ariaLabel="Concepto" valor={x.concepto} placeholder="Concepto" onCambio={(v) => actualizar('debts', x.id, { concepto: v })} className="text-sm text-slate-600 dark:text-slate-300 sm:order-2 sm:text-base sm:text-inherit" />
                <div className="flex items-center justify-end gap-1 sm:order-5">
                  <button type="button" title="Marcar como devuelto" aria-label={`Marcar como devuelto: ${x.concepto || x.persona}`} onClick={() => devolver([x])} className="flex h-8 w-8 items-center justify-center rounded-md text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40">✓</button>
                  <button type="button" title="Borrar" aria-label={`Borrar: ${x.concepto || x.persona}`} onClick={() => quitar(x)} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40">✕</button>
                </div>
                <div className="col-span-2 sm:order-3 sm:col-span-1">
                  <CeldaFecha ariaLabel="Fecha" valor={x.fecha} onCambio={(v) => v && actualizar('debts', x.id, { fecha: v })} />
                </div>
              </div>
            ))}
            <p className="mt-2 text-xs text-slate-500">¿Te ha devuelto solo una parte? Cambia el importe por lo que queda.</p>
          </Card>
        ))
      )}

      {devueltas.length > 0 && (
        <Card className="p-0 sm:p-0">
          <details>
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold uppercase tracking-wide text-marino dark:text-sky-300 sm:px-5">
              Ya devuelto ({devueltas.length})
            </summary>
            <ul className="divide-y divide-slate-100 px-4 pb-3 dark:divide-slate-800 sm:px-5">
              {devueltas.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{x.persona || 'Sin nombre'}</span>
                    {x.concepto && <span className="text-slate-500"> · {x.concepto}</span>}
                    <span className="block text-xs text-slate-500">Devuelto el {formatFecha(x.devuelto_en)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Dinero c={x.importe} dash={false} className="text-slate-500" />
                    <button type="button" className="text-xs text-sky-700 hover:underline dark:text-sky-400" onClick={() => actualizar('debts', x.id, { devuelto_en: null })}>Pendiente</button>
                    <button type="button" aria-label={`Borrar: ${x.concepto || x.persona}`} title="Borrar" className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" onClick={() => quitar(x)}>✕</button>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </Card>
      )}

      <p className="text-xs italic text-slate-500">Lo que te deben no se suma al dinero total ni a los gastos del mes: es solo para que no se te olvide.</p>
    </div>
  )
}

function NuevaDeuda() {
  const { datos, insertar, avisar } = useStore()
  const eur = useEur()
  const [persona, setPersona] = useState('')
  const [concepto, setConcepto] = useState('')
  const [importe, setImporte] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [error, setError] = useState<string | null>(null)
  const personas = [...new Set(datos.debts.map((x) => x.persona.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))

  function guardar(e: FormEvent) {
    e.preventDefault()
    const c = parseImporte(importe)
    if (!persona.trim()) return setError('Escribe quién te lo debe.')
    if (c === null || c <= 0) return setError('Escribe un importe mayor que 0.')
    const fila: Deuda = { id: uid(), persona: persona.trim(), concepto: concepto.trim(), importe: c, fecha: fecha || hoyISO(), devuelto_en: null }
    insertar('debts', fila)
    avisar({ texto: `Apuntado: ${fila.persona} te debe ${eur(c, { dash: false })}` })
    setConcepto('')
    setImporte('')
    setError(null)
  }

  return (
    <Card titulo="Apuntar">
      <form onSubmit={guardar} className="grid gap-3 sm:grid-cols-[1fr_1.4fr_9rem_10rem_auto] sm:items-end">
        <label className="block text-sm">
          Quién
          <input className="campo mt-1" list="personas-deuda" placeholder="Juan" value={persona} onChange={(e) => setPersona(e.target.value)} />
          <datalist id="personas-deuda">
            {personas.map((p) => <option key={p} value={p} />)}
          </datalist>
        </label>
        <label className="block text-sm">
          Concepto
          <input className="campo mt-1" placeholder="Cena del viernes" value={concepto} onChange={(e) => setConcepto(e.target.value)} />
        </label>
        <label className="block text-sm">
          Importe
          <input className={cx('campo num mt-1 text-right', error?.includes('importe') && 'border-red-500')} inputMode="decimal" placeholder="0,00 €" value={importe} onChange={(e) => setImporte(e.target.value)} />
        </label>
        <label className="block text-sm">
          Fecha
          <input className="campo mt-1" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <Boton type="submit" variante="primario">＋ Apuntar</Boton>
      </form>
      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
    </Card>
  )
}
