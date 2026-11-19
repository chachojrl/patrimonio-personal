import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { BadgeEstado, Boton, Card, CeldaFecha, CeldaImporte, CeldaTexto, Dinero, Info, Modal, cx } from '../components/ui'
import { BarrasIngresosGastos, DonutGastado } from '../components/Graficos'
import { CrearMesBoton } from '../components/CrearMes'
import { formatEUR, parseImporte } from '../lib/money'
import { formatFechaHora, nombreMes, hoyISO } from '../lib/fechas'
import { anadirGasto, borrarCreaHueco, deshacerApunte, mesesOrdenados, uid } from '../lib/operaciones'
import type { Ahorro, Gasto, Ingreso, Mes, OrigenAhorro, TipoAhorro } from '../lib/tipos'

export function MesPage() {
  const { ym } = useParams()
  const { datos, calc } = useStore()
  const mes = datos.months.find((m) => m.fecha.slice(0, 7) === ym)
  if (!mes) {
    const u = mesesOrdenados(datos).at(-1)
    if (u && ym === 'actual') return <Navigate to={`/mes/${u.fecha.slice(0, 7)}`} replace />
    return (
      <Card>
        <p className="mb-3">No existe el mes {ym}.</p>
        <CrearMesBoton />
      </Card>
    )
  }
  const c = calc.porId.get(mes.id)!
  return <VistaMes key={mes.id} mes={mes} c={c} />
}

function VistaMes({ mes, c }: { mes: Mes; c: NonNullable<ReturnType<ReturnType<typeof useStore>['calc']['porId']['get']>> }) {
  const { datos, actualizar } = useStore()
  const cerrado = mes.estado === 'Cerrado'
  const ordenados = mesesOrdenados(datos)
  const idx = ordenados.findIndex((m) => m.id === mes.id)
  const prev = ordenados[idx - 1]
  const next = ordenados[idx + 1]
  const exceso = c.gastosTotales - c.ingresosTotales

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            {prev ? <Link className="rounded px-1.5 hover:bg-slate-200 dark:hover:bg-slate-800" to={`/mes/${prev.fecha.slice(0, 7)}`} aria-label="Mes anterior">←</Link> : <span className="px-1.5 opacity-30">←</span>}
            <span className="font-semibold text-slate-700 dark:text-slate-200">{c.nombre}</span>
            {next ? <Link className="rounded px-1.5 hover:bg-slate-200 dark:hover:bg-slate-800" to={`/mes/${next.fecha.slice(0, 7)}`} aria-label="Mes siguiente">→</Link> : <span className="px-1.5 opacity-30">→</span>}
            <BadgeEstado estado={mes.estado} />
          </div>
          <input
            aria-label="Título del mes"
            className="celda -ml-2 mt-1 text-2xl font-bold text-marino dark:text-sky-300 sm:text-3xl"
            value={mes.titulo}
            disabled={cerrado}
            onChange={(e) => actualizar('months', mes.id, { titulo: e.target.value })}
          />
          <div className="text-xs text-slate-500 dark:text-slate-400">Último cambio: {formatFechaHora(mes.ultimo_cambio)}</div>
        </div>
        {!next && <CrearMesBoton className="self-start" />}
      </div>

      {exceso > 0 && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          ⚠ Exceso de gasto: {formatEUR(exceso)}
        </div>
      )}

      {/* Resumen */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1.2fr)]">
        <Card titulo="Porcentaje de ingresos gastado">
          <DonutGastado pctGastado={c.pctGastado} />
        </Card>
        <Card titulo="Resumen">
          <div className="grid grid-cols-2 gap-3">
            <Tarjeta titulo="Ingresos mensuales totales" valor={c.ingresosTotales} />
            <Tarjeta titulo="Gastos mensuales totales" valor={c.gastosTotales} />
            <Tarjeta titulo="Ahorro mensual total" valor={c.ahorroTotal} />
            <Tarjeta titulo="Saldo disponible" valor={c.saldoDisponible} destacado />
          </div>
          <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Ajuste de saldo (automático)
                <Info texto="Diferencia entre el saldo real que escribas y el calculado. Si es positiva cuenta como ingreso extra; si es negativa, como gasto no registrado." />
              </div>
              <div className="mt-1 text-lg font-semibold"><Dinero c={c.ajuste} verde /></div>
              <div className="text-xs text-slate-500">Calculado: {formatEUR(c.saldoCalculado, { dash: false })}</div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500" htmlFor="saldo-real">
                Saldo real en cuenta (opcional)
              </label>
              <CeldaImporte
                ariaLabel="Saldo real en cuenta"
                valor={mes.saldo_real_cuenta}
                permitirVacio
                permitirNegativo
                disabled={cerrado}
                placeholder="Vacío"
                className="mt-1 border-slate-300 bg-white text-left dark:border-slate-600 dark:bg-slate-900"
                onCambio={(v) => actualizar('months', mes.id, { saldo_real_cuenta: v })}
              />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Inversiones acumuladas
                <Info texto="Si escribes el valor real de tu cartera, sustituye a la estimación (última valoración + aportaciones) y se recalculan el ahorro acumulado, el dinero total y la ganancia/pérdida, también de los meses siguientes." />
              </div>
              <div className="mt-1 text-lg font-semibold"><Dinero c={c.inversionesAcum} dash={false} /></div>
              <div className="text-xs text-slate-500">{mes.valor_real_inversiones === null ? 'Estimado' : 'Valor real'}</div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Valor real de inversiones (opcional)
              </label>
              <CeldaImporte
                ariaLabel="Valor real de inversiones"
                valor={mes.valor_real_inversiones}
                permitirVacio
                placeholder="Vacío"
                className="mt-1 border-slate-300 bg-white text-left dark:border-slate-600 dark:bg-slate-900"
                onCambio={(v) => actualizar('months', mes.id, { valor_real_inversiones: v })}
              />
            </div>
          </div>
        </Card>
        <Card titulo="Ingresos vs gastos">
          <BarrasIngresosGastos ingresos={c.ingresosTotales} gastos={c.gastosTotales} />
        </Card>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[2fr_3fr]">
        <TablaIngresos mes={mes} cerrado={cerrado} />
        <TablaAhorro mes={mes} cerrado={cerrado} />
      </div>
      <TablaGastos mes={mes} cerrado={cerrado} />
      <EstadoMes mes={mes} />
    </div>
  )
}

function Tarjeta({ titulo, valor, destacado }: { titulo: string; valor: number; destacado?: boolean }) {
  return (
    <div className={cx('rounded-xl border p-3', destacado ? 'border-marino/30 bg-marino/5 dark:border-sky-700 dark:bg-sky-900/20' : 'border-slate-200 dark:border-slate-700')}>
      <div className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-500 sm:text-[11px]">{titulo}</div>
      <div className="mt-1 text-lg font-bold sm:text-2xl"><Dinero c={valor} dash={false} /></div>
    </div>
  )
}

function Total({ etiqueta, valor, cols }: { etiqueta: string; valor: number; cols?: string }) {
  return (
    <div className={cx('mt-2 flex items-center justify-between border-t-2 border-marino/60 px-2 pt-2 font-semibold dark:border-sky-700', cols)}>
      <span>{etiqueta}</span>
      <Dinero c={valor} dash={false} />
    </div>
  )
}

// ---------------- Ingresos ----------------
function TablaIngresos({ mes, cerrado }: { mes: Mes; cerrado: boolean }) {
  const { datos, actualizar, insertar, borrar } = useStore()
  const [params] = useSearchParams()
  const filas = datos.incomes.filter((x) => x.month_id === mes.id).sort((a, b) => a.orden - b.orden)
  const total = filas.reduce((a, b) => a + b.importe, 0)
  const focoNomina = params.get('foco') === 'nomina'
  return (
    <Card titulo="Ingresos mensuales" accion={!cerrado && (
      <Boton variante="fantasma" className="text-xs" onClick={() => insertar('incomes', { id: uid(), month_id: mes.id, concepto: 'Nuevo ingreso', importe: 0, orden: (filas.at(-1)?.orden ?? -1) + 1 } satisfies Ingreso)}>＋ Añadir ingreso</Boton>
    )}>
      <div className="grid grid-cols-[1fr_9rem_2rem] gap-x-1 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <span>Concepto</span><span className="text-right">Importe</span><span />
      </div>
      {filas.map((f, i) => (
        <div key={f.id} className="grid grid-cols-[1fr_9rem_2rem] items-center gap-x-1 border-b border-slate-100 dark:border-slate-800">
          <CeldaTexto ariaLabel="Concepto de ingreso" valor={f.concepto} disabled={cerrado} onCambio={(v) => actualizar('incomes', f.id, { concepto: v })} />
          <CeldaImporte ariaLabel={`Importe ${f.concepto}`} valor={f.importe} disabled={cerrado} autoFocus={focoNomina && i === 0} onCambio={(v) => actualizar('incomes', f.id, { importe: v ?? 0 })} />
          {!cerrado ? <BotonBorrar onClick={() => borrar('incomes', f.id)} /> : <span />}
        </div>
      ))}
      <Total etiqueta="Total ingresos" valor={total} />
    </Card>
  )
}

function BotonBorrar({ onClick, etiqueta = 'Borrar fila' }: { onClick: () => void; etiqueta?: string }) {
  return (
    <button type="button" aria-label={etiqueta} title={etiqueta} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40">
      ✕
    </button>
  )
}

// ---------------- Gastos (con la columna "Añadir gasto") ----------------
function TablaGastos({ mes, cerrado }: { mes: Mes; cerrado: boolean }) {
  const { datos, actualizar, insertar, borrar, aplicar, repo, avisar, obtener } = useStore()
  const filas = datos.expenses.filter((x) => x.month_id === mes.id).sort((a, b) => a.orden - b.orden)
  const total = filas.reduce((a, b) => a + b.importe, 0)
  const [pendientes, setPendientes] = useState<Record<string, string>>({})
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [desglose, setDesglose] = useState<Gasto | null>(null)
  const nPend = Object.values(pendientes).filter((v) => v.trim() !== '').length

  function deshacer(apunteId: string) {
    const r = deshacerApunte(obtener(), apunteId)
    if (!r.gasto) return
    aplicar(r.datos, [() => repo.borrar('expense_entries', [apunteId])], mes.id)
    actualizar('expenses', r.gasto.id, { importe: r.gasto.importe })
  }

  /** Macro SumarGasto: suma el importe escrito al gasto y vacía la casilla. */
  function sumar(g: Gasto, texto: string, silencioso = false): boolean {
    if (texto.trim() === '') return false
    const c = parseImporte(texto)
    if (c === null || c <= 0) {
      setErrores((e) => ({ ...e, [g.id]: 'Introduce un importe numérico.' }))
      return false
    }
    const r = anadirGasto(obtener(), g.id, c)
    aplicar(r.datos, [() => repo.insertar('expense_entries', [r.apunte])], mes.id)
    actualizar('expenses', g.id, { importe: r.gasto.importe })
    setPendientes((p) => ({ ...p, [g.id]: '' }))
    setErrores((e) => ({ ...e, [g.id]: '' }))
    if (!silencioso) avisar({ texto: `Añadido ${formatEUR(c)} a ${g.concepto}`, accion: { texto: 'Deshacer', fn: () => deshacer(r.apunte.id) } })
    return true
  }

  function aplicarTodos() {
    let n = 0
    for (const g of filas) if (pendientes[g.id] && sumar(g, pendientes[g.id], true)) n++
    avisar({ texto: `${n} gasto(s) añadido(s).` })
  }

  const columnas = 'md:grid-cols-[minmax(0,1fr)_9.5rem_9rem_10rem_2rem]'
  return (
    <Card
      titulo="Gastos mensuales"
      accion={
        !cerrado && (
          <div className="flex gap-2">
            {nPend > 0 && <Boton variante="primario" className="text-xs" onClick={aplicarTodos}>Aplicar todos ({nPend})</Boton>}
            <Boton
              variante="fantasma"
              className="text-xs"
              onClick={() => insertar('expenses', { id: uid(), month_id: mes.id, concepto: 'Nuevo gasto', fecha_vencimiento: null, importe: 0, orden: (filas.at(-1)?.orden ?? -1) + 1 } satisfies Gasto)}
            >
              ＋ Nueva fila de gasto
            </Boton>
          </div>
        )
      }
    >
      <div className={cx('hidden gap-x-1 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid', columnas)}>
        <span>Concepto</span>
        <span>Vencimiento</span>
        <span className="text-right">Importe</span>
        <span className="text-right">
          Añadir gasto
          <Info texto="Escribe un importe y pulsa Enter: se suma al importe de la fila y la casilla se vacía (como la macro del Excel). Cada suma queda registrada y se puede deshacer." />
        </span>
        <span />
      </div>
      {filas.map((g) => {
        const apuntes = datos.expense_entries.filter((a) => a.expense_id === g.id)
        return (
          <div key={g.id} className={cx('grid grid-cols-[minmax(0,1fr)_7.5rem_2rem] items-center gap-x-1 border-b border-slate-100 py-1 dark:border-slate-800 md:py-0', columnas)}>
            <div className="min-w-0">
              <CeldaTexto ariaLabel="Concepto de gasto" valor={g.concepto} disabled={cerrado} onCambio={(v) => actualizar('expenses', g.id, { concepto: v })} />
              {apuntes.length > 0 && (
                <button type="button" onClick={() => setDesglose(g)} className="ml-2 text-[11px] text-sky-700 hover:underline dark:text-sky-400">
                  {apuntes.length} apunte{apuntes.length > 1 ? 's' : ''}
                </button>
              )}
            </div>
            <div className="order-4 md:order-none">
              <CeldaFecha ariaLabel={`Vencimiento ${g.concepto}`} valor={g.fecha_vencimiento} disabled={cerrado} onCambio={(v) => actualizar('expenses', g.id, { fecha_vencimiento: v })} />
            </div>
            <div className="order-2 md:order-none">
              <CeldaImporte ariaLabel={`Importe ${g.concepto}`} valor={g.importe} disabled={cerrado} onCambio={(v) => actualizar('expenses', g.id, { importe: v ?? 0 })} />
            </div>
            <div className="order-5 col-span-2 md:order-none md:col-span-1">
              {!cerrado && (
                <div className="flex items-center gap-1">
                  <input
                    inputMode="decimal"
                    aria-label={`Añadir gasto a ${g.concepto}`}
                    placeholder="+ €"
                    value={pendientes[g.id] ?? ''}
                    onChange={(e) => {
                      setPendientes((p) => ({ ...p, [g.id]: e.target.value }))
                      setErrores((er) => ({ ...er, [g.id]: '' }))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') sumar(g, pendientes[g.id] ?? '')
                    }}
                    className={cx(
                      'celda num border-dashed border-slate-300 text-right dark:border-slate-600',
                      (pendientes[g.id] ?? '') !== '' && 'border-solid border-amber-400 bg-amber-50 dark:bg-amber-900/20',
                      errores[g.id] && 'celda-invalida',
                    )}
                  />
                  {(pendientes[g.id] ?? '') !== '' && (
                    <button type="button" aria-label="Sumar" onClick={() => sumar(g, pendientes[g.id] ?? '')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-marino text-white">
                      ✓
                    </button>
                  )}
                </div>
              )}
              {errores[g.id] && <div className="px-2 text-[11px] text-red-600">{errores[g.id]}</div>}
            </div>
            <div className="order-3 justify-self-end md:order-none">{!cerrado && <BotonBorrar onClick={() => borrar('expenses', g.id)} />}</div>
          </div>
        )
      })}
      <Total etiqueta="Total gastos" valor={total} />

      <Modal abierto={!!desglose} onCerrar={() => setDesglose(null)} titulo={`Apuntes de ${desglose?.concepto ?? ''}`} pie={<Boton onClick={() => setDesglose(null)}>Cerrar</Boton>}>
        {desglose && (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {datos.expense_entries
              .filter((a) => a.expense_id === desglose.id)
              .sort((a, b) => a.creado_en.localeCompare(b.creado_en))
              .map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <span className="text-slate-500">{formatFechaHora(a.creado_en)}</span>
                  <span className="flex items-center gap-2">
                    <Dinero c={a.importe} />
                    {!cerrado && <BotonBorrar etiqueta="Deshacer apunte" onClick={() => deshacer(a.id)} />}
                  </span>
                </li>
              ))}
          </ul>
        )}
        <p className="text-xs text-slate-500">Importe actual de la fila: {formatEUR(datos.expenses.find((e) => e.id === desglose?.id)?.importe ?? 0, { dash: false })}. Si lo editas a mano, los apuntes quedan solo como historial.</p>
      </Modal>
    </Card>
  )
}

// ---------------- Ahorro ----------------
const TIPOS: TipoAhorro[] = ['Inversiones', 'Cuenta remunerada']
const ORIGENES: OrigenAhorro[] = ['Ingresos mensuales', 'Cuenta remunerada']

function TablaAhorro({ mes, cerrado }: { mes: Mes; cerrado: boolean }) {
  const { datos, actualizar, insertar, borrar } = useStore()
  const filas = datos.savings.filter((x) => x.month_id === mes.id).sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
  const total = filas.reduce((a, b) => a + b.importe, 0)
  const hoy = hoyISO()
  const fechaDef = hoy.slice(0, 7) === mes.fecha.slice(0, 7) ? hoy : mes.fecha
  const cols = 'grid-cols-[8.5rem_7.5rem_minmax(8rem,1fr)_minmax(9rem,1fr)_2rem]'
  return (
    <Card titulo="Ahorro mensual" accion={!cerrado && (
      <Boton variante="fantasma" className="text-xs" onClick={() => insertar('savings', { id: uid(), month_id: mes.id, fecha: fechaDef, importe: 0, tipo: 'Inversiones', origen: 'Ingresos mensuales' } satisfies Ahorro)}>＋ Añadir ahorro</Boton>
    )}>
      <div className="-mx-2 overflow-x-auto px-2">
        <div className="min-w-[34rem]">
          <div className={cx('grid gap-x-1 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500', cols)}>
            <span>Fecha</span><span className="text-right">Importe</span><span>Tipo</span><span>Origen</span><span />
          </div>
          {filas.length === 0 && <p className="px-2 py-3 text-sm text-slate-500">Sin movimientos de ahorro este mes.</p>}
          {filas.map((f) => (
            <div key={f.id} className={cx('grid items-center gap-x-1 border-b border-slate-100 dark:border-slate-800', cols)}>
              <CeldaFecha ariaLabel="Fecha del ahorro" valor={f.fecha} disabled={cerrado} onCambio={(v) => actualizar('savings', f.id, { fecha: v })} />
              <CeldaImporte ariaLabel="Importe del ahorro" valor={f.importe} disabled={cerrado} onCambio={(v) => actualizar('savings', f.id, { importe: v ?? 0 })} />
              <select
                aria-label="Tipo"
                className="celda"
                disabled={cerrado}
                value={f.tipo}
                onChange={(e) => {
                  const tipo = e.target.value as TipoAhorro
                  actualizar('savings', f.id, tipo === 'Cuenta remunerada' && f.origen === 'Cuenta remunerada' ? { tipo, origen: 'Ingresos mensuales' } : { tipo })
                }}
              >
                {TIPOS.map((t) => <option key={t}>{t}</option>)}
              </select>
              <select aria-label="Origen" className="celda" disabled={cerrado} value={f.origen} onChange={(e) => actualizar('savings', f.id, { origen: e.target.value })}>
                {ORIGENES.map((o) => (
                  <option key={o} disabled={o === 'Cuenta remunerada' && f.tipo === 'Cuenta remunerada'}>{o}</option>
                ))}
              </select>
              {!cerrado ? <BotonBorrar onClick={() => borrar('savings', f.id)} /> : <span />}
            </div>
          ))}
        </div>
      </div>
      <Total etiqueta="Total ahorro" valor={total} />
      {filas.some((f) => f.tipo === 'Inversiones' && f.origen === 'Cuenta remunerada') && (
        <p className="mt-2 text-xs text-slate-500">Los traspasos de cuenta remunerada a inversiones no restan del saldo disponible del mes.</p>
      )}
    </Card>
  )
}

// ---------------- Estado del mes ----------------
function EstadoMes({ mes }: { mes: Mes }) {
  const { datos, actualizar, borrarMes, avisar } = useStore()
  const navigate = useNavigate()
  const [confirmarReabrir, setConfirmarReabrir] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [texto, setTexto] = useState('')
  const [aceptoHueco, setAceptoHueco] = useState(false)
  const nombre = nombreMes(mes.fecha)
  const hueco = useMemo(() => borrarCreaHueco(datos, mes.id), [datos, mes.id])

  return (
    <Card titulo="Estado del mes">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="estado-mes" className="mb-1 block text-xs text-slate-500">Estado</label>
          <select
            id="estado-mes"
            className="campo w-40"
            value={mes.estado}
            onChange={(e) => {
              if (e.target.value === 'Abierto') setConfirmarReabrir(true)
              else actualizar('months', mes.id, { estado: 'Cerrado' })
            }}
          >
            <option>Abierto</option>
            <option>Cerrado</option>
          </select>
        </div>
        {mes.estado === 'Cerrado' && <Boton onClick={() => setConfirmarReabrir(true)}>🔓 Reabrir mes</Boton>}
        <div>
          <div className="mb-1 text-xs text-slate-500">Último cambio</div>
          <div className="num py-2 font-medium">{formatFechaHora(mes.ultimo_cambio)}</div>
        </div>
        <div className="ml-auto">
          <Boton variante="fantasma" className="text-red-600" onClick={() => setBorrando(true)}>🗑 Borrar mes</Boton>
        </div>
      </div>
      {mes.estado === 'Cerrado' && <p className="mt-3 text-sm text-slate-500">Mes cerrado: todo está en solo lectura.</p>}

      <Modal
        abierto={confirmarReabrir}
        onCerrar={() => setConfirmarReabrir(false)}
        titulo={`¿Reabrir ${nombre}?`}
        pie={
          <>
            <Boton onClick={() => setConfirmarReabrir(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={() => { actualizar('months', mes.id, { estado: 'Abierto' }); setConfirmarReabrir(false) }}>Reabrir</Boton>
          </>
        }
      >
        <p>El mes volverá a ser editable. Los cambios afectarán a los saldos de los meses siguientes.</p>
      </Modal>

      <Modal
        abierto={borrando}
        onCerrar={() => setBorrando(false)}
        titulo={`Borrar ${nombre}`}
        pie={
          <>
            <Boton onClick={() => setBorrando(false)}>Cancelar</Boton>
            <Boton
              variante="peligro"
              disabled={texto.trim().toLowerCase() !== nombre.toLowerCase() || (hueco && !aceptoHueco)}
              onClick={async () => {
                try {
                  await borrarMes(mes.id)
                  avisar({ texto: `${nombre} borrado.` })
                  navigate('/')
                } catch (e) {
                  avisar({ texto: (e as Error).message, tipo: 'error' })
                }
              }}
            >
              Borrar definitivamente
            </Boton>
          </>
        }
      >
        <p>Se borrarán todos sus ingresos, gastos, apuntes y ahorros. Desaparecerá del historial y los meses posteriores se recalcularán. <strong>No se puede deshacer.</strong></p>
        <label className="block">
          Escribe <strong>{nombre}</strong> para confirmar:
          <input className="campo mt-1" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" />
        </label>
        {hueco && (
          <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
            <input type="checkbox" className="mt-0.5" checked={aceptoHueco} onChange={(e) => setAceptoHueco(e.target.checked)} />
            Sé que se creará un hueco en el historial (no es el último mes).
          </label>
        )}
      </Modal>
    </Card>
  )
}

