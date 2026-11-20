import type { SupabaseClient } from '@supabase/supabase-js'
import { NoAutorizadoError, type Repo } from './repo'
import type { Ahorro, ApunteGasto, Config, Cuenta, Datos, Deuda, Gasto, Ingreso, Mes, Tabla } from '../lib/tipos'
import { CONFIG_INICIAL } from '../lib/tipos'
import { centsToDecimal, toCents, toCentsOrNull } from '../lib/money'

// Campos que son importes (céntimos en la app, NUMERIC(12,2) en la BD)
const CAMPOS_DINERO = new Set([
  'importe', 'presupuesto', 'saldo_real_cuenta', 'valor_real_inversiones',
  'ajuste_cuenta_gastos_inicial', 'inversiones_iniciales', 'aportado_inicial_inversiones', 'cuenta_remunerada_inicial',
])
// Columnas que la app escribe en cada tabla (lo demás no se envía).
// aportacion_de / aportacion_cuenta no están: las gestiona el servidor.
const COLUMNAS: Record<Tabla, string[]> = {
  months: ['id', 'fecha', 'titulo', 'estado', 'ultimo_cambio', 'saldo_real_cuenta', 'valor_real_inversiones'],
  incomes: ['id', 'month_id', 'concepto', 'importe', 'orden'],
  expenses: ['id', 'month_id', 'concepto', 'fecha_vencimiento', 'importe', 'orden', 'fijo', 'presupuesto'],
  expense_entries: ['id', 'expense_id', 'importe', 'creado_en', 'nota'],
  savings: ['id', 'month_id', 'fecha', 'importe', 'tipo', 'origen'],
  debts: ['id', 'persona', 'concepto', 'importe', 'fecha', 'devuelto_en'],
}

function aBD(tabla: Tabla | 'config', obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (tabla !== 'config' && !COLUMNAS[tabla].includes(k)) continue
    if (tabla === 'months' && k === 'ultimo_cambio') continue // lo gestionan los triggers
    out[k] = CAMPOS_DINERO.has(k) && typeof v === 'number' ? centsToDecimal(v) : v
  }
  return out
}

type Fila = Record<string, unknown>
type Error_ = { message: string; code?: string } | null

/** ¿El error es "esa tabla / función no existe todavía" (migración sin ejecutar)? */
export function faltaEnBD(error: Error_): boolean {
  return !!error && ['42P01', 'PGRST205', 'PGRST202', '42883', '42703'].includes(error.code ?? '')
}

function lanzar(error: Error_) {
  if (!error) return
  if (error.code === '42501') throw new NoAutorizadoError()
  throw new Error(error.message)
}

/**
 * Cuentas del usuario (la personal primero). Devuelve null si la base de datos aún no
 * tiene cuentas (migración 0005 sin ejecutar): la app funciona entonces como antes.
 */
export async function cargarCuentas(sb: SupabaseClient): Promise<Cuenta[] | null> {
  const { data, error } = await sb.rpc('mis_cuentas')
  if (faltaEnBD(error)) return null
  lanzar(error)
  return (data as Fila[]).map((c) => ({
    id: c.id as string,
    nombre: c.nombre as string,
    tipo: c.tipo as Cuenta['tipo'],
    aportacion_activa: Boolean(c.aportacion_activa),
    pct_aportacion: c.pct_aportacion === null || c.pct_aportacion === undefined ? null : Number(c.pct_aportacion),
    miembros: ((c.miembros as Fila[]) ?? []).map((m) => ({
      id: m.id as string, user_id: (m.user_id as string) ?? null, email: m.email as string, nombre: (m.nombre as string) ?? '',
    })),
  }))
}

export async function crearCuentaCompartida(
  sb: SupabaseClient,
  p: { nombre: string; miNombre: string; emailPareja: string; nombrePareja: string },
): Promise<string> {
  const { data, error } = await sb.rpc('crear_cuenta_compartida', {
    p_nombre: p.nombre, p_mi_nombre: p.miNombre, p_email_pareja: p.emailPareja, p_nombre_pareja: p.nombrePareja,
  })
  lanzar(error)
  return data as string
}

export async function actualizarCuenta(sb: SupabaseClient, id: string, patch: Partial<Pick<Cuenta, 'nombre' | 'aportacion_activa' | 'pct_aportacion'>>) {
  const { error } = await sb.from('cuentas').update(patch).eq('id', id)
  lanzar(error)
}

/** Borra una cuenta compartida. El servidor exige el nombre exacto como confirmación. */
export async function borrarCuentaCompartida(sb: SupabaseClient, id: string, confirmacion: string) {
  const { error } = await sb.rpc('borrar_cuenta_compartida', { p_cuenta: id, p_confirmacion: confirmacion })
  if (faltaEnBD(error)) throw new Error('Falta actualizar la base de datos: ejecuta supabase/migrations/0006_borrar_cuenta_compartida.sql en Supabase.')
  lanzar(error)
}

export async function actualizarMiembro(sb: SupabaseClient, id: string, nombre: string) {
  const { error } = await sb.from('cuenta_miembros').update({ nombre }).eq('id', id)
  lanzar(error)
}

// ---------- Filas de la BD → tipos de la app (al cargar y al recibir cambios en tiempo real) ----------
// Los importes llegan como NUMERIC: cadena "123.45" (o número): se pasan a céntimos.

function mapGasto(x: Fila): Gasto {
  return {
    id: x.id as string, month_id: x.month_id as string, concepto: x.concepto as string,
    fecha_vencimiento: (x.fecha_vencimiento as string) ?? null, importe: toCents(x.importe as string), orden: Number(x.orden),
    fijo: (x.fijo as boolean) ?? false, presupuesto: toCentsOrNull(x.presupuesto as string),
    aportacion_cuenta: (x.aportacion_cuenta as string) ?? null,
  }
}

export function mapConfig(cfg: Fila): Config {
  return {
    mes_inicio: String(cfg.mes_inicio),
    ajuste_cuenta_gastos_inicial: toCents(cfg.ajuste_cuenta_gastos_inicial as string),
    inversiones_iniciales: toCents(cfg.inversiones_iniciales as string),
    aportado_inicial_inversiones: toCents(cfg.aportado_inicial_inversiones as string),
    cuenta_remunerada_inicial: toCents(cfg.cuenta_remunerada_inicial as string),
    plantilla_ingresos: (cfg.plantilla_ingresos as string[]) ?? CONFIG_INICIAL.plantilla_ingresos,
    plantilla_gastos: (cfg.plantilla_gastos as string[]) ?? CONFIG_INICIAL.plantilla_gastos,
  }
}

export const MAPEOS: { [T in Tabla]: (x: Fila) => Datos[T][number] } = {
  months: (m): Mes => ({
    id: m.id as string,
    fecha: m.fecha as string,
    titulo: m.titulo as string,
    estado: m.estado as Mes['estado'],
    ultimo_cambio: (m.ultimo_cambio as string) ?? null,
    saldo_real_cuenta: toCentsOrNull(m.saldo_real_cuenta as string),
    valor_real_inversiones: toCentsOrNull(m.valor_real_inversiones as string),
  }),
  incomes: (x): Ingreso => ({
    id: x.id as string, month_id: x.month_id as string, concepto: x.concepto as string, importe: toCents(x.importe as string), orden: Number(x.orden),
    aportacion_de: (x.aportacion_de as string) ?? null,
  }),
  expenses: mapGasto,
  expense_entries: (x): ApunteGasto => ({ id: x.id as string, expense_id: x.expense_id as string, importe: toCents(x.importe as string), creado_en: x.creado_en as string, nota: (x.nota as string) ?? null }),
  savings: (x): Ahorro => ({
    id: x.id as string, month_id: x.month_id as string, fecha: (x.fecha as string) ?? null, importe: toCents(x.importe as string),
    tipo: x.tipo as Ahorro['tipo'], origen: x.origen as Ahorro['origen'],
  }),
  debts: (x): Deuda => ({
    id: x.id as string, persona: (x.persona as string) ?? '', concepto: (x.concepto as string) ?? '',
    importe: toCents(x.importe as string), fecha: x.fecha as string, devuelto_en: (x.devuelto_en as string) ?? null,
  }),
}

/**
 * Repositorio de una cuenta. Con cuentaId = null (base de datos sin cuentas) se comporta
 * como las versiones anteriores: todo lo que el usuario puede ver.
 */
export function crearSupabaseRepo(sb: SupabaseClient, cuentaId: string | null): Repo {
  // Filtra por la cuenta (si la hay). Tipado laxo: los builders de Supabase son genéricos muy profundos.
  const enCuenta = <T,>(q: T): T => (cuentaId ? (q as unknown as { eq(c: string, v: string): T }).eq('cuenta_id', cuentaId) : q)
  const conCuenta = (f: Fila): Fila => (cuentaId ? { ...f, cuenta_id: cuentaId } : f)

  async function leerTodo(tabla: string, orden: string): Promise<Fila[]> {
    const res: Fila[] = []
    const PAG = 1000
    for (let desde = 0; ; desde += PAG) {
      const { data, error } = await enCuenta(sb.from(tabla).select('*')).order(orden).order('id').range(desde, desde + PAG - 1)
      if (error) throw error
      res.push(...(data as Fila[]))
      if (!data || data.length < PAG) return res
    }
  }

  /** Si la migración 0004 aún no se ha ejecutado, devuelve [] para que la app siga funcionando. */
  async function leerDeudas(): Promise<Fila[]> {
    try {
      return await leerTodo('debts', 'fecha')
    } catch (e) {
      if (faltaEnBD(e as Error_)) {
        console.warn('Falta la tabla "debts": ejecuta supabase/migrations/0004_deudas.sql')
        return []
      }
      throw e
    }
  }

  async function asegurarConfig(): Promise<Fila> {
    const { data, error } = await enCuenta(sb.from('config').select('*')).maybeSingle()
    lanzar(error)
    if (data) return data
    const ins = await sb.from('config').insert(conCuenta({})).select('*').single()
    lanzar(ins.error)
    return ins.data as Fila
  }

  return {
    modo: 'supabase',
    async cargar() {
      const cfg = await asegurarConfig()
      const [months, incomes, expenses, entries, savings, debts] = await Promise.all([
        leerTodo('months', 'fecha'),
        leerTodo('incomes', 'orden'),
        leerTodo('expenses', 'orden'),
        leerTodo('expense_entries', 'creado_en'),
        leerTodo('savings', 'fecha'),
        leerDeudas(),
      ])
      return {
        config: mapConfig(cfg),
        months: months.map(MAPEOS.months),
        incomes: incomes.map(MAPEOS.incomes),
        expenses: expenses.map(MAPEOS.expenses),
        expense_entries: entries.map(MAPEOS.expense_entries),
        savings: savings.map(MAPEOS.savings),
        debts: debts.map(MAPEOS.debts),
      }
    },
    async insertar(tabla, filas) {
      if (filas.length === 0) return
      // months y debts llevan la cuenta; el resto la hereda de su mes en el servidor
      const conC = tabla === 'months' || tabla === 'debts'
      const { error } = await sb.from(tabla).insert(filas.map((f) => (conC ? conCuenta(aBD(tabla, f as Fila)) : aBD(tabla, f as Fila))))
      lanzar(error)
    },
    async actualizar(tabla, id, patch) {
      const p = aBD(tabla, patch)
      if (Object.keys(p).length === 0) return
      const { error } = await sb.from(tabla).update(p).eq('id', id)
      lanzar(error)
    },
    async actualizarConfig(patch) {
      if (cuentaId) {
        const { error } = await sb.from('config').update(aBD('config', patch as Fila)).eq('cuenta_id', cuentaId)
        lanzar(error)
        return
      }
      const { data: u } = await sb.auth.getUser()
      const { error } = await sb.from('config').update(aBD('config', patch as Fila)).eq('user_id', u.user?.id ?? '')
      lanzar(error)
    },
    async borrar(tabla, ids) {
      if (ids.length === 0) return
      const { error } = await sb.from(tabla).delete().in('id', ids)
      lanzar(error)
    },
    async crearMes(plan) {
      const args = {
        p_mes: { id: plan.mes.id, fecha: plan.mes.fecha, titulo: plan.mes.titulo },
        p_incomes: plan.incomes.map((x) => ({ id: x.id, concepto: x.concepto, orden: x.orden })),
        p_expenses: plan.expenses.map((x) => ({
          id: x.id, concepto: x.concepto, orden: x.orden, fijo: x.fijo,
          importe: centsToDecimal(x.importe), fecha_vencimiento: x.fecha_vencimiento,
          presupuesto: x.presupuesto === null ? null : centsToDecimal(x.presupuesto),
        })),
        p_cerrar: plan.cerrarMesId,
      }
      const { error } = await sb.rpc('insertar_mes', cuentaId ? { p_cuenta: cuentaId, ...args } : args)
      lanzar(error)
    },
    suscribir(alCambiar) {
      if (!cuentaId) return () => undefined
      const canal = sb.channel(`cuenta-${cuentaId}`)
      const filtro = `cuenta_id=eq.${cuentaId}`
      for (const tabla of Object.keys(MAPEOS) as Tabla[]) {
        for (const tipo of ['INSERT', 'UPDATE'] as const) {
          canal.on('postgres_changes', { event: tipo, schema: 'public', table: tabla, filter: filtro }, (p) => {
            alCambiar({ tabla, tipo, fila: MAPEOS[tabla](p.new as Fila) })
          })
        }
        // Los borrados no se pueden filtrar por cuenta: llega solo el id y se ignora si no es nuestro
        canal.on('postgres_changes', { event: 'DELETE', schema: 'public', table: tabla }, (p) => {
          const id = (p.old as Fila)?.id
          if (typeof id === 'string') alCambiar({ tabla, tipo: 'DELETE', id })
        })
      }
      canal.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'config', filter: filtro }, (p) => {
        alCambiar({ tabla: 'config', tipo: 'UPDATE', config: mapConfig(p.new as Fila) })
      })
      canal.subscribe()
      return () => {
        sb.removeChannel(canal)
      }
    },
    async leerAportaciones() {
      if (!cuentaId) return []
      const { data, error } = await sb.from('expenses').select('*').eq('cuenta_id', cuentaId).not('aportacion_cuenta', 'is', null)
      lanzar(error)
      return (data as Fila[]).map(mapGasto)
    },
    async reemplazarTodo(d: Datos) {
      // Las aportaciones automáticas no se restauran: el servidor las vuelve a calcular
      d = { ...d, incomes: d.incomes.filter((x) => !x.aportacion_de), expenses: d.expenses.filter((x) => !x.aportacion_cuenta) }
      const gastos = new Set(d.expenses.map((x) => x.id))
      d = { ...d, expense_entries: d.expense_entries.filter((x) => gastos.has(x.expense_id)) }
      // 1) borrar todos los meses de ESTA cuenta (en cascada se borra todo lo demás) y sus deudas
      const del = await enCuenta(sb.from('months').delete().not('id', 'is', null))
      lanzar(del.error)
      const delDeudas = await enCuenta(sb.from('debts').delete().not('id', 'is', null))
      if (delDeudas.error && !faltaEnBD(delDeudas.error)) lanzar(delDeudas.error)
      // 2) configuración
      await this.actualizarConfig(d.config)
      // 3) meses abiertos primero (los cerrados no admiten hijos), luego hijos, luego estados
      await this.insertar('months', d.months.map((m) => ({ ...m, estado: 'Abierto' })))
      for (const tabla of ['incomes', 'expenses', 'expense_entries', 'savings', 'debts'] as const) {
        const filas = d[tabla] as object[]
        for (let i = 0; i < filas.length; i += 500) await this.insertar(tabla, filas.slice(i, i + 500))
      }
      const cerrados = d.months.filter((m) => m.estado === 'Cerrado').map((m) => m.id)
      if (cerrados.length) {
        const { error } = await sb.from('months').update({ estado: 'Cerrado' }).in('id', cerrados)
        lanzar(error)
      }
    },
  }
}
