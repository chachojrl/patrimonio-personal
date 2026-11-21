// Datos de ejemplo: un año de meses (dic. 2025 – nov. 2026) con ingresos, gastos y ahorro,
// creados con las mismas funciones que usa la app.
import { test as base, expect, type Page } from '@playwright/test'
import { datosVacios, type Datos } from '../src/lib/tipos'
import { aplicarPlan, planMesNuevo } from '../src/lib/operaciones'

export function datosDeEjemplo(): Datos {
  let d = datosVacios()
  d.config = { ...d.config, mes_inicio: '2025-12-01', cuenta_remunerada_inicial: 600000, inversiones_iniciales: 800000, aportado_inicial_inversiones: 750000, ajuste_cuenta_gastos_inicial: 2000000 }
  for (let i = 0; i < 12; i++) d = aplicarPlan(d, planMesNuevo(d, true))
  d.months = d.months.map((m, i) => ({ ...m, estado: i < 10 ? 'Cerrado' : 'Abierto' }))
  d.incomes = d.incomes.map((x, j) => ({ ...x, importe: j % 5 === 0 ? 285000 : 0 }))
  const n = new Map<string, number>()
  d.expenses = d.expenses.map((x) => {
    const k = (n.get(x.month_id) ?? 0) + 1
    n.set(x.month_id, k)
    return { ...x, importe: k <= 4 ? 30000 + k * 5000 : 0 }
  })
  d.savings = d.months.map((m, i) => ({ id: `s${i}`, month_id: m.id, fecha: null, importe: 30000, tipo: 'Inversiones' as const, origen: 'Ingresos mensuales' as const }))
  d.debts = [{ id: 'd1', persona: 'Ana', concepto: 'Cena', importe: 4500, fecha: '2026-11-10', devuelto_en: null }]
  return d
}

/** Página con los datos de ejemplo cargados y sin la oferta del recorrido; falla si hay errores de JavaScript. */
export const test = base.extend<{ app: Page }>({
  app: async ({ page }, use) => {
    const errores: string[] = []
    page.on('pageerror', (e) => errores.push(e.message))
    await page.addInitScript((datos) => {
      // Solo la primera vez: así los cambios sobreviven a una recarga dentro de la prueba
      if (!sessionStorage.getItem('e2e')) {
        localStorage.setItem('presupuesto-local-v1', datos)
        localStorage.setItem('presupuesto-guia-vista', '1')
        sessionStorage.setItem('e2e', '1')
      }
    }, JSON.stringify(datosDeEjemplo()))
    await use(page)
    expect(errores, 'errores de JavaScript en la página').toEqual([])
  },
})
export { expect }

/** Lo que hay guardado ahora mismo en el navegador. */
export async function guardado(page: Page): Promise<Datos> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('presupuesto-local-v1') ?? '{}'))
}

export const esMovil = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768
