import { useState } from 'react'
import { useStore } from '../data/store'
import { nombreMiembro, useCuentas } from '../data/cuentas'
import { datosInforme, periodoAnio, recortar, type Periodo } from '../lib/informe'
import { aniosConMeses } from '../lib/calculos'
import { descargar } from '../lib/exportar'
import { cx } from './ui'

const CLAVE_NOMBRE = 'informe.nombre'

/** Nombre guardado en este dispositivo (modo local o sin perfil de miembro). */
export function leerNombreLocal(): string {
  try {
    return localStorage.getItem(CLAVE_NOMBRE) ?? ''
  } catch {
    return ''
  }
}
export function guardarNombreLocal(nombre: string) {
  try {
    localStorage.setItem(CLAVE_NOMBRE, nombre.trim())
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

/** Genera y descarga el informe PDF de la cuenta activa. */
export function useInformePdf() {
  const { datos, calc, avisar } = useStore()
  const { activa, userId } = useCuentas()
  const compartida = activa?.tipo === 'compartida'
  const yo = activa?.miembros.find((m) => m.user_id && m.user_id === userId)
  const [ocupado, setOcupado] = useState(false)
  // El nombre de Ajustes → tu perfil; si no hay, el último que se usó en este dispositivo
  const nombrePorDefecto = (yo ? nombreMiembro(yo) : '') || leerNombreLocal()

  async function generar(nombre: string, periodo: Periodo | null = null): Promise<boolean> {
    setOcupado(true)
    try {
      if (!yo) guardarNombreLocal(nombre)
      const { generarInformePdf, nombreArchivoInforme } = await import('../lib/informePdf')
      const cuenta = activa?.nombre ?? 'Mi cuenta'
      const inf = datosInforme(datos, calc, {
        cuenta,
        compartida,
        titular: nombre,
        miembros: compartida ? (activa?.miembros ?? []).map(nombreMiembro) : [],
        periodo,
      })
      const blob = await generarInformePdf(inf, datos)
      descargar(nombreArchivoInforme(compartida ? cuenta : nombre.trim() || cuenta, new Date(), periodo), blob, 'application/pdf')
      return true
    } catch (e) {
      avisar({ texto: `No se pudo generar el informe: ${(e as Error).message}`, tipo: 'error' })
      return false
    } finally {
      setOcupado(false)
    }
  }

  return { generar, ocupado, compartida, activa, nombrePorDefecto, meses: datos.months.length }
}

export type TipoPeriodo = 'todo' | 'anio' | 'franja'

/**
 * Elegir qué meses entran en el informe: todo, un año o una franja de mes a mes (puede abarcar
 * varios años). Devuelve el periodo elegido o null para «todo».
 */
export function useSelectorPeriodo() {
  const { calc } = useStore()
  const anios = aniosConMeses(calc)
  const primero = calc.meses[0]?.mes.fecha.slice(0, 7) ?? ''
  const ultimo = calc.meses.at(-1)?.mes.fecha.slice(0, 7) ?? ''
  const [tipo, setTipo] = useState<TipoPeriodo>('todo')
  const [anio, setAnio] = useState<number>(anios.at(-1) ?? new Date().getFullYear())
  const [desde, setDesde] = useState(primero)
  const [hasta, setHasta] = useState(ultimo)
  const periodo: Periodo | null = tipo === 'todo' ? null : tipo === 'anio' ? periodoAnio(anio) : desde && hasta ? { desde: `${desde}-01`, hasta: `${hasta}-01` } : null
  const error = tipo === 'franja' && (!desde || !hasta) ? 'Elige el mes de inicio y el de fin.' : tipo === 'franja' && desde > hasta ? 'El mes de inicio tiene que ir antes que el de fin.' : null
  const meses = recortar(calc, periodo).meses.length
  return { tipo, setTipo, anio, setAnio, anios, desde, setDesde, hasta, setHasta, primero, ultimo, periodo, error, meses }
}

/** Controles del periodo, como lista de iOS (para Ajustes › Informe PDF). */
export function SelectorPeriodo({ s }: { s: ReturnType<typeof useSelectorPeriodo> }) {
  const opciones: [TipoPeriodo, string][] = [['todo', 'Todo'], ['anio', 'Un año'], ['franja', 'De mes a mes']]
  const campo = 'bg-transparent text-right text-[17px] text-slate-600 outline-none dark:text-slate-300'
  return (
    <>
      <div className="ios-fila">
        <div className="ios-sep mx-4 py-2.5">
          <div role="radiogroup" aria-label="Periodo del informe" className="grid grid-cols-3 rounded-[9px] bg-[#eeeef0] p-0.5 dark:bg-[#2c2c2e]">
            {opciones.map(([t, txt]) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={s.tipo === t}
                onClick={() => s.setTipo(t)}
                className={cx('rounded-[7px] py-1.5 text-[13px] font-medium text-slate-900 dark:text-white', s.tipo === t && 'bg-white shadow-sm dark:bg-[#636366]')}
              >
                {txt}
              </button>
            ))}
          </div>
        </div>
      </div>
      {s.tipo === 'anio' && (
        <label className="ios-fila block">
          <span className="ios-sep ml-4 flex min-h-11 items-center justify-between gap-3 pr-4">
            <span className="text-[17px]">Año</span>
            <select className={campo} value={s.anio} onChange={(e) => s.setAnio(Number(e.target.value))}>
              {s.anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </span>
        </label>
      )}
      {s.tipo === 'franja' && (
        <>
          <label className="ios-fila block">
            <span className="ios-sep ml-4 flex min-h-11 items-center justify-between gap-3 pr-4">
              <span className="text-[17px]">Desde</span>
              <input type="month" className={campo} value={s.desde} min={s.primero} max={s.ultimo} onChange={(e) => s.setDesde(e.target.value)} />
            </span>
          </label>
          <label className="ios-fila block">
            <span className="ios-sep ml-4 flex min-h-11 items-center justify-between gap-3 pr-4">
              <span className="text-[17px]">Hasta</span>
              <input type="month" className={campo} value={s.hasta} min={s.primero} max={s.ultimo} onChange={(e) => s.setHasta(e.target.value)} />
            </span>
          </label>
        </>
      )}
    </>
  )
}
