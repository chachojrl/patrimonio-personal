// Modo local (sin Supabase): los datos se guardan en este navegador. Útil para probar la app.
import type { Repo } from './repo'
import type { Datos, Tabla } from '../lib/tipos'
import { datosVacios, normalizarDatos } from '../lib/tipos'
import { aplicarPlan, borrarMes } from '../lib/operaciones'

const CLAVE = 'presupuesto-local-v1'

function leer(): Datos {
  try {
    const s = localStorage.getItem(CLAVE)
    if (s) return normalizarDatos({ ...datosVacios(), ...JSON.parse(s) })
  } catch {
    /* sin almacenamiento */
  }
  return datosVacios()
}

function escribir(d: Datos) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(d))
  } catch {
    /* sin almacenamiento */
  }
}

export function crearLocalRepo(): Repo {
  return {
    modo: 'local',
    async cargar() {
      return leer()
    },
    async insertar(tabla, filas) {
      const d = leer()
      ;(d[tabla] as object[]).push(...filas)
      escribir(d)
    },
    async actualizar(tabla, id, patch) {
      const d = leer()
      const arr = d[tabla] as { id: string }[]
      const i = arr.findIndex((x) => x.id === id)
      if (i >= 0) arr[i] = { ...arr[i], ...patch }
      escribir(d)
    },
    async actualizarConfig(patch) {
      const d = leer()
      d.config = { ...d.config, ...patch }
      escribir(d)
    },
    async borrar(tabla: Tabla, ids) {
      let d = leer()
      const set = new Set(ids)
      if (tabla === 'months') {
        for (const id of ids) d = borrarMes(d, id)
      } else if (tabla === 'expenses') {
        d.expenses = d.expenses.filter((x) => !set.has(x.id))
        d.expense_entries = d.expense_entries.filter((x) => !set.has(x.expense_id))
      } else {
        ;(d as unknown as Record<string, { id: string }[]>)[tabla] = (d[tabla] as { id: string }[]).filter((x) => !set.has(x.id))
      }
      escribir(d)
    },
    async crearMes(plan) {
      escribir(aplicarPlan(leer(), plan))
    },
    async reemplazarTodo(datos) {
      escribir(datos)
    },
  }
}
