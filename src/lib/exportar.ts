import type { Datos } from './tipos'
import { CONFIG_INICIAL, normalizarDatos } from './tipos'
import { calcular, aniosConMeses, resumenAnual } from './calculos'
import { MESES, formatFecha, nombreMes } from './fechas'

export function descargar(nombre: string, contenido: Blob | string, tipo = 'application/octet-stream') {
  const blob = typeof contenido === 'string' ? new Blob([contenido], { type: tipo }) : contenido
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const sello = () => new Date().toISOString().slice(0, 10)

// ---------- JSON (copia completa; importes en euros con 2 decimales) ----------

const DINERO = ['importe', 'presupuesto', 'saldo_real_cuenta', 'valor_real_inversiones', 'ajuste_cuenta_gastos_inicial', 'inversiones_iniciales', 'aportado_inicial_inversiones', 'cuenta_remunerada_inicial']

function mapDinero(obj: unknown, fn: (v: number) => number): unknown {
  if (Array.isArray(obj)) return obj.map((x) => mapDinero(x, fn))
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, DINERO.includes(k) && typeof v === 'number' ? fn(v) : mapDinero(v, fn)]),
    )
  }
  return obj
}

export function exportarJSON(d: Datos): string {
  return JSON.stringify({ app: 'presupuesto', version: 1, exportado: new Date().toISOString(), datos: mapDinero(d, (c) => c / 100) }, null, 2)
}

export function importarJSON(texto: string): Datos {
  const j = JSON.parse(texto)
  if (j?.app !== 'presupuesto' || !j.datos) throw new Error('El archivo no es una copia de esta aplicación.')
  const d = mapDinero(j.datos, (e) => Math.round(e * 100)) as Datos
  for (const k of ['months', 'incomes', 'expenses', 'savings'] as const) {
    if (!Array.isArray(d[k])) throw new Error(`Falta la lista "${k}" en el archivo.`)
  }
  d.expense_entries = d.expense_entries ?? []
  d.config = { ...CONFIG_INICIAL, ...d.config }
  const ids = new Set(d.months.map((m) => m.id))
  if ([...d.incomes, ...d.expenses, ...d.savings].some((x) => !ids.has(x.month_id))) throw new Error('El archivo tiene filas que no pertenecen a ningún mes.')
  return normalizarDatos(d)
}

// ---------- CSV ----------

function csv(filas: Record<string, unknown>[]): string {
  if (filas.length === 0) return ''
  const cols = Object.keys(filas[0])
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  // Separador ";" y coma decimal: se abre bien en Excel en español
  return '﻿' + [cols.join(';'), ...filas.map((f) => cols.map((c) => esc(f[c])).join(';'))].join('\n')
}

const eurCsv = (c: number | null) => (c === null ? '' : (c / 100).toFixed(2).replace('.', ','))

export function exportarCSV(d: Datos, tabla: 'incomes' | 'expenses' | 'savings' | 'historial') {
  const nombreDe = new Map(d.months.map((m) => [m.id, nombreMes(m.fecha)]))
  let filas: Record<string, unknown>[]
  if (tabla === 'historial') {
    filas = calcular(d).historial.map((h) => {
      const c = h.calc
      return {
        fecha: formatFecha(h.fecha), hoja: h.nombre, estado: c ? 'Registrado' : 'Sin hoja',
        ingresos: c ? eurCsv(c.ingresosTotales) : '', gastos: c ? eurCsv(c.gastosTotales) : '', ahorro: c ? eurCsv(c.ahorroTotal) : '',
        saldo_disponible: c ? eurCsv(c.saldoDisponible) : '', neto: c ? eurCsv(c.neto) : '',
        inversiones_mes: c ? eurCsv(c.invMes) : '', cuenta_rem_mes: c ? eurCsv(c.ctaRemMes) : '', inv_desde_cuenta_rem: c ? eurCsv(c.invDesdeCtaRem) : '',
        inversiones_acum: c ? eurCsv(c.inversionesAcum) : '', cuenta_rem_acum: c ? eurCsv(c.cuentaRemAcum) : '',
        ahorro_acumulado: c ? eurCsv(c.ahorroAcumulado) : '', dinero_total: c ? eurCsv(c.dineroTotal) : '',
        valor_real_inversiones: c ? eurCsv(c.mes.valor_real_inversiones) : '', estado_mes: c?.mes.estado ?? '',
      }
    })
  } else if (tabla === 'incomes') {
    filas = d.incomes.map((x) => ({ mes: nombreDe.get(x.month_id), concepto: x.concepto, importe: eurCsv(x.importe) }))
  } else if (tabla === 'expenses') {
    filas = d.expenses.map((x) => ({ mes: nombreDe.get(x.month_id), concepto: x.concepto, vencimiento: formatFecha(x.fecha_vencimiento), importe: eurCsv(x.importe), presupuesto: eurCsv(x.presupuesto), fijo: x.fijo ? 'Sí' : '' }))
  } else {
    filas = d.savings.map((x) => ({ mes: nombreDe.get(x.month_id), fecha: formatFecha(x.fecha), importe: eurCsv(x.importe), tipo: x.tipo, origen: x.origen }))
  }
  descargar(`presupuesto-${tabla}-${sello()}.csv`, csv(filas), 'text/csv;charset=utf-8')
}

// ---------- Excel ----------

const FMT_EUR = '#,##0.00 "€";[Red]-#,##0.00 "€";"-"'
const FMT_PCT = '0.0%'

export async function exportarExcel(d: Datos) {
  const XLSX = await import('xlsx')
  const c = calcular(d)
  const wb = XLSX.utils.book_new()
  const e = (cents: number | null | undefined) => (cents === null || cents === undefined ? null : cents / 100)

  type Celda = string | number | null
  function hoja(nombre: string, filas: Celda[][], anchos: number[], eurCols: number[] = [], pctCols: number[] = [], desdeFila = 0) {
    const ws = XLSX.utils.aoa_to_sheet(filas)
    ws['!cols'] = anchos.map((w) => ({ wch: w }))
    for (let r = desdeFila; r < filas.length; r++) {
      for (const col of eurCols) {
        const ref = XLSX.utils.encode_cell({ r, c: col })
        if (ws[ref] && typeof ws[ref].v === 'number') ws[ref].z = FMT_EUR
      }
      for (const col of pctCols) {
        const ref = XLSX.utils.encode_cell({ r, c: col })
        if (ws[ref] && typeof ws[ref].v === 'number') ws[ref].z = FMT_PCT
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, nombre.slice(0, 31))
  }

  // Índice
  const indice: Celda[][] = [['Índice de hojas'], [], ['Hoja', 'Tipo', 'Estado', 'Ingresos', 'Gastos', 'Saldo disponible']]
  for (const anio of aniosConMeses(c)) {
    const r = resumenAnual(c, anio)
    indice.push([`Resumen ${anio}`, 'Resumen anual', '', e(r.total.ingresos), e(r.total.gastos), e(r.total.saldoDisponible)])
    for (const m of c.meses.filter((x) => x.mes.fecha.startsWith(`${anio}-`))) {
      indice.push([m.nombre, 'Mes', m.mes.estado, e(m.ingresosTotales), e(m.gastosTotales), e(m.saldoDisponible)])
    }
  }
  indice.push(['Historial', 'Historial'])
  hoja('Indice', indice, [24, 15, 11, 17, 17, 17], [3, 4, 5], [], 3)

  // Resúmenes anuales
  for (const anio of aniosConMeses(c)) {
    const r = resumenAnual(c, anio)
    const filas: Celda[][] = [[`Resumen ${anio}`], [], ['Mes', 'Ingresos', 'Gastos', 'Neto', 'Ahorro desde ingresos', '% ahorro', 'Saldo disponible', 'Dinero total']]
    for (const f of r.filas) {
      const m = f.calc
      filas.push(m ? [MESES[f.mes - 1], e(m.ingresosTotales), e(m.gastosTotales), e(m.neto), e(m.ahorroDesdeIngresos), m.pctAhorro, e(m.saldoDisponible), e(m.dineroTotal)] : [MESES[f.mes - 1]])
    }
    const t = r.total
    filas.push(['Total año', e(t.ingresos), e(t.gastos), e(t.neto), e(t.ahorroDesdeIngresos), t.pctAhorro, e(t.saldoDisponible), e(t.dineroTotal)])
    filas.push([], ['En la fila Total, saldo disponible y dinero total corresponden al último mes con datos del año.'])
    hoja(`Resumen ${anio}`, filas, [14, 14, 14, 14, 20, 10, 16, 16], [1, 2, 3, 4, 6, 7], [5], 3)
  }

  // Meses
  for (const m of c.meses) {
    const id = m.mes.id
    const filas: Celda[][] = [
      [m.mes.titulo], [m.nombre, '', 'Estado:', m.mes.estado, 'Último cambio:', m.mes.ultimo_cambio ? new Date(m.mes.ultimo_cambio).toLocaleString('es-ES') : ''], [],
      ['Ingresos mensuales totales', e(m.ingresosTotales)],
      ['Gastos mensuales totales', e(m.gastosTotales)],
      ['Ahorro mensual total', e(m.ahorroTotal)],
      ['Saldo disponible', e(m.saldoDisponible)],
      ['Ajuste de saldo (automático)', e(m.ajuste)],
      ['Saldo calculado', e(m.saldoCalculado)],
      ['Saldo real en cuenta', e(m.mes.saldo_real_cuenta)],
      ['% de ingresos gastado', m.pctGastado],
      [],
      ['INGRESOS MENSUALES', 'Importe'],
    ]
    const pctFila = 10
    for (const x of d.incomes.filter((i) => i.month_id === id).sort((a, b) => a.orden - b.orden)) filas.push([x.concepto, e(x.importe)])
    filas.push(['Total', e(m.sumIngresos)], [], ['GASTOS MENSUALES', 'Importe', 'Vencimiento', 'Presupuesto', 'Fijo'])
    for (const x of d.expenses.filter((i) => i.month_id === id).sort((a, b) => a.orden - b.orden)) filas.push([x.concepto, e(x.importe), formatFecha(x.fecha_vencimiento), e(x.presupuesto), x.fijo ? 'Sí' : ''])
    filas.push(['Total', e(m.sumGastos)], [], ['AHORRO MENSUAL', 'Importe', 'Fecha', 'Tipo', 'Origen'])
    for (const x of d.savings.filter((i) => i.month_id === id)) filas.push(['', e(x.importe), formatFecha(x.fecha), x.tipo, x.origen])
    filas.push(['Total', e(m.ahorroTotal)])
    hoja(m.nombre, filas, [30, 16, 14, 18, 20, 18], [1, 3], [], 3)
    const ws = wb.Sheets[m.nombre.slice(0, 31)]
    const ref = XLSX.utils.encode_cell({ r: pctFila, c: 1 })
    if (ws[ref]) ws[ref].z = FMT_PCT
  }

  // Historial
  const h: Celda[][] = [['Historial'], [], [
    'Fecha', 'Hoja', 'Estado', 'Ingresos', 'Gastos', 'Ahorro', 'Saldo disponible', 'Neto del mes', 'Inversiones (mes)', 'Cuenta remunerada (mes)',
    'Inversión desde cuenta rem. (mes)', 'Inversiones acum.', 'Cuenta rem. acum.', 'Ahorro acumulado', 'Dinero total', 'Valor real inversiones', 'Estado del mes',
  ]]
  for (const f of c.historial) {
    const m = f.calc
    h.push(m
      ? [formatFecha(f.fecha), f.nombre, 'Registrado', e(m.ingresosTotales), e(m.gastosTotales), e(m.ahorroTotal), e(m.saldoDisponible), e(m.neto), e(m.invMes), e(m.ctaRemMes), e(m.invDesdeCtaRem), e(m.inversionesAcum), e(m.cuentaRemAcum), e(m.ahorroAcumulado), e(m.dineroTotal), e(m.mes.valor_real_inversiones), m.mes.estado]
      : [formatFecha(f.fecha), f.nombre, 'Sin hoja'])
  }
  const k = c.kpis
  h.push([], ['Dinero total actual', e(k.dineroTotalActual)], ['Saldo inicial total', e(k.saldoInicialTotal)], ['Total en inversiones', e(k.totalInversiones)],
    ['Total invertido (aportado)', e(k.totalInvertido)], ['Ganancia/pérdida inversiones', e(k.gananciaInversiones)], ['Cuenta remunerada inicial', e(k.cuentaRemInicial)], ['Total en cuenta remunerada', e(k.totalCuentaRem)])
  hoja('Historial', h, [12, 18, 12, ...Array(13).fill(16), 12], [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], [], 3)

  XLSX.writeFile(wb, `presupuesto-${sello()}.xlsx`)
}
