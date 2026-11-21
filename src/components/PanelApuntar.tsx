// Panel rápido para apuntar un gasto desde cualquier pantalla (botón «+» de la barra inferior).
// Sube desde abajo en el móvil; en pantallas anchas es una ventana centrada.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import { useCuentas } from '../data/cuentas'
import { anadirGasto, deshacerApunte, estadoPresupuesto, mesesOrdenados } from '../lib/operaciones'
import { aCentimos, conceptosFrecuentes, teclear } from '../lib/apuntar'
import { useEur } from '../lib/discreto'
import { MESES, partes } from '../lib/fechas'
import { Icono } from './ios'
import { cx } from './ui'

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫']

export function PanelApuntar({ onCerrar }: { onCerrar: () => void }) {
  const { datos, aplicar, actualizar, repo, obtener, avisar } = useStore()
  const { activa } = useCuentas()
  const eur = useEur()
  const mes = mesesOrdenados(datos).filter((m) => m.estado === 'Abierto').at(-1)
  const gastosMes = useMemo(
    () => (mes ? datos.expenses.filter((g) => g.month_id === mes.id && !g.aportacion_cuenta) : []),
    [datos.expenses, mes],
  )
  // El orden se fija al abrir, para que los botones no salten mientras apuntas
  const [orden] = useState(() => conceptosFrecuentes(datos, gastosMes).map((g) => g.id))
  const frecuentes = orden.map((id) => gastosMes.find((g) => g.id === id)).filter((g): g is NonNullable<typeof g> => !!g)
  const [gastoId, setGastoId] = useState(frecuentes[0]?.id ?? '')
  const [texto, setTexto] = useState('')
  const [nota, setNota] = useState('')
  const importe = aCentimos(texto)
  const elegido = gastosMes.find((g) => g.id === gastoId)
  const panel = useRef<HTMLDivElement>(null)

  // Teclado físico (ordenador): números, coma, borrar, Enter y Escape
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onCerrar()
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return
      if (/^[\d.,]$/.test(e.key)) setTexto((t) => teclear(t, e.key))
      else if (e.key === 'Backspace') setTexto((t) => teclear(t, '⌫'))
      else if (e.key === 'Enter') panel.current?.querySelector<HTMLButtonElement>('[data-apuntar]')?.click()
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [onCerrar])

  // Sin scroll de fondo mientras está abierto
  useEffect(() => {
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = antes
    }
  }, [])

  function apuntar() {
    if (!mes || !elegido || importe === null) return
    const n = nota.trim() || null
    const r = anadirGasto(obtener(), elegido.id, importe, undefined, n)
    aplicar(r.datos, [() => repo.insertar('expense_entries', [r.apunte])], mes.id)
    actualizar('expenses', elegido.id, { importe: r.gasto.importe })
    const e = estadoPresupuesto(r.gasto)
    const aviso = e && e.exceso > 0 ? ` Te has pasado del presupuesto en ${eur(e.exceso)}.` : ''
    avisar({
      texto: `Apuntado ${eur(importe)} en ${elegido.concepto}${n ? ` («${n}»)` : ''}.${aviso}`,
      tipo: aviso ? 'error' : 'ok',
      accion: {
        texto: 'Deshacer',
        fn: () => {
          const d = deshacerApunte(obtener(), r.apunte.id)
          if (!d.gasto) return
          aplicar(d.datos, [() => repo.borrar('expense_entries', [r.apunte.id])], mes.id)
          actualizar('expenses', d.gasto.id, { importe: d.gasto.importe })
        },
      },
    })
    onCerrar()
  }

  const { anio, mes: m } = mes ? partes(mes.fecha) : { anio: 0, mes: 1 }
  const presupuesto = elegido ? estadoPresupuesto(elegido) : null
  const [entero, decimales] = (texto || '0').split(',')

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-labelledby="titulo-apuntar">
      <button type="button" aria-label="Cerrar" className="anim-fondo absolute inset-0 bg-black/35" onClick={onCerrar} />
      <div
        ref={panel}
        className="anim-subir relative flex max-h-[94dvh] w-full flex-col overflow-y-auto rounded-t-[14px] bg-[#f2f2f7] dark:bg-[#1c1c1e] md:max-w-md md:rounded-[14px]"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600 md:hidden" aria-hidden />
        <div className="flex items-center justify-between px-4 pb-1 pt-2">
          <button type="button" onClick={onCerrar} className="min-h-11 pr-3 text-[17px] text-marino dark:text-sky-300">Cancelar</button>
          <h2 id="titulo-apuntar" className="text-[17px] font-semibold text-slate-900 dark:text-white">Apuntar gasto</h2>
          <span className="w-[74px]" />
        </div>

        {!mes ? (
          <div className="m-4 rounded-xl bg-white p-4 text-[15px] dark:bg-[#2c2c2e]">
            No hay ningún mes abierto.{' '}
            <Link to="/" onClick={onCerrar} className="font-medium text-marino underline dark:text-sky-300">Crea el mes</Link> y vuelve a intentarlo.
          </div>
        ) : gastosMes.length === 0 ? (
          <div className="m-4 rounded-xl bg-white p-4 text-[15px] dark:bg-[#2c2c2e]">
            {MESES[m - 1]} no tiene filas de gasto.{' '}
            <Link to={`/mes/${mes.fecha.slice(0, 7)}`} onClick={onCerrar} className="font-medium text-marino underline dark:text-sky-300">Añade una en el mes</Link>.
          </div>
        ) : (
          <>
            <p className="px-4 text-center text-[13px] text-slate-500 dark:text-slate-400">
              {MESES[m - 1]} {anio}{activa?.tipo === 'compartida' ? ` · ${activa.nombre}` : ''}
            </p>
            <output className="num block px-4 pb-2 pt-1 text-center" aria-live="polite" aria-label="Importe">
              <span className={cx('text-[46px] font-bold leading-none tracking-tight [@media(max-height:700px)]:text-[38px]', !texto && 'text-slate-300 dark:text-slate-600')}>{entero}</span>
              <span className={cx('text-[28px] font-semibold', !texto ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400')}>
                {texto.includes(',') ? `,${decimales}` : ''} €
              </span>
            </output>

            <div className="px-4">
              {/* Una sola fila que se desliza de lado: lo más usado primero */}
              <div className="sin-barra -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Concepto">
                {frecuentes.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    role="radio"
                    aria-checked={g.id === gastoId}
                    onClick={() => setGastoId(g.id)}
                    className={cx(
                      'min-h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[15px] font-medium transition-colors',
                      g.id === gastoId ? 'bg-marino text-white dark:bg-sky-700' : 'bg-white text-slate-800 dark:bg-[#2c2c2e] dark:text-slate-100',
                    )}
                  >
                    {g.concepto}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 min-h-[18px] text-center text-[13px] text-slate-500 dark:text-slate-400">
                {elegido && presupuesto && elegido.presupuesto !== null
                  ? presupuesto.exceso > 0
                    ? `Ya te has pasado del presupuesto de ${elegido.concepto} en ${eur(presupuesto.exceso)}`
                    : `Quedan ${eur(elegido.presupuesto - elegido.importe, { dash: false })} de ${eur(elegido.presupuesto, { dash: false })} en ${elegido.concepto}`
                  : elegido && elegido.importe > 0 ? `Llevas ${eur(elegido.importe)} en ${elegido.concepto} este mes` : ''}
              </p>
              <label className="mt-1.5 flex h-11 items-center gap-2 rounded-[10px] bg-white px-3 dark:bg-[#2c2c2e]">
                <Icono nombre="lapiz" className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && apuntar()}
                  placeholder="Nota (opcional): Mercadona, cena…"
                  aria-label="Nota"
                  maxLength={120}
                  className="min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-slate-400"
                />
              </label>
            </div>

            <div className="mt-2.5 grid grid-cols-3 gap-1.5 px-4" aria-label="Teclado numérico">
              {TECLAS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTexto((x) => teclear(x, t))}
                  aria-label={t === '⌫' ? 'Borrar' : t === ',' ? 'Coma' : t}
                  className="num flex h-[46px] items-center [@media(max-height:700px)]:h-[38px] justify-center rounded-[10px] bg-white text-[24px] font-medium text-slate-900 shadow-[0_1px_0_rgba(0,0,0,0.12)] active:bg-slate-200 dark:bg-[#3a3a3c] dark:text-white dark:active:bg-[#5a5a5e]"
                >
                  {t === '⌫' ? <Icono nombre="borrarTecla" className="h-6 w-6" /> : t}
                </button>
              ))}
            </div>

            {/* Siempre a la vista, aunque la pantalla sea baja */}
            <div className="sticky bottom-0 bg-[#f2f2f7] px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2.5 dark:bg-[#1c1c1e] md:pb-4">
              <button
                type="button"
                data-apuntar
                onClick={apuntar}
                disabled={!elegido || importe === null}
                className="min-h-[50px] w-full rounded-[12px] bg-marino px-4 text-[17px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-40 dark:bg-sky-700"
              >
                {importe !== null && elegido ? `Apuntar ${eur(importe)} en ${elegido.concepto}` : 'Escribe el importe'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
