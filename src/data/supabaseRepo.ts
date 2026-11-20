import type { SupabaseClient } from '@supabase/supabase-js'
import { NoAutorizadoError, type Repo } from './repo'
import type { Ahorro, ApunteGasto, Config, Deuda, Gasto, Ingreso, Mes, Tabla } from '../lib/tipos'
import { CONFIG_INICIAL } from '../lib/tipos'
import { centsToDecimal, toCents, toCentsOrNull } from '../lib/money'

// Campos que son importes (céntimos en la app, NUMERIC(12,2) en la BD)
const CAMPOS_DINERO = new Set([
  'importe', 'presupuesto', 'saldo_real_cuenta', 'valor_real_inversiones',
  'ajuste_cuenta_gastos_inicial', 'inversiones_iniciales', 'aportado_inicial_inversiones', 'cuenta_remunerada_inicial',
])
// Columnas que existen en cada tabla (lo demás no se envía)
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

async function leerTodo(sb: SupabaseClient, tabla: string, orden: string): Promise<Fila[]> {
  const res: Fila[] = []
  const PAG = 1000
  for (let desde = 0; ; desde += PAG) {
    const { data, error } = await sb.from(tabla).select('*').order(orden).order('id').range(desde, desde + PAG - 1)
    if (error) throw error
    res.push(...(data as Fila[]))
    if (!data || data.length < PAG) return res
  }
}

/** Lee las deudas. Si la migración 0004 aún no se ha ejecutado, devuelve [] para que la app siga funcionando. */
async function leerDeudas(sb: SupabaseClient): Promise<Fila[]> {
  try {
    return await leerTodo(sb, 'debts', 'fecha')
  } catch (e) {
    const err = e as { code?: string; message?: string }
    if (err.code === '42P01' || err.code === 'PGRST205') {
      console.warn('Falta la tabla "debts": ejecuta supabase/migrations/0004_deudas.sql')
      return []
    }
    throw e
  }
}

function lanzar(error: { message: string; code?: string } | null) {
  if (!error) return
  if (error.code === '42501') throw new NoAutorizadoError()
  throw new Error(error.message)
}

export function crearSupabaseRepo(sb: SupabaseClient): Repo {
  async function asegurarConfig(): Promise<Fila> {
    const { data, error } = await sb.from('config').select('*').maybeSingle()
    lanzar(error)
    if (data) return data
    const ins = await sb.from('config').insert({}).select('*').single()
    if (ins.error) {
      if (ins.error.code === '42501') throw new NoAutorizadoError()
      lanzar(ins.error)
    }
    return ins.data as Fila
  }

  return {
    modo: 'supabase',
    async cargar() {
      const cfg = await asegurarConfig()
      const [months, incomes, expenses, entries, savings, debts] = await Promise.all([
        leerTodo(sb, 'months', 'fecha'),
        leerTodo(sb, 'incomes', 'orden'),
        leerTodo(sb, 'expenses', 'orden'),
        leerTodo(sb, 'expense_entries', 'creado_en'),
        leerTodo(sb, 'savings', 'fecha'),
        leerDeudas(sb),
      ])
      const config: Config = {
        mes_inicio: String(cfg.mes_inicio),
        ajuste_cuenta_gastos_inicial: toCents(cfg.ajuste_cuenta_gastos_inicial as string),
        inversiones_iniciales: toCents(cfg.inversiones_iniciales as string),
        aportado_inicial_inversiones: toCents(cfg.aportado_inicial_inversiones as string),
        cuenta_remunerada_inicial: toCents(cfg.cuenta_remunerada_inicial as string),
        plantilla_ingresos: (cfg.plantilla_ingresos as string[]) ?? CONFIG_INICIAL.plantilla_ingresos,
        plantilla_gastos: (cfg.plantilla_gastos as string[]) ?? CONFIG_INICIAL.plantilla_gastos,
      }
      return {
        config,
        months: months.map((m): Mes => ({
          id: m.id as string,
          fecha: m.fecha as string,
          titulo: m.titulo as string,
          estado: m.estado as Mes['estado'],
          ultimo_cambio: (m.ultimo_cambio as string) ?? null,
          saldo_real_cuenta: toCentsOrNull(m.saldo_real_cuenta as string),
          valor_real_inversiones: toCentsOrNull(m.valor_real_inversiones as string),
        })),
        incomes: incomes.map((x): Ingreso => ({ id: x.id as string, month_id: x.month_id as string, concepto: x.concepto as string, importe: toCents(x.importe as string), orden: x.orden as number })),
        expenses: expenses.map((x): Gasto => ({
          id: x.id as string, month_id: x.month_id as string, concepto: x.concepto as string,
          fecha_vencimiento: (x.fecha_vencimiento as string) ?? null, importe: toCents(x.importe as string), orden: x.orden as number,
          fijo: (x.fijo as boolean) ?? false, presupuesto: toCentsOrNull(x.presupuesto as string),
        })),
        expense_entries: entries.map((x): ApunteGasto => ({ id: x.id as string, expense_id: x.expense_id as string, importe: toCents(x.importe as string), creado_en: x.creado_en as string, nota: (x.nota as string) ?? null })),
        savings: savings.map((x): Ahorro => ({
          id: x.id as string, month_id: x.month_id as string, fecha: (x.fecha as string) ?? null, importe: toCents(x.importe as string),
          tipo: x.tipo as Ahorro['tipo'], origen: x.origen as Ahorro['origen'],
        })),
        debts: debts.map((x): Deuda => ({
          id: x.id as string, persona: (x.persona as string) ?? '', concepto: (x.concepto as string) ?? '',
          importe: toCents(x.importe as string), fecha: x.fecha as string, devuelto_en: (x.devuelto_en as string) ?? null,
        })),
      }
    },
    async insertar(tabla, filas) {
      if (filas.length === 0) return
      const { error } = await sb.from(tabla).insert(filas.map((f) => aBD(tabla, f as Fila)))
      lanzar(error)
    },
    async actualizar(tabla, id, patch) {
      const p = aBD(tabla, patch)
      if (Object.keys(p).length === 0) return
      const { error } = await sb.from(tabla).update(p).eq('id', id)
      lanzar(error)
    },
    async actualizarConfig(patch) {
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
      const { error } = await sb.rpc('insertar_mes', {
        p_mes: { id: plan.mes.id, fecha: plan.mes.fecha, titulo: plan.mes.titulo },
        p_incomes: plan.incomes.map((x) => ({ id: x.id, concepto: x.concepto, orden: x.orden })),
        p_expenses: plan.expenses.map((x) => ({
          id: x.id, concepto: x.concepto, orden: x.orden, fijo: x.fijo,
          importe: centsToDecimal(x.importe), fecha_vencimiento: x.fecha_vencimiento,
          presupuesto: x.presupuesto === null ? null : centsToDecimal(x.presupuesto),
        })),
        p_cerrar: plan.cerrarMesId,
      })
      lanzar(error)
    },
    async reemplazarTodo(d) {
      // 1) borrar todos los meses (en cascada se borra todo lo demás) y las deudas
      const del = await sb.from('months').delete().not('id', 'is', null)
      lanzar(del.error)
      const delDeudas = await sb.from('debts').delete().not('id', 'is', null)
      if (delDeudas.error && d.debts.length > 0) lanzar(delDeudas.error)
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
