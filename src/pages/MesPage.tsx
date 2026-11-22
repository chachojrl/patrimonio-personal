import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { BadgeEstado, Boton, Card, CeldaFecha, CeldaImporte, CeldaTexto, Dinero, Info, Modal, cx } from '../components/ui'
import { Fila, FilaCampo, Icono } from '../components/ios'
import { CrearMesBoton } from '../components/CrearMes'
import { useEur } from '../lib/discreto'
import { nombreMiembro, useCuentas } from '../data/cuentas'
import { Reparto503020Card } from '../components/Reparto503020Card'
import { GastosRaros } from '../components/GastosRaros'
import { CierreMes } from '../components/CierreMes'
import { RepartoCompartidaCard } from '../components/RepartoCompartidaCard'
import { MESES, MESES_CORTOS, formatFechaHora, indiceMes, nombreMes, hoyISO, partes } from '../lib/fechas'
import { cuentaDestino, cuentaOrigen, type MesCalculado } from '../lib/calculos'
import { anadirGasto, borrarCreaHueco, deshacerApunte, estadoPresupuesto, mesesOrdenados, reordenar, separarImporteNota, uid } from '../lib/operaciones'
import { Asa, useOrdenable } from '../components/Ordenable'
import type { Ahorro, Gasto, Ingreso, Mes, OrigenAhorro, TipoAhorro } from '../lib/tipos'
import { formatTae } from '../lib/money'

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
  const eur = useEur()
  const alMesSiguiente = (datos.config.pago_intereses ?? 'mes-siguiente') === 'mes-siguiente'
  const compartida = useCuentas().activa?.tipo === 'compartida'
  const ordenados = mesesOrdenados(datos)
  const idx = ordenados.findIndex((m) => m.id === mes.id)
  const prev = ordenados[idx - 1]
  const next = ordenados[idx + 1]
  const exceso = c.gastosTotales - c.ingresosTotales

  const pct = Math.round(c.pctGastado * 100)
  return (
    <div className="space-y-6">
      {/* Cabecera: mes anterior / siguiente, título editable y estado */}
      <div>
        <nav aria-label="Cambiar de mes" className="-mx-2 flex items-center justify-between">
          {prev ? (
            <Link className="flex h-11 items-center gap-0.5 rounded-lg px-1 text-[17px] text-marino dark:text-sky-300" to={`/mes/${prev.fecha.slice(0, 7)}`} aria-label={`Mes anterior: ${nombreMes(prev.fecha)}`}>
              <Icono nombre="anterior" className="h-6 w-6" grosor={2.2} />{corto(prev.fecha)}
            </Link>
          ) : <span />}
          {next && (
            <Link className="flex h-11 items-center gap-0.5 rounded-lg px-1 text-[17px] text-marino dark:text-sky-300" to={`/mes/${next.fecha.slice(0, 7)}`} aria-label={`Mes siguiente: ${nombreMes(next.fecha)}`}>
              {corto(next.fecha)}<Icono nombre="siguiente" className="h-6 w-6" grosor={2.2} />
            </Link>
          )}
        </nav>
        <input
          aria-label="Título del mes"
          className="celda -ml-2 text-[28px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-[34px]"
          value={mes.titulo}
          disabled={cerrado}
          onChange={(e) => actualizar('months', mes.id, { titulo: e.target.value })}
        />
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
          <BadgeEstado estado={mes.estado} />
          <span className="text-[13px] text-slate-500 dark:text-slate-400">Último cambio: {formatFechaHora(mes.ultimo_cambio)}</span>
          {!next && <CrearMesBoton className="ml-auto" />}
        </div>
      </div>

      {exceso > 0 && (
        <div role="alert" className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-[15px] dark:bg-[#1c1c1e]">
          <span className="flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[7px] bg-[#FF3B30] text-white"><Icono nombre="alerta" className="h-[18px] w-[18px]" /></span>
          <span><strong>Has gastado más de lo que ha entrado:</strong> {eur(exceso)} de más.</span>
        </div>
      )}

      <GastosRaros monthId={mes.id} />

      {/* Resumen del mes */}
      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <section className="rounded-xl bg-white p-4 dark:bg-[#1c1c1e]" aria-labelledby="titulo-saldo">
          <h2 id="titulo-saldo" className="text-[15px] text-slate-500 dark:text-slate-400">Saldo disponible</h2>
          <p className="mt-0.5 text-[34px] font-bold leading-tight tracking-tight"><Dinero c={c.saldoDisponible} dash={false} /></p>
          <p className="mt-3 text-[15px]">
            {c.ingresosTotales > 0 ? <>Has gastado el <strong>{pct} %</strong> de lo que ha entrado.</> : 'Todavía no hay ingresos este mes.'}
          </p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="meter" aria-label="Porcentaje de los ingresos gastado" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className={cx('h-full rounded-full', pct >= 100 ? 'bg-red-500' : pct >= 90 ? 'bg-amber-500' : 'bg-marino dark:bg-sky-400')} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-100 dark:border-white/10">
            <FilaResumen titulo="Ingresos" c={c.ingresosTotales} />
            <FilaResumen titulo="Gastos" c={c.gastosTotales} />
            <FilaResumen titulo="Ahorro y traspasos" c={c.ahorroTotal} />
          </div>
        </section>

        <section aria-labelledby="titulo-cuadrar" className="min-w-0">
          <h2 id="titulo-cuadrar" className="mb-1.5 px-4 text-[13px] text-slate-500 dark:text-slate-400">Cuadrar con el banco (opcional)</h2>
          <div className="overflow-hidden rounded-xl bg-white dark:bg-[#1c1c1e]">
            <FilaCampo etiqueta="Saldo real en cuenta">
              <CeldaImporte
                ariaLabel="Saldo real en cuenta"
                valor={mes.saldo_real_cuenta}
                permitirVacio
                permitirNegativo
                disabled={cerrado}
                placeholder="Vacío"
                className="w-40 text-right"
                onCambio={(v) => actualizar('months', mes.id, { saldo_real_cuenta: v })}
              />
            </FilaCampo>
            <Fila titulo="Ajuste automático" sub={`Calculado: ${eur(c.saldoCalculado, { dash: false })}`} derecha={<Dinero c={c.ajuste} verde className="text-[17px]" />} />
            {!compartida && (
              <>
                <FilaCampo etiqueta="Valor real de inversiones">
                  <CeldaImporte
                    ariaLabel="Valor real de inversiones"
                    valor={mes.valor_real_inversiones}
                    permitirVacio
                    placeholder="Vacío"
                    className="w-40 text-right"
                    onCambio={(v) => actualizar('months', mes.id, { valor_real_inversiones: v })}
                  />
                </FilaCampo>
                <Fila titulo="Inversiones acumuladas" sub={mes.valor_real_inversiones === null ? 'Estimado' : 'Valor real'} derecha={<Dinero c={c.inversionesAcum} dash={false} className="text-[17px]" />} />
                <FilaCampo etiqueta="Intereses cobrados">
                  <CeldaImporte
                    ariaLabel="Intereses cuenta remunerada"
                    valor={mes.intereses_cuenta_rem}
                    permitirVacio
                    placeholder={c.tae > 0 && !c.interesesReales ? eur(c.interesesCtaRem, { dash: false }) : 'Vacío'}
                    className="w-40 text-right"
                    onCambio={(v) => actualizar('months', mes.id, { intereses_cuenta_rem: v })}
                  />
                </FilaCampo>
                <FilaCampo etiqueta="Saldo real remunerada">
                  <CeldaImporte
                    ariaLabel="Saldo real de la cuenta remunerada"
                    valor={mes.saldo_real_remunerada}
                    permitirVacio
                    placeholder="Vacío"
                    className="w-36 text-right"
                    onCambio={(v) => actualizar('months', mes.id, { saldo_real_remunerada: v })}
                  />
                </FilaCampo>
                <Fila
                  titulo="Cuenta remunerada"
                  sub={c.ajusteCtaRem !== 0
                    ? `Ajustada ${eur(c.ajusteCtaRem, { dash: false })} con el banco`
                    : mes.saldo_real_remunerada !== null ? 'Cuadra con el banco' : textoInteresesMes(c, alMesSiguiente, eur)}
                  derecha={<Dinero c={c.cuentaRemAcum} dash={false} className="text-[17px]" />}
                />
              </>
            )}
          </div>
          <p className="mt-1.5 px-4 text-[13px] leading-snug text-slate-500 dark:text-slate-400">
            Si escribes el saldo real, la diferencia con el calculado cuenta como ingreso extra o como gasto no apuntado.
            {!compartida && ' El valor real de las inversiones sustituye a la estimación en este mes y los siguientes. Los intereses que escribas sustituyen a los estimados con la TAE. Si escribes el saldo real de la cuenta remunerada, la diferencia se ajusta sola y los meses siguientes parten de esa cifra.'}
          </p>
        </section>
      </div>

      {!compartida && <Reparto503020Card monthId={mes.id} cerrado={cerrado} />}
      {compartida && <RepartoCompartidaCard monthId={mes.id} />}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <TablaIngresos mes={mes} cerrado={cerrado} />
        <TablaAhorro mes={mes} cerrado={cerrado} />
      </div>
      <TablaGastos mes={mes} cerrado={cerrado} />
      <EstadoMes mes={mes} />
    </div>
  )
}

const corto = (fecha: string) => {
  const { anio, mes } = partes(fecha)
  return `${MESES_CORTOS[mes - 1]}${anio !== new Date().getFullYear() ? ` ${String(anio).slice(2)}` : ''}`
}

function FilaResumen({ titulo, c }: { titulo: string; c: number }) {
  return (
    <div className="ios-fila">
      <div className="ios-sep ml-3 flex min-h-11 items-center justify-between pr-3 text-[17px]">
        <span>{titulo}</span>
        <Dinero c={c} dash={false} />
      </div>
    </div>
  )
}

function Total({ etiqueta, valor, cols }: { etiqueta: string; valor: number; cols?: string }) {
  return (
    <div className={cx('mt-1 flex items-center justify-between border-t border-slate-200 px-2 pt-2.5 text-[17px] font-semibold dark:border-white/15', cols)}>
      <span>{etiqueta}</span>
      <Dinero c={valor} dash={false} />
    </div>
  )
}

/** Botón de texto con el color de la app para añadir filas («+ Añadir ingreso»). */
function BotonAnadir({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[15px] font-medium text-marino hover:bg-slate-100 dark:text-sky-300 dark:hover:bg-white/10">
      <Icono nombre="mas" className="h-4 w-4" grosor={2.4} />{children}
    </button>
  )
}

/** Cabecera de columnas de las tablas del mes. */
const claseCabecera = 'px-2 pb-1 text-[13px] text-slate-500 dark:text-slate-400'

// ---------------- Ingresos ----------------
function TablaIngresos({ mes, cerrado }: { mes: Mes; cerrado: boolean }) {
  const { datos, actualizar, insertar, borrar } = useStore()
  const pct = useCuentas().activa?.pct_aportacion
  const [params] = useSearchParams()
  const filas = datos.incomes.filter((x) => x.month_id === mes.id).sort((a, b) => a.orden - b.orden)
  const total = filas.reduce((a, b) => a + b.importe, 0)
  const focoNomina = params.get('foco') === 'nomina'
  const ord = useOrdenable(filas.length, (desde, hasta) => {
    for (const c of reordenar(filas, desde, hasta)) actualizar('incomes', c.id, { orden: c.orden })
  })
  return (
    <Card titulo="Ingresos" accion={!cerrado && (
      <BotonAnadir onClick={() => insertar('incomes', { id: uid(), month_id: mes.id, concepto: 'Nuevo ingreso', importe: 0, orden: (filas.at(-1)?.orden ?? -1) + 1 } satisfies Ingreso)}>Añadir</BotonAnadir>
    )}>
      <div className={cx('grid grid-cols-[1.25rem_minmax(0,1fr)_7.5rem_2rem] sm:grid-cols-[1.25rem_minmax(0,1fr)_9rem_2rem] gap-x-1', claseCabecera)}>
        <span /><span>Concepto</span><span className="text-right">Importe</span><span />
      </div>
      {filas.map((f, i) => {
        const auto = !!f.aportacion_de
        return (
          <div key={f.id} ref={ord.refFila(i)} style={ord.estilo(i)} className="grid min-h-11 grid-cols-[1.25rem_minmax(0,1fr)_7.5rem_2rem] sm:grid-cols-[1.25rem_minmax(0,1fr)_9rem_2rem] items-center gap-x-1 border-b border-slate-100 dark:border-white/10">
            {!cerrado ? <Asa {...ord.asa(i)} /> : <span />}
            <div className="min-w-0">
              <CeldaTexto ariaLabel="Concepto de ingreso" valor={f.concepto} disabled={cerrado || auto} onCambio={(v) => actualizar('incomes', f.id, { concepto: v })} />
              {auto && <EtiquetaAuto texto={`${pct ?? '?'} % de sus ingresos del mes, calculado automáticamente. Cambia el porcentaje en Ajustes.`} />}
            </div>
            <CeldaImporte ariaLabel={`Importe ${f.concepto}`} valor={f.importe} disabled={cerrado || auto} autoFocus={focoNomina && i === 0} onCambio={(v) => actualizar('incomes', f.id, { importe: v ?? 0 })} />
            {!cerrado && !auto ? <BotonBorrar onClick={() => borrar('incomes', f.id)} /> : <span />}
          </div>
        )
      })}
      <Total etiqueta="Total ingresos" valor={total} />
    </Card>
  )
}

/** Marca de las filas que calcula el servidor (aportaciones a la cuenta compartida). */
function EtiquetaAuto({ texto }: { texto: string }) {
  return (
    <div className="px-2">
      <span className="rounded bg-violet-100 px-1.5 text-[11px] font-semibold text-violet-800 dark:bg-violet-900/50 dark:text-violet-300" title={texto}>
        Automático
      </span>
      <span className="ml-1.5 text-[11px] text-slate-500">{texto}</span>
    </div>
  )
}

function BotonBorrar({ onClick, etiqueta = 'Borrar fila' }: { onClick: () => void; etiqueta?: string }) {
  return (
    <button type="button" aria-label={etiqueta} title={etiqueta} onClick={onClick} className="flex h-9 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40">
      <Icono nombre="cerrar" className="h-4 w-4" grosor={2} />
    </button>
  )
}

/** Barra de presupuesto: gastado frente al límite del concepto. */
function BarraPresupuesto({ g }: { g: Gasto }) {
  const eur = useEur()
  const e = estadoPresupuesto(g)
  if (!e || g.presupuesto === null) return null
  const color = e.exceso > 0 ? 'bg-red-500' : e.pct >= 0.9 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="px-2 pb-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuenow={Math.round(e.pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Barra de presupuesto de ${g.concepto}`}>
        <div className={cx('h-full rounded-full', color)} style={{ width: `${Math.min(100, e.pct * 100)}%` }} />
      </div>
      <div className={cx('num mt-0.5 text-[11px]', e.exceso > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-500')}>
        {eur(g.importe, { dash: false })} de {eur(g.presupuesto, { dash: false })}
        {e.exceso > 0 ? ` · te has pasado ${eur(e.exceso)}` : ` · quedan ${eur(g.presupuesto - g.importe, { dash: false })}`}
      </div>
    </div>
  )
}

// ---------------- Gastos (con la columna "Añadir gasto") ----------------
function TablaGastos({ mes, cerrado }: { mes: Mes; cerrado: boolean }) {
  const { datos, actualizar, insertar, borrar, aplicar, repo, avisar, obtener } = useStore()
  const eur = useEur()
  const { activa, userId } = useCuentas()
  const miembros = activa?.tipo === 'compartida' ? activa.miembros.filter((m) => m.user_id) : []
  const nombreDe = (uid: string) => {
    const m = miembros.find((x) => x.user_id === uid)
    return m ? (m.user_id === userId ? 'ti' : nombreMiembro(m)) : 'alguien'
  }
  const filas = datos.expenses.filter((x) => x.month_id === mes.id).sort((a, b) => a.orden - b.orden)
  const total = filas.reduce((a, b) => a + b.importe, 0)
  const [pendientes, setPendientes] = useState<Record<string, string>>({})
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [desglose, setDesglose] = useState<Gasto | null>(null)
  const [opcionesId, setOpcionesId] = useState<string | null>(null)
  const opciones = filas.find((g) => g.id === opcionesId) ?? null
  const nPend = Object.values(pendientes).filter((v) => v.trim() !== '').length
  const conPresupuesto = filas.filter((g) => g.presupuesto !== null)
  const totalPresupuesto = conPresupuesto.reduce((a, g) => a + (g.presupuesto ?? 0), 0)
  const gastadoConPresupuesto = conPresupuesto.reduce((a, g) => a + g.importe, 0)
  const ord = useOrdenable(filas.length, (desde, hasta) => {
    for (const c of reordenar(filas, desde, hasta)) actualizar('expenses', c.id, { orden: c.orden })
  })

  function deshacer(apunteId: string) {
    const r = deshacerApunte(obtener(), apunteId)
    if (!r.gasto) return
    aplicar(r.datos, [() => repo.borrar('expense_entries', [apunteId])], mes.id)
    actualizar('expenses', r.gasto.id, { importe: r.gasto.importe })
  }

  /** Macro SumarGasto: suma el importe escrito al gasto y vacía la casilla. */
  function sumar(g: Gasto, texto: string, silencioso = false): boolean {
    if (texto.trim() === '') return false
    const { importe: c, nota } = separarImporteNota(texto)
    if (c === null || c <= 0) {
      setErrores((e) => ({ ...e, [g.id]: 'Empieza por el importe (y, si quieres, una nota: «12,50 Mercadona»).' }))
      return false
    }
    const r = anadirGasto(obtener(), g.id, c, undefined, nota)
    aplicar(r.datos, [() => repo.insertar('expense_entries', [r.apunte])], mes.id)
    actualizar('expenses', g.id, { importe: r.gasto.importe })
    setPendientes((p) => ({ ...p, [g.id]: '' }))
    setErrores((e) => ({ ...e, [g.id]: '' }))
    if (!silencioso) {
      const e = estadoPresupuesto(r.gasto)
      const aviso = e && e.exceso > 0 ? ` (te has pasado del presupuesto en ${eur(e.exceso)})` : ''
      avisar({ texto: `Añadido ${eur(c)} a ${g.concepto}${nota ? ` («${nota}»)` : ''}${aviso}`, tipo: aviso ? 'error' : 'ok', accion: { texto: 'Deshacer', fn: () => deshacer(r.apunte.id) } })
    }
    return true
  }

  function aplicarTodos() {
    let n = 0
    for (const g of filas) if (pendientes[g.id] && sumar(g, pendientes[g.id], true)) n++
    avisar({ texto: `${n} gasto(s) añadido(s).` })
  }

  const columnas = 'md:grid-cols-[1.25rem_minmax(0,1fr)_11rem_9rem_10rem_2rem]'
  return (
    <Card
      titulo="Gastos"
      accion={
        !cerrado && (
          <div className="flex gap-2">
            {nPend > 0 && <Boton variante="primario" className="text-xs" onClick={aplicarTodos}>Sumar todos ({nPend})</Boton>}
            <BotonAnadir onClick={() => insertar('expenses', { id: uid(), month_id: mes.id, concepto: 'Nuevo gasto', fecha_vencimiento: null, importe: 0, orden: (filas.at(-1)?.orden ?? -1) + 1, fijo: false, presupuesto: null } satisfies Gasto)}>
              Añadir
            </BotonAnadir>
          </div>
        )
      }
    >
      {conPresupuesto.length > 0 && (
        <div className="mb-4 rounded-lg bg-[#f2f2f7] px-3 py-2.5 text-[15px] dark:bg-white/5">
          <div>
            Conceptos con presupuesto: <strong className="num">{eur(gastadoConPresupuesto, { dash: false })}</strong> de{' '}
            <strong className="num">{eur(totalPresupuesto, { dash: false })}</strong>
            {gastadoConPresupuesto > totalPresupuesto && <span className="font-semibold text-red-600 dark:text-red-400"> · {eur(gastadoConPresupuesto - totalPresupuesto)} por encima</span>}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" aria-hidden>
            <div
              className={cx('h-full rounded-full', gastadoConPresupuesto > totalPresupuesto ? 'bg-red-500' : gastadoConPresupuesto >= totalPresupuesto * 0.9 ? 'bg-amber-500' : 'bg-emerald-500')}
              style={{ width: `${totalPresupuesto > 0 ? Math.min(100, (gastadoConPresupuesto / totalPresupuesto) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}
      <div className={cx('hidden gap-x-1 md:grid', claseCabecera, columnas)}>
        <span />
        <span>Concepto</span>
        <span>Vencimiento</span>
        <span className="text-right">Importe</span>
        <span className="text-right">
          Añadir gasto
          <Info texto="Escribe un importe y pulsa Enter: se suma al importe de la fila y la casilla se vacía (como la macro del Excel). Puedes añadir una nota detrás: «12,50 Mercadona». Cada suma queda registrada, con su nota, y se puede deshacer." />
        </span>
        <span />
      </div>
      {filas.map((g, i) => {
        const apuntes = datos.expense_entries.filter((a) => a.expense_id === g.id)
        const auto = !!g.aportacion_cuenta
        const bloqueada = cerrado || auto
        return (
          <div
            key={g.id}
            ref={ord.refFila(i)}
            style={ord.estilo(i)}
            className={cx('grid grid-cols-[1.25rem_minmax(0,1fr)_7.5rem_2rem] items-center gap-x-1 border-b border-slate-100 py-1.5 dark:border-white/10 md:min-h-11 md:py-0.5', columnas)}
          >
            <div className="row-span-2 self-start pt-1 md:row-span-1 md:self-center md:pt-0">{!cerrado && <Asa {...ord.asa(i)} />}</div>
            <div className="min-w-0">
              <CeldaTexto ariaLabel="Concepto de gasto" valor={g.concepto} disabled={bloqueada} onCambio={(v) => actualizar('expenses', g.id, { concepto: v })} />
              {auto && <EtiquetaAuto texto="Tu aportación a la cuenta compartida: se recalcula sola al cambiar tus ingresos." />}
              {(g.fijo || apuntes.length > 0 || g.reparto) && (
                <div className="flex flex-wrap gap-2 px-2">
                  {g.fijo && <span className="rounded bg-sky-100 px-1.5 text-[11px] font-semibold text-sky-800 dark:bg-sky-900/50 dark:text-sky-300" title="Se copia con el mismo importe al crear el mes siguiente">Fijo</span>}
                  {g.reparto && (
                    <span className="rounded bg-violet-100 px-1.5 text-[11px] font-semibold text-violet-800 dark:bg-violet-900/50 dark:text-violet-300" title="Cómo se reparte este gasto">
                      {g.reparto === 'mitad' ? 'A medias' : `Lo paga ${nombreDe(g.reparto.slice(2))}`}
                    </span>
                  )}
                  {apuntes.length > 0 && (
                    <button type="button" onClick={() => setDesglose(g)} className="text-[12px] font-medium text-marino hover:underline dark:text-sky-300">
                      {apuntes.length} apunte{apuntes.length > 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              )}
              <BarraPresupuesto g={g} />
            </div>
            <div className="order-4 md:order-none">
              <CeldaFecha borrable ariaLabel={`Vencimiento ${g.concepto}`} valor={g.fecha_vencimiento} disabled={bloqueada} onCambio={(v) => actualizar('expenses', g.id, { fecha_vencimiento: v })} />
            </div>
            <div className="order-2 self-start md:order-none md:self-center">
              <CeldaImporte ariaLabel={`Importe ${g.concepto}`} valor={g.importe} disabled={bloqueada} onCambio={(v) => actualizar('expenses', g.id, { importe: v ?? 0 })} />
            </div>
            <div className="order-5 col-span-2 md:order-none md:col-span-1">
              {!bloqueada && (
                <div className="flex items-center gap-1">
                  <input
                    inputMode="decimal"
                    aria-label={`Añadir gasto a ${g.concepto}`}
                    placeholder="+ € nota"
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
                    <button type="button" aria-label="Sumar" onClick={() => sumar(g, pendientes[g.id] ?? '')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-marino text-white dark:bg-sky-700">
                      <Icono nombre="check" className="h-4 w-4" grosor={2.6} />
                    </button>
                  )}
                </div>
              )}
              {errores[g.id] && <div className="px-2 text-[11px] text-red-600">{errores[g.id]}</div>}
            </div>
            <div className="order-3 self-start justify-self-end md:order-none md:self-center">
              {!bloqueada && (
                <button
                  type="button"
                  aria-label={`Opciones de ${g.concepto}`}
                  title="Fijo, presupuesto y borrar"
                  onClick={() => setOpcionesId(g.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-marino hover:bg-slate-100 dark:text-sky-300 dark:hover:bg-white/10"
                >
                  <Icono nombre="puntos" className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        )
      })}
      <Total etiqueta="Total gastos" valor={total} />
      {!cerrado && filas.length > 1 && <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">Arrastra ⋮⋮ para reordenar. En los tres puntos puedes marcar un gasto como fijo o ponerle un presupuesto.</p>}

      <Modal abierto={!!opciones} onCerrar={() => setOpcionesId(null)} titulo={opciones ? `Opciones de «${opciones.concepto}»` : ''} pie={<Boton variante="primario" onClick={() => setOpcionesId(null)}>Listo</Boton>}>
        {opciones && (
          <>
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={opciones.fijo} onChange={(e) => actualizar('expenses', opciones.id, { fijo: e.target.checked })} />
              <span>
                <span className="font-medium">Gasto fijo</span>
                <span className="block text-xs text-slate-500">Al crear el mes siguiente se copia con el mismo importe ({eur(opciones.importe, { dash: false })}) y su fecha de vencimiento un mes después.</span>
              </span>
            </label>
            {miembros.length > 1 && (
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <label htmlFor="reparto-gasto" className="font-medium">Cómo se reparte</label>
                <span className="block text-xs text-slate-500">Proporcional = lo cubren las aportaciones de cada uno. Si no, cada uno pone su parte aparte. Se mantiene en los meses siguientes.</span>
                <select
                  id="reparto-gasto"
                  className="campo mt-2"
                  value={opciones.reparto ?? ''}
                  onChange={(e) => actualizar('expenses', opciones.id, { reparto: e.target.value || null })}
                >
                  <option value="">Proporcional (de las aportaciones)</option>
                  <option value="mitad">A medias</option>
                  {miembros.map((m) => <option key={m.user_id} value={`u:${m.user_id}`}>Lo paga {m.user_id === userId ? 'entero yo' : `entero ${nombreMiembro(m)}`}</option>)}
                </select>
              </div>
            )}
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <label htmlFor="presupuesto-gasto" className="font-medium">Presupuesto mensual</label>
              <span className="block text-xs text-slate-500">Límite para este concepto. Déjalo vacío para no tener límite. Se mantiene en los meses siguientes.</span>
              <CeldaImporte
                ariaLabel={`Presupuesto de ${opciones.concepto}`}
                valor={opciones.presupuesto}
                permitirVacio
                placeholder="Sin límite"
                className="campo mt-2 text-left"
                onCambio={(v) => actualizar('expenses', opciones.id, { presupuesto: v })}
              />
            </div>
            <Boton
              variante="fantasma"
              className="w-full text-red-600"
              onClick={() => {
                borrar('expenses', opciones.id)
                setOpcionesId(null)
              }}
            >
              Borrar esta fila
            </Boton>
          </>
        )}
      </Modal>

      <Modal abierto={!!desglose} onCerrar={() => setDesglose(null)} titulo={`Apuntes de ${desglose?.concepto ?? ''}`} pie={<Boton onClick={() => setDesglose(null)}>Cerrar</Boton>}>
        {desglose && (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {datos.expense_entries
              .filter((a) => a.expense_id === desglose.id)
              .sort((a, b) => a.creado_en.localeCompare(b.creado_en))
              .map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-slate-500">{formatFechaHora(a.creado_en)}</span>
                    <CeldaTexto
                      ariaLabel={`Nota del apunte de ${formatFechaHora(a.creado_en)}`}
                      valor={a.nota ?? ''}
                      placeholder={cerrado ? '' : 'Añadir nota…'}
                      disabled={cerrado}
                      className="-ml-2 text-sm"
                      onCambio={(v) => actualizar('expense_entries', a.id, { nota: v.trim() === '' ? null : v })}
                    />
                  </span>
                  <Dinero c={a.importe} />
                  {!cerrado ? <BotonBorrar etiqueta="Deshacer apunte" onClick={() => deshacer(a.id)} /> : <span className="w-8" />}
                </li>
              ))}
          </ul>
        )}
        <p className="text-xs text-slate-500">Importe actual de la fila: {eur(datos.expenses.find((e) => e.id === desglose?.id)?.importe ?? 0, { dash: false })}. Si lo editas a mano, los apuntes quedan solo como historial.</p>
      </Modal>
    </Card>
  )
}

// ---------------- Ahorro y traspasos ----------------
// Cada fila mueve dinero de una cuenta a otra: Desde (origen) → Hacia (tipo).
const DESDE: { valor: OrigenAhorro; texto: string }[] = [
  { valor: 'Ingresos mensuales', texto: 'Cuenta de gastos' },
  { valor: 'Cuenta remunerada', texto: 'Cuenta remunerada' },
  { valor: 'Inversiones', texto: 'Inversiones' },
]
const HACIA: { valor: TipoAhorro; texto: string }[] = [
  { valor: 'Inversiones', texto: 'Inversiones' },
  { valor: 'Cuenta remunerada', texto: 'Cuenta remunerada' },
  { valor: 'Cuenta de gastos', texto: 'Cuenta de gastos' },
]
const mismaCuenta = (origen: OrigenAhorro, tipo: TipoAhorro) => cuentaOrigen({ origen }) === cuentaDestino({ tipo })

function TablaAhorro({ mes, cerrado }: { mes: Mes; cerrado: boolean }) {
  const { datos, calc, actualizar, insertar, borrar } = useStore()
  const filas = datos.savings.filter((x) => x.month_id === mes.id).sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
  const c = calc.porId.get(mes.id)
  const hoy = hoyISO()
  const fechaDef = hoy.slice(0, 7) === mes.fecha.slice(0, 7) ? hoy : mes.fecha
  // Móvil: fecha · importe · borrar, y debajo «desde → hacia». Escritorio: todo en una fila.
  const cols = 'grid-cols-[minmax(0,1fr)_7.5rem_2rem] md:grid-cols-[8.5rem_7.5rem_minmax(9rem,1fr)_1rem_minmax(9rem,1fr)_2rem]'
  const nuevo = (origen: OrigenAhorro, tipo: TipoAhorro) =>
    insertar('savings', { id: uid(), month_id: mes.id, fecha: fechaDef, importe: 0, tipo, origen } satisfies Ahorro)
  const hayTraspasos = filas.some((f) => cuentaDestino(f) === 'gastos' || cuentaOrigen(f) !== 'gastos')
  return (
    <Card titulo="Ahorro y traspasos" accion={!cerrado && (
      <div className="flex flex-wrap justify-end gap-1">
        <BotonAnadir onClick={() => nuevo('Ingresos mensuales', 'Inversiones')}>Ahorro</BotonAnadir>
        <button type="button" onClick={() => nuevo('Cuenta remunerada', 'Cuenta de gastos')} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[15px] font-medium text-marino hover:bg-slate-100 dark:text-sky-300 dark:hover:bg-white/10">
          <Icono nombre="traspaso" className="h-4 w-4" grosor={2.2} />Traspaso
        </button>
      </div>
    )}>
      {/* En escritorio la fila necesita ~38 rem: si la columna es más estrecha, la tabla se desplaza dentro de la tarjeta */}
      <div className="overflow-x-auto">
        <div className="min-w-fit">
          <div className={cx('hidden gap-x-1 md:grid', claseCabecera, cols)}>
            <span>Fecha</span><span className="text-right">Importe</span><span className="pl-2">Desde</span><span /><span>Hacia</span><span />
          </div>
          {filas.length === 0 && <p className="px-2 py-3 text-[15px] text-slate-500 dark:text-slate-400">Sin ahorros ni traspasos este mes. Usa «Ahorro» para apuntar lo que mandas a inversiones o a la cuenta remunerada.</p>}
          {filas.map((f) => (
            <div key={f.id} className={cx('grid min-h-11 items-center gap-x-1 border-b border-slate-100 py-1 dark:border-white/10 md:py-0', cols)}>
              <CeldaFecha ariaLabel="Fecha del movimiento" valor={f.fecha} disabled={cerrado} onCambio={(v) => actualizar('savings', f.id, { fecha: v })} />
              <CeldaImporte ariaLabel="Importe del movimiento" valor={f.importe} disabled={cerrado} onCambio={(v) => actualizar('savings', f.id, { importe: v ?? 0 })} />
              <div className="col-span-3 flex items-center gap-1 md:contents">
              <select
                aria-label="Desde"
                className="celda min-w-0 flex-1"
                disabled={cerrado}
                value={f.origen}
                onChange={(e) => {
                  const origen = e.target.value as OrigenAhorro
                  // Si coincide con el destino, el destino pasa a otra cuenta
                  const tipo = mismaCuenta(origen, f.tipo) ? HACIA.find((h) => !mismaCuenta(origen, h.valor))!.valor : f.tipo
                  actualizar('savings', f.id, { origen, tipo })
                }}
              >
                {DESDE.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
              </select>
              <span className="text-center text-slate-400" aria-hidden>→</span>
              <select
                aria-label="Hacia"
                className="celda min-w-0 flex-1"
                disabled={cerrado}
                value={f.tipo}
                onChange={(e) => {
                  const tipo = e.target.value as TipoAhorro
                  const origen = mismaCuenta(f.origen, tipo) ? DESDE.find((o) => !mismaCuenta(o.valor, tipo))!.valor : f.origen
                  actualizar('savings', f.id, { origen, tipo })
                }}
              >
                {HACIA.map((h) => <option key={h.valor} value={h.valor} disabled={mismaCuenta(f.origen, h.valor)}>{h.texto}</option>)}
              </select>
              </div>
              <div className="col-start-3 row-start-1 md:col-auto md:row-auto">{!cerrado && <BotonBorrar onClick={() => borrar('savings', f.id)} />}</div>
            </div>
          ))}
        </div>
      </div>
      <Total etiqueta="Total ahorro" valor={c?.ahorroTotal ?? 0} />
      {hayTraspasos && (
        <p className="mt-2 text-xs text-slate-500">
          Los traspasos no son ingresos ni gastos: lo que llega a la cuenta de gastos suma al saldo disponible y resta del ahorro;
          los que van entre la cuenta remunerada e inversiones no cambian el saldo disponible.
        </p>
      )}
    </Card>
  )
}

// ---------------- Estado del mes ----------------
function EstadoMes({ mes }: { mes: Mes }) {
  const { datos, actualizar, borrarMes, avisar } = useStore()
  const navigate = useNavigate()
  const [confirmarReabrir, setConfirmarReabrir] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [texto, setTexto] = useState('')
  const [aceptoHueco, setAceptoHueco] = useState(false)
  const nombre = nombreMes(mes.fecha)
  const hueco = useMemo(() => borrarCreaHueco(datos, mes.id), [datos, mes.id])

  return (
    <section aria-labelledby="titulo-estado">
      <h2 id="titulo-estado" className="mb-1.5 px-4 text-[13px] text-slate-500 dark:text-slate-400">Estado del mes</h2>
      <div className="overflow-hidden rounded-xl bg-white dark:bg-[#1c1c1e]">
        <Fila titulo="Estado" derecha={<BadgeEstado estado={mes.estado} />} />
        {mes.estado === 'Abierto' ? (
          <Fila titulo="Cerrar mes…" accion="azul" onClick={() => setCerrando(true)} />
        ) : (
          <Fila titulo="Reabrir mes" accion="azul" onClick={() => setConfirmarReabrir(true)} />
        )}
      </div>
      <p className="mb-6 mt-1.5 px-4 text-[13px] leading-snug text-slate-500 dark:text-slate-400">
        {mes.estado === 'Cerrado' ? 'Mes cerrado: todo está en solo lectura.' : 'Antes de cerrarlo te enseña un repaso del mes. Al cerrarlo queda en solo lectura.'}
      </p>
      <div className="overflow-hidden rounded-xl bg-white dark:bg-[#1c1c1e]">
        <Fila titulo="Borrar mes…" accion="rojo" onClick={() => setBorrando(true)} />
      </div>
      <CierreMes mes={mes} abierto={cerrando} onCerrar={() => setCerrando(false)} />

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
    </section>
  )
}


/** Debajo de «Cuenta remunerada» en el mes: qué intereses se suman este mes y cuándo llegan los siguientes. */
function textoInteresesMes(c: MesCalculado, alMesSiguiente: boolean, eur: (x: number, o?: { dash?: boolean }) => string): string {
  const mesCorto = (indice: number) => MESES[((indice % 12) + 12) % 12].toLowerCase()
  const i = indiceMes(c.mes.fecha)
  if (c.interesesReales) return alMesSiguiente ? `Cobrado: lo de ${mesCorto(i - 1)}` : 'Lo que pagó el banco'
  if (c.interesesCtaRem > 0) return alMesSiguiente ? `Lo de ${mesCorto(i - 1)} al ${formatTae(c.tae)} TAE` : `Intereses al ${formatTae(c.tae)} TAE`
  if (alMesSiguiente && c.interesesGenerados > 0) return `${eur(c.interesesGenerados, { dash: false })} el 1 de ${mesCorto(i + 1)}`
  return c.taeMes > 0 ? `Intereses al ${formatTae(c.taeMes)} TAE` : 'Sin TAE (en Ajustes)'
}
