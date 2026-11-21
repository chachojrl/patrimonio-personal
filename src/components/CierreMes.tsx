import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import { useCuentas } from '../data/cuentas'
import { Boton, CeldaImporte, Dinero, Modal, cx } from './ui'
import { gastosRaros } from '../lib/analisis'
import { estadoPresupuesto } from '../lib/operaciones'
import { formatPct } from '../lib/money'
import { useEur } from '../lib/discreto'
import { nombreMes } from '../lib/fechas'
import type { Mes } from '../lib/tipos'
import { Icono } from './ios'

/** Repaso antes de cerrar un mes: saldo real, inversiones, pendientes y resumen. */
export function CierreMes({
  mes,
  abierto,
  onCerrar,
  onConfirmar,
  textoConfirmar = 'Cerrar el mes',
  textoCancelar = 'Ahora no',
  ocupado = false,
}: {
  mes: Mes
  abierto: boolean
  onCerrar: () => void
  /** Si se indica, sustituye a la acción normal de cerrar (p. ej. cerrar y crear el mes siguiente). */
  onConfirmar?: () => void
  textoConfirmar?: string
  textoCancelar?: string
  ocupado?: boolean
}) {
  const { datos, calc, actualizar } = useStore()
  const compartida = useCuentas().activa?.tipo === 'compartida'
  const eur = useEur()
  const c = calc.porId.get(mes.id)
  if (!c) return null
  const i = calc.meses.findIndex((m) => m.mes.id === mes.id)
  const anterior = i > 0 ? calc.meses[i - 1] : null
  const pendientesDeuda = datos.debts.filter((x) => !x.devuelto_en)
  const pasados = datos.expenses.filter((g) => g.month_id === mes.id).map((g) => ({ g, e: estadoPresupuesto(g) })).filter((x) => x.e && x.e.exceso > 0)
  const avisos = gastosRaros(datos, mes.id)
  const varGastos = anterior && anterior.gastosTotales > 0 ? c.gastosTotales / anterior.gastosTotales - 1 : null

  function cerrar() {
    if (onConfirmar) return onConfirmar()
    actualizar('months', mes.id, { estado: 'Cerrado' })
    onCerrar()
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={`Cerrar ${nombreMes(mes.fecha)}`}
      pie={
        <>
          <Boton onClick={onCerrar}>{textoCancelar}</Boton>
          <Boton variante="primario" onClick={cerrar} disabled={ocupado}>{textoConfirmar}</Boton>
        </>
      }
    >
      <div className="-mx-1 max-h-[60vh] space-y-3 overflow-y-auto px-1">
        <Paso n={1} hecho={mes.saldo_real_cuenta !== null} titulo="Saldo real del banco">
          <p className="text-xs text-slate-500">Mira tu banco y escribe lo que hay. Si no coincide con lo calculado ({eur(c.saldoCalculado, { dash: false })}), la diferencia se apunta sola.</p>
          <CeldaImporte
            ariaLabel="Saldo real en cuenta"
            valor={mes.saldo_real_cuenta}
            permitirVacio
            permitirNegativo
            placeholder="Saldo del banco"
            className="campo mt-1 text-left"
            onCambio={(v) => actualizar('months', mes.id, { saldo_real_cuenta: v })}
          />
          {c.ajuste !== 0 && (
            <p className="mt-1 text-xs">Ajuste: <Dinero c={c.ajuste} verde /> ({c.ajuste > 0 ? 'ingreso extra' : 'gasto no apuntado'}).</p>
          )}
        </Paso>

        {!compartida && (
          <Paso n={2} hecho={mes.valor_real_inversiones !== null} titulo="Valor de tus inversiones">
            <p className="text-xs text-slate-500">El valor total de la cartera hoy. En blanco se usa la estimación ({eur(c.inversionesAcum, { dash: false })}).</p>
            <CeldaImporte
              ariaLabel="Valor real de inversiones"
              valor={mes.valor_real_inversiones}
              permitirVacio
              placeholder="Valor de la cartera"
              className="campo mt-1 text-left"
              onCambio={(v) => actualizar('months', mes.id, { valor_real_inversiones: v })}
            />
          </Paso>
        )}

        <Paso n={compartida ? 2 : 3} hecho={pasados.length === 0 && avisos.length === 0 && pendientesDeuda.length === 0} titulo="Pendientes">
          <ul className="space-y-1 text-sm">
            {pasados.length === 0 && avisos.length === 0 && pendientesDeuda.length === 0 && <li className="text-slate-500">Nada pendiente.</li>}
            {pasados.map(({ g, e }) => (
              <li key={g.id}>Te has pasado del presupuesto de <strong>{g.concepto}</strong> en {eur(e!.exceso, { dash: false })}.</li>
            ))}
            {avisos.map((a) => (
              <li key={`${a.tipo}${a.concepto}${a.importe}`}>{a.tipo === 'duplicado' ? `¿Apunte duplicado en ${a.concepto}?` : `${a.concepto} va muy por encima de tu media.`}</li>
            ))}
            {pendientesDeuda.length > 0 && (
              <li>
                Te deben {eur(pendientesDeuda.reduce((s, x) => s + x.importe, 0), { dash: false })}.{' '}
                <Link to="/te-deben" onClick={onCerrar} className="text-sky-700 underline dark:text-sky-400">Revisar</Link>
              </li>
            )}
          </ul>
        </Paso>

        <Paso n={compartida ? 3 : 4} hecho titulo="Resumen del mes">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-slate-500">Ingresos</dt><dd className="text-right"><Dinero c={c.ingresosTotales} dash={false} /></dd>
            <dt className="text-slate-500">Gastos</dt>
            <dd className="text-right">
              <Dinero c={c.gastosTotales} dash={false} />
              {varGastos !== null && (
                <span className={cx('ml-1 text-xs', varGastos > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400')}>
                  {varGastos > 0 ? '▲' : '▼'} {formatPct(Math.abs(varGastos))}
                </span>
              )}
            </dd>
            <dt className="text-slate-500">Ahorro</dt><dd className="text-right"><Dinero c={c.ahorroDesdeIngresos} dash={false} /></dd>
            {c.pctAhorro !== null && (<><dt className="text-slate-500">% de ahorro</dt><dd className="text-right">{formatPct(c.pctAhorro)}</dd></>)}
            <dt className="font-medium">Saldo que pasa al mes siguiente</dt><dd className="text-right font-semibold"><Dinero c={c.saldoDisponible} dash={false} /></dd>
          </dl>
          {anterior && <p className="mt-1 text-xs text-slate-500">Comparado con {nombreMes(anterior.mes.fecha)}.</p>}
        </Paso>
        <p className="text-xs text-slate-500">Al cerrarlo queda en solo lectura. Podrás reabrirlo si hace falta.</p>
      </div>
    </Modal>
  )
}

function Paso({ n, titulo, hecho, children }: { n: number; titulo: string; hecho: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <h4 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <span className={cx('flex h-5 w-5 items-center justify-center rounded-full text-[11px]', hecho ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200')}>{hecho ? <Icono nombre="check" className="h-3 w-3" grosor={3} /> : n}</span>
        {titulo}
      </h4>
      {children}
    </section>
  )
}
