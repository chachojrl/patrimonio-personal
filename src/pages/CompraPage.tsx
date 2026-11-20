import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import { useCuentas } from '../data/cuentas'
import { Boton, Card, CeldaTexto, cx } from '../components/ui'
import { anadirGasto, mesesOrdenados, uid } from '../lib/operaciones'
import { parseImporte } from '../lib/money'
import { useEur } from '../lib/discreto'
import { nombreMes } from '../lib/fechas'
import type { ArticuloCompra } from '../lib/tipos'

/** Lista de la compra: en la cuenta compartida la veis los dos y se actualiza al momento. */
export function CompraPage() {
  const { datos, insertar, actualizar, borrar, avisar } = useStore()
  const compartida = useCuentas().activa?.tipo === 'compartida'
  const [texto, setTexto] = useState('')
  const lista = useMemo(() => [...datos.lista_compra].sort((a, b) => a.orden - b.orden || a.creado_en.localeCompare(b.creado_en)), [datos.lista_compra])
  const pendientes = lista.filter((x) => !x.hecho)
  const enCarro = lista.filter((x) => x.hecho)

  function anadir(e: FormEvent) {
    e.preventDefault()
    // Varias cosas a la vez separadas por comas: «leche, pan, huevos»
    const nuevos = texto.split(',').map((t) => t.trim()).filter(Boolean)
    if (nuevos.length === 0) return
    let orden = Math.max(0, ...lista.map((x) => x.orden)) + 1
    for (const t of nuevos) {
      insertar('lista_compra', { id: uid(), texto: t, hecho: false, orden: orden++, creado_en: new Date().toISOString() } satisfies ArticuloCompra)
    }
    setTexto('')
  }

  function vaciarCarro() {
    const quitados = [...enCarro]
    for (const x of quitados) borrar('lista_compra', x.id)
    avisar({ texto: `Quitados ${quitados.length} de la lista.`, accion: { texto: 'Deshacer', fn: () => quitados.forEach((x) => insertar('lista_compra', x)) } })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-marino dark:text-sky-300">Lista de la compra</h1>
        <p className="text-sm text-slate-500">
          {compartida ? 'La veis los dos y se actualiza al momento en los dos móviles.' : 'Solo la ves tú. En la cuenta compartida tenéis una lista común.'}
        </p>
      </div>

      <Card>
        <form onSubmit={anadir} className="flex gap-2">
          <label htmlFor="nuevo-articulo" className="sr-only">Añadir a la lista</label>
          <input
            id="nuevo-articulo"
            className="campo flex-1 text-base"
            placeholder="Leche, pan, huevos…"
            autoComplete="off"
            enterKeyHint="done"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <Boton type="submit" variante="primario" disabled={!texto.trim()}>＋ Añadir</Boton>
        </form>
        <p className="mt-2 text-xs text-slate-500">Puedes añadir varias cosas a la vez separándolas por comas.</p>
      </Card>

      <Card titulo={`Por comprar (${pendientes.length})`}>
        {pendientes.length === 0 ? (
          <p className="text-sm text-slate-500">{enCarro.length ? '¡Todo en el carro! 🛒' : 'La lista está vacía.'}</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {pendientes.map((x) => <Articulo key={x.id} a={x} onMarcar={(v) => actualizar('lista_compra', x.id, { hecho: v })} onTexto={(v) => actualizar('lista_compra', x.id, { texto: v })} onBorrar={() => borrar('lista_compra', x.id)} />)}
          </ul>
        )}
      </Card>

      {enCarro.length > 0 && (
        <>
          <Card titulo={`En el carro (${enCarro.length})`} accion={<Boton variante="fantasma" className="text-xs" onClick={vaciarCarro}>Quitar de la lista</Boton>}>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {enCarro.map((x) => <Articulo key={x.id} a={x} onMarcar={(v) => actualizar('lista_compra', x.id, { hecho: v })} onTexto={(v) => actualizar('lista_compra', x.id, { texto: v })} onBorrar={() => borrar('lista_compra', x.id)} />)}
            </ul>
          </Card>
          <TerminarCompra comprados={enCarro} />
        </>
      )}
    </div>
  )
}

function Articulo({ a, onMarcar, onTexto, onBorrar }: { a: ArticuloCompra; onMarcar: (v: boolean) => void; onTexto: (v: string) => void; onBorrar: () => void }) {
  return (
    <li className="flex items-center gap-2 py-1">
      <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--series-1)]" checked={a.hecho} aria-label={`${a.hecho ? 'Desmarcar' : 'Marcar'} ${a.texto}`} onChange={(e) => onMarcar(e.target.checked)} />
      <CeldaTexto ariaLabel="Artículo" valor={a.texto} onCambio={onTexto} className={cx('flex-1', a.hecho && 'text-slate-400 line-through')} />
      <button type="button" aria-label={`Quitar ${a.texto}`} title="Quitar" onClick={onBorrar} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40">✕</button>
    </li>
  )
}

/** Al terminar: el total del ticket se suma como apunte a un gasto del mes (con lo comprado como nota). */
function TerminarCompra({ comprados }: { comprados: ArticuloCompra[] }) {
  const { datos, aplicar, actualizar, borrar, repo, obtener, avisar } = useStore()
  const eur = useEur()
  const mes = mesesOrdenados(datos).filter((m) => m.estado === 'Abierto').at(-1)
  const gastos = mes ? datos.expenses.filter((g) => g.month_id === mes.id && !g.aportacion_cuenta).sort((a, b) => a.orden - b.orden) : []
  const porDefecto = gastos.find((g) => /super|compra|aliment|comida/i.test(g.concepto)) ?? gastos[0]
  const [gastoId, setGastoId] = useState<string>(porDefecto?.id ?? '')
  const [total, setTotal] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!mes) {
    return (
      <Card titulo="Terminar la compra">
        <p className="text-sm text-slate-500">Para apuntar el ticket hace falta un mes abierto. <Link to="/" className="text-sky-700 underline dark:text-sky-400">Crea el mes</Link>.</p>
      </Card>
    )
  }

  function apuntar(e: FormEvent) {
    e.preventDefault()
    const c = parseImporte(total)
    const g = gastos.find((x) => x.id === gastoId)
    if (c === null || c <= 0) return setError('Escribe el total del ticket.')
    if (!g || !mes) return setError('Elige el gasto al que sumarlo.')
    const lista = comprados.map((x) => x.texto).join(', ')
    const nota = `Compra: ${lista.length > 140 ? `${lista.slice(0, 137)}…` : lista}`
    const r = anadirGasto(obtener(), g.id, c, undefined, nota)
    aplicar(r.datos, [() => repo.insertar('expense_entries', [r.apunte])], mes.id)
    actualizar('expenses', g.id, { importe: r.gasto.importe })
    for (const x of comprados) borrar('lista_compra', x.id)
    avisar({ texto: `Apuntado ${eur(c, { dash: false })} en ${g.concepto} (${nombreMes(mes.fecha)}).` })
    setTotal('')
    setError(null)
  }

  return (
    <Card titulo="Terminar la compra">
      <form onSubmit={apuntar} className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <label className="block text-sm">
          Total del ticket
          <input className="campo num mt-1 text-right" inputMode="decimal" placeholder="0,00 €" value={total} onChange={(e) => setTotal(e.target.value)} />
        </label>
        <label className="block text-sm">
          Sumarlo a ({nombreMes(mes.fecha)})
          <select className="campo mt-1" value={gastoId} onChange={(e) => setGastoId(e.target.value)}>
            {gastos.map((g) => <option key={g.id} value={g.id}>{g.concepto}</option>)}
          </select>
        </label>
        <Boton type="submit" variante="primario">Apuntar y quitar de la lista</Boton>
      </form>
      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
      <p className="mt-2 text-xs text-slate-500">Se suma como un apunte, con lo comprado en la nota, y los artículos del carro salen de la lista.</p>
    </Card>
  )
}
