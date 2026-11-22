// Aviso de logros nuevos y tarjeta de rachas para Inicio.
import { useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { useCuentas } from '../data/cuentas'
import { logros, nuevosLogros, rachas } from '../lib/logros'

const clave = (cuenta: string) => `presupuesto-logros-vistos:${cuenta}`

function leerVistos(cuenta: string): string[] | null {
  try {
    const s = localStorage.getItem(clave(cuenta))
    return s ? (JSON.parse(s) as string[]) : null
  } catch {
    return [] // sin almacenamiento: no se avisa de nada (para no repetir avisos)
  }
}
function guardarVistos(cuenta: string, ids: string[]) {
  try {
    localStorage.setItem(clave(cuenta), JSON.stringify(ids))
  } catch {
    /* sin almacenamiento */
  }
}

/** Avisa (una vez por dispositivo) de los logros que acabas de conseguir. */
export function AvisoLogros() {
  const { datos, calc, avisar } = useStore()
  const cuenta = useCuentas().activa?.id ?? 'local'
  const navigate = useNavigate()
  const lista = useMemo(() => logros(calc, datos), [calc, datos])
  const conseguidos = lista.filter((l) => l.conseguido).map((l) => l.id)
  const firma = conseguidos.join(',')
  useEffect(() => {
    const vistos = leerVistos(cuenta)
    const nuevos = nuevosLogros(lista, vistos)
    if (vistos === null || nuevos.length > 0) guardarVistos(cuenta, [...new Set([...(vistos ?? []), ...conseguidos])])
    if (nuevos.length === 0) return
    const texto = nuevos.length === 1 ? `${nuevos[0].icono} ¡Nuevo logro! ${nuevos[0].titulo}` : `🏅 ¡${nuevos.length} logros nuevos! ${nuevos.map((l) => l.titulo).join(', ')}`
    avisar({ texto, accion: { texto: 'Ver', fn: () => navigate('/logros') } })
  }, [cuenta, firma]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/** Tarjeta de Inicio: la racha de ahorro y cuántos logros llevas. */
export function LogrosCard() {
  const { datos, calc } = useStore()
  if (calc.meses.length === 0) return null
  const r = rachas(calc, datos).find((x) => x.id === 'ahorro')!
  const ls = logros(calc, datos)
  const n = ls.filter((l) => l.conseguido).length
  return (
    <Link to="/logros" className="rounded-xl bg-white p-3.5 active:bg-slate-100 dark:bg-[#1c1c1e] dark:active:bg-white/10 sm:p-4">
      <div className="text-[13px] text-slate-500 dark:text-slate-400">{r.actual > 0 ? '🔥 Racha de ahorro' : '🏅 Logros'}</div>
      <div className="mt-0.5 text-[22px] font-bold tracking-tight">
        {r.actual > 0 ? <>{r.actual} {r.actual === 1 ? 'mes' : 'meses'}</> : <>{n} de {ls.length}</>}
      </div>
      <div className="mt-1.5 truncate text-xs text-slate-500 dark:text-slate-400">{r.actual > 0 ? `${n} de ${ls.length} logros` : 'Ahorra este mes para empezar una racha'}</div>
    </Link>
  )
}
