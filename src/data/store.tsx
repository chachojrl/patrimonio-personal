import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Repo } from './repo'
import type { Config, Datos, Tabla } from '../lib/tipos'
import { calcular, type Calculo } from '../lib/calculos'
import { aplicarCambioRemoto, aplicarPlan, borrarMes as borrarMesPuro, planMesNuevo, uid, type PlanMesNuevo } from '../lib/operaciones'

export type EstadoGuardado = 'guardado' | 'guardando' | 'error' | 'sin-conexion'

interface Toast {
  id: string
  texto: string
  tipo?: 'ok' | 'error'
  accion?: { texto: string; fn: () => void }
}

interface StoreCtx {
  datos: Datos
  calc: Calculo
  modo: Repo['modo']
  guardado: EstadoGuardado
  toasts: Toast[]
  avisar(t: Omit<Toast, 'id'>): void
  cerrarToast(id: string): void
  /** Cambia campos de una fila. Recalcula al instante y guarda con debounce de 500 ms. */
  actualizar(tabla: Tabla, id: string, patch: Record<string, unknown>): void
  insertar(tabla: Tabla, fila: object): void
  borrar(tabla: Tabla, id: string): void
  /** Aplica un cambio local arbitrario y encola las operaciones de guardado indicadas. */
  aplicar(nuevos: Datos, ops: Array<() => Promise<void>>, monthId?: string): void
  actualizarConfig(patch: Partial<Config>): void
  crearMes(cerrarAnterior: boolean): Promise<PlanMesNuevo>
  borrarMes(id: string): Promise<void>
  reemplazarTodo(d: Datos): Promise<void>
  recargar(): Promise<void>
  repo: Repo
  /** Datos actuales (no los del último render), para callbacks diferidos como "Deshacer". */
  obtener(): Datos
}

const Ctx = createContext<StoreCtx | null>(null)

export function useStore(): StoreCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useStore fuera de StoreProvider')
  return c
}

function monthIdDe(d: Datos, tabla: Tabla, fila: Record<string, unknown>): string | undefined {
  if (tabla === 'months') return fila.id as string
  if (tabla === 'expense_entries') return d.expenses.find((e) => e.id === fila.expense_id)?.month_id
  return fila.month_id as string
}

export function StoreProvider({ repo, inicial, children }: { repo: Repo; inicial: Datos; children: ReactNode }) {
  const [datos, setDatos] = useState<Datos>(inicial)
  const datosRef = useRef(datos)
  datosRef.current = datos
  const [guardado, setGuardado] = useState<EstadoGuardado>('guardado')
  const [toasts, setToasts] = useState<Toast[]>([])

  const cola = useRef<Promise<void>>(Promise.resolve())
  /** Han cambiado ingresos: al terminar de guardar, se releen las aportaciones (las calcula el servidor). */
  const ingresosCambiados = useRef(false)
  /** Última edición local de cada fila ("tabla:id" → ms): los cambios remotos no pisan lo que estás escribiendo. */
  const editadas = useRef(new Map<string, number>())
  const pendientes = useRef(0)
  const parches = useRef(new Map<string, { tabla: Tabla; id: string; patch: Record<string, unknown>; timer: ReturnType<typeof setTimeout> }>())

  const avisar = useCallback((t: Omit<Toast, 'id'>) => {
    const id = uid()
    setToasts((ts) => [...ts.slice(-2), { ...t, id }])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), t.accion ? 7000 : 4000)
  }, [])
  const cerrarToast = useCallback((id: string) => setToasts((ts) => ts.filter((x) => x.id !== id)), [])

  const recargar = useCallback(async () => {
    const d = await repo.cargar()
    setDatos(d)
  }, [repo])

  /** Encola una operación de guardado. Se ejecutan en orden, con reintentos. */
  const encolar = useCallback(
    (op: () => Promise<void>) => {
      pendientes.current++
      setGuardado('guardando')
      cola.current = cola.current.then(async () => {
        let intento = 0
        for (;;) {
          try {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
              setGuardado('sin-conexion')
              await new Promise<void>((r) => window.addEventListener('online', () => r(), { once: true }))
              setGuardado('guardando')
            }
            await op()
            break
          } catch (e) {
            intento++
            const offline = typeof navigator !== 'undefined' && !navigator.onLine
            if (offline) continue
            if (intento >= 3) {
              console.error(e)
              setGuardado('error')
              avisar({ texto: `No se pudo guardar: ${(e as Error).message}. Se recargan los datos.`, tipo: 'error' })
              try {
                await recargar()
              } catch {
                /* se reintentará al siguiente cambio */
              }
              break
            }
            await new Promise((r) => setTimeout(r, 500 * 2 ** intento))
          }
        }
        pendientes.current--
        if (pendientes.current === 0) {
          setGuardado((g) => (g === 'error' ? g : 'guardado'))
          if (ingresosCambiados.current && repo.leerAportaciones) {
            ingresosCambiados.current = false
            try {
              const nuevas = await repo.leerAportaciones()
              const d = datosRef.current
              const ids = new Set(nuevas.map((g) => g.id))
              const antes = d.expenses.filter((g) => !g.aportacion_cuenta && !ids.has(g.id))
              const actualizado = { ...d, expenses: [...antes, ...nuevas] }
              datosRef.current = actualizado
              setDatos(actualizado)
            } catch {
              /* se verá al recargar */
            }
          }
        }
      })
    },
    [avisar, recargar, repo],
  )

  /** Marca "Último cambio" del mes (equivale a la macro MarcarUltimoCambio). */
  const tocar = useCallback(
    (d: Datos, monthId: string | undefined): Datos => {
      if (!monthId) return d
      const ahora = new Date().toISOString()
      if (repo.modo === 'local') {
        // En Supabase lo hacen los triggers de la BD
        encolar(() => repo.actualizar('months', monthId, { ultimo_cambio: ahora }))
      }
      return { ...d, months: d.months.map((m) => (m.id === monthId ? { ...m, ultimo_cambio: ahora } : m)) }
    },
    [repo, encolar],
  )

  const flushParche = useCallback(
    (clave: string) => {
      const p = parches.current.get(clave)
      if (!p) return
      clearTimeout(p.timer)
      parches.current.delete(clave)
      if (p.tabla === 'incomes') ingresosCambiados.current = true
      encolar(() => repo.actualizar(p.tabla, p.id, p.patch))
    },
    [encolar, repo],
  )

  const actualizar = useCallback<StoreCtx['actualizar']>(
    (tabla, id, patch) => {
      let d = datosRef.current
      const arr = d[tabla] as unknown as Record<string, unknown>[]
      const fila = arr.find((x) => x.id === id)
      if (!fila) return
      d = { ...d, [tabla]: arr.map((x) => (x.id === id ? { ...x, ...patch } : x)) }
      const toca = tabla !== 'months' || 'titulo' in patch || 'saldo_real_cuenta' in patch
      if (toca) d = tocar(d, monthIdDe(d, tabla, fila))
      datosRef.current = d
      setDatos(d)

      const clave = `${tabla}:${id}`
      editadas.current.set(clave, Date.now())
      if (tabla === 'months' && 'estado' in patch) {
        // Al cerrar/reabrir: primero se guarda todo lo pendiente (un mes cerrado no admite cambios)
        for (const k of [...parches.current.keys()]) if (k !== clave) flushParche(k)
        const prevE = parches.current.get(clave)
        if (prevE) clearTimeout(prevE.timer)
        parches.current.delete(clave)
        const todo = { ...(prevE?.patch ?? {}), ...patch }
        encolar(() => repo.actualizar(tabla, id, todo))
        return
      }
      const prev = parches.current.get(clave)
      if (prev) clearTimeout(prev.timer)
      const merged = { tabla, id, patch: { ...(prev?.patch ?? {}), ...patch }, timer: setTimeout(() => flushParche(clave), 500) }
      parches.current.set(clave, merged)
      setGuardado('guardando')
    },
    [tocar, flushParche, encolar, repo],
  )

  const insertar = useCallback<StoreCtx['insertar']>(
    (tabla, fila) => {
      let d = datosRef.current
      if (tabla === 'incomes') ingresosCambiados.current = true
      d = { ...d, [tabla]: [...(d[tabla] as object[]), fila] }
      d = tocar(d, monthIdDe(d, tabla, fila as Record<string, unknown>))
      datosRef.current = d
      setDatos(d)
      encolar(() => repo.insertar(tabla, [fila]))
    },
    [tocar, encolar, repo],
  )

  const borrar = useCallback<StoreCtx['borrar']>(
    (tabla, id) => {
      const clave = `${tabla}:${id}`
      const p = parches.current.get(clave)
      if (p) {
        clearTimeout(p.timer)
        parches.current.delete(clave)
      }
      let d = datosRef.current
      const fila = (d[tabla] as unknown as Record<string, unknown>[]).find((x) => x.id === id)
      if (!fila) return
      if (tabla === 'incomes') ingresosCambiados.current = true
      const mid = monthIdDe(d, tabla, fila)
      d = { ...d, [tabla]: (d[tabla] as unknown as { id: string }[]).filter((x) => x.id !== id) }
      if (tabla === 'expenses') d = { ...d, expense_entries: d.expense_entries.filter((x) => x.expense_id !== id) }
      if (tabla === 'viajes') d = { ...d, viaje_gastos: d.viaje_gastos.filter((x) => x.viaje_id !== id) }
      if (tabla === 'huchas') d = { ...d, hucha_movimientos: d.hucha_movimientos.filter((x) => x.hucha_id !== id) }
      d = tocar(d, mid)
      datosRef.current = d
      setDatos(d)
      encolar(() => repo.borrar(tabla, [id]))
    },
    [tocar, encolar, repo],
  )

  const aplicar = useCallback<StoreCtx['aplicar']>(
    (nuevos, ops, monthId) => {
      const d = tocar(nuevos, monthId)
      datosRef.current = d
      setDatos(d)
      for (const op of ops) encolar(op)
    },
    [tocar, encolar],
  )

  const actualizarConfig = useCallback<StoreCtx['actualizarConfig']>(
    (patch) => {
      editadas.current.set('config', Date.now())
      const d = { ...datosRef.current, config: { ...datosRef.current.config, ...patch } }
      datosRef.current = d
      setDatos(d)
      encolar(() => repo.actualizarConfig(patch))
    },
    [encolar, repo],
  )

  /** Espera a que se guarde todo lo pendiente. */
  const vaciar = useCallback(async () => {
    for (const clave of [...parches.current.keys()]) flushParche(clave)
    await cola.current
  }, [flushParche])

  const crearMes = useCallback<StoreCtx['crearMes']>(
    async (cerrarAnterior) => {
      await vaciar()
      const plan = planMesNuevo(datosRef.current, cerrarAnterior)
      await repo.crearMes(plan)
      const d = aplicarPlan(datosRef.current, plan)
      datosRef.current = d
      setDatos(d)
      // El servidor puede haber añadido aportaciones automáticas al mes nuevo
      if (repo.leerAportaciones) await recargar().catch(() => undefined)
      return plan
    },
    [repo, vaciar, recargar],
  )

  const borrarMes = useCallback<StoreCtx['borrarMes']>(
    async (id) => {
      await vaciar()
      await repo.borrar('months', [id])
      const d = borrarMesPuro(datosRef.current, id)
      datosRef.current = d
      setDatos(d)
    },
    [repo, vaciar],
  )

  const reemplazarTodo = useCallback<StoreCtx['reemplazarTodo']>(
    async (nuevos) => {
      await vaciar()
      setGuardado('guardando')
      try {
        await repo.reemplazarTodo(nuevos)
        await recargar()
        setGuardado('guardado')
      } catch (e) {
        setGuardado('error')
        await recargar().catch(() => undefined)
        throw e
      }
    },
    [repo, vaciar, recargar],
  )

  // Avisar antes de cerrar la pestaña si hay cambios sin guardar
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (parches.current.size > 0 || pendientes.current > 0) {
        for (const clave of [...parches.current.keys()]) flushParche(clave)
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', fn)
    return () => window.removeEventListener('beforeunload', fn)
  }, [flushParche])

  useEffect(() => {
    const off = () => setGuardado('sin-conexion')
    const on = () => setGuardado(pendientes.current > 0 ? 'guardando' : 'guardado')
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    if (!navigator.onLine) off()
    return () => {
      window.removeEventListener('offline', off)
      window.removeEventListener('online', on)
    }
  }, [])

  // Tiempo real: cambios de esta cuenta hechos desde otro dispositivo (o por el servidor)
  useEffect(() => {
    if (!repo.suscribir) return
    return repo.suscribir((c) => {
      if (c.tabla === 'config' && Date.now() - (editadas.current.get('config') ?? 0) < 3000) return
      if (c.tabla !== 'config' && c.tipo !== 'DELETE') {
        const clave = `${c.tabla}:${c.fila.id}`
        // Fila con cambios sin guardar o editada hace menos de 3 s: manda lo local
        if (parches.current.has(clave) || Date.now() - (editadas.current.get(clave) ?? 0) < 3000) return
      }
      const antes = datosRef.current
      const despues = aplicarCambioRemoto(antes, c)
      if (despues === antes) return
      datosRef.current = despues
      setDatos(despues)
    })
  }, [repo])

  const calc = useMemo(() => calcular(datos), [datos])

  const value: StoreCtx = {
    datos, calc, modo: repo.modo, guardado, toasts, avisar, cerrarToast,
    actualizar, insertar, borrar, aplicar, actualizarConfig, crearMes, borrarMes, reemplazarTodo, recargar, repo,
    obtener: () => datosRef.current,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
