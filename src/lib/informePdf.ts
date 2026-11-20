// Informe PDF de toda la cuenta: portada, gráficas, tablas y el detalle de cada mes.
// jsPDF se carga solo al generar el informe (no pesa en la app).
import type { jsPDF as JsPDF } from 'jspdf'
import type { CellHookData, UserOptions } from 'jspdf-autotable'
import type { Cents } from './money'
import { formatEUR, formatPct } from './money'
import type { Datos } from './tipos'
import { MESES_CORTOS, formatFecha, nombreMes, partes } from './fechas'
import { escalaBonita, textoPdf, type DatosInforme } from './informe'
import { cuentaDestino, cuentaOrigen } from './calculos'

type RGB = [number, number, number]
const C = {
  marino: [31, 56, 100] as RGB,
  marinoClaro: [46, 85, 151] as RGB,
  azul: [42, 120, 214] as RGB,
  naranja: [235, 104, 52] as RGB,
  verde: [27, 175, 122] as RGB,
  violeta: [124, 77, 196] as RGB,
  rojo: [205, 45, 45] as RGB,
  texto: [30, 41, 59] as RGB,
  suave: [100, 116, 139] as RGB,
  linea: [226, 232, 240] as RGB,
  fondo: [246, 248, 251] as RGB,
  blanco: [255, 255, 255] as RGB,
}

const AN = 210
const AL = 297
const M = 16 // margen
const W = AN - 2 * M
const PIE = 14 // espacio reservado para el pie de página

const eur = (c: Cents | null | undefined) => (c === null || c === undefined ? '' : textoPdf(formatEUR(c, { dash: false })))
const conSigno = (c: Cents) => (c > 0 ? '+' : '') + eur(c)
const pct = (p: number | null | undefined) => textoPdf(formatPct(p))
const mesCorto = (fecha: string) => {
  const { anio, mes } = partes(fecha)
  return `${MESES_CORTOS[mes - 1]} ${String(anio).slice(2)}`
}
const euroEje = (cents: number) => {
  const e = cents / 100
  const abs = Math.abs(e)
  if (abs >= 1_000_000) return `${(e / 1_000_000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M€`
  if (abs >= 1000) return `${(e / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} k€`
  return `${Math.round(e)} €`
}
const unir = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`)
const nombreCuenta = (o: string) => (o === 'gastos' ? 'Cuenta de gastos' : o === 'remunerada' ? 'Cuenta remunerada' : 'Inversiones')

interface Serie {
  nombre: string
  color: RGB
  valores: number[]
}

export async function generarInformePdf(inf: DatosInforme, d: Datos): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const { autoTable } = await import('jspdf-autotable')
  const doc: JsPDF = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const quien = inf.compartida ? inf.cuenta : inf.titular || inf.cuenta
  doc.setProperties({ title: textoPdf(`Informe de patrimonio · ${quien}`), author: textoPdf(inf.titular), creator: 'Presupuesto personal' })
  let y = M

  // ---------- utilidades de dibujo ----------
  const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2])
  const relleno = (c: RGB) => doc.setFillColor(c[0], c[1], c[2])
  const trazo = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2])
  function texto(s: string, x: number, yy: number, o: { tam?: number; c?: RGB; negrita?: boolean; alin?: 'left' | 'right' | 'center'; ancho?: number } = {}) {
    doc.setFont('helvetica', o.negrita ? 'bold' : 'normal')
    doc.setFontSize(o.tam ?? 9)
    color(o.c ?? C.texto)
    let t = textoPdf(s)
    if (o.ancho) while (t.length > 1 && doc.getTextWidth(t) > o.ancho) t = t.slice(0, -2) + '…'
    doc.text(t, x, yy, { align: o.alin ?? 'left' })
  }
  function nuevaPagina() {
    doc.addPage()
    y = M + 2
  }
  function sitio(h: number) {
    if (y + h > AL - PIE) nuevaPagina()
  }
  function seccion(titulo: string, sub?: string, alto = 30) {
    sitio(alto)
    relleno(C.marino)
    doc.rect(M, y - 4.2, 1.4, 6, 'F')
    texto(titulo, M + 4, y, { tam: 14, negrita: true, c: C.marino })
    y += 5
    if (sub) {
      texto(sub, M + 4, y, { tam: 8.5, c: C.suave })
      y += 5
    }
    y += 2
  }
  function tarjeta(x: number, yy: number, w: number, h: number, titulo: string, valor: string, o: { sub?: string; subColor?: RGB; grande?: boolean; acento?: RGB } = {}) {
    relleno(C.fondo)
    trazo(C.linea)
    doc.setLineWidth(0.2)
    doc.roundedRect(x, yy, w, h, 2, 2, 'FD')
    if (o.acento) {
      relleno(o.acento)
      doc.roundedRect(x, yy, 1.6, h, 0.8, 0.8, 'F')
    }
    texto(titulo.toUpperCase(), x + 4, yy + 5.5, { tam: 6.8, negrita: true, c: C.suave, ancho: w - 6 })
    texto(valor, x + 4, yy + (o.grande ? 15 : 12.5), { tam: o.grande ? 20 : 12.5, negrita: true, c: C.texto, ancho: w - 6 })
    if (o.sub) texto(o.sub, x + 4, yy + h - 3.2, { tam: 7, c: o.subColor ?? C.suave, ancho: w - 6 })
  }
  function leyenda(x: number, yy: number, series: { nombre: string; color: RGB }[]) {
    let xx = x
    for (const s of series) {
      relleno(s.color)
      doc.roundedRect(xx, yy - 2.3, 2.6, 2.6, 0.5, 0.5, 'F')
      texto(s.nombre, xx + 3.8, yy, { tam: 7.5, c: C.suave })
      doc.setFontSize(7.5)
      xx += 3.8 + doc.getTextWidth(textoPdf(s.nombre)) + 6
    }
  }

  /** Ejes y rejilla comunes. Devuelve la función que pasa un valor a coordenada Y. */
  function ejes(x: number, yy: number, w: number, h: number, min: number, max: number, fmt: (v: number) => string) {
    const esc = escalaBonita(min, max)
    const aY = (v: number) => yy + h - ((v - esc.min) / (esc.max - esc.min)) * h
    doc.setLineWidth(0.15)
    for (let v = esc.min; v <= esc.max + esc.paso / 2; v += esc.paso) {
      const py = aY(v)
      trazo(v === 0 ? [148, 163, 184] : C.linea)
      doc.setLineWidth(v === 0 ? 0.3 : 0.15)
      doc.line(x, py, x + w, py)
      texto(fmt(v), x - 1.5, py + 1, { tam: 6.5, c: C.suave, alin: 'right' })
    }
    return aY
  }
  function etiquetasX(etiquetas: string[], aX: (i: number) => number, yy: number) {
    const cada = Math.max(1, Math.ceil(etiquetas.length / 12))
    etiquetas.forEach((e, i) => {
      if (i % cada === 0 || i === etiquetas.length - 1) texto(e, aX(i), yy, { tam: 6.5, c: C.suave, alin: 'center' })
    })
  }

  function grafLineas(titulo: string, etiquetas: string[], series: Serie[], h = 62, o: { area?: boolean; fmt?: (v: number) => string } = {}) {
    sitio(h + 14)
    texto(titulo, M, y, { tam: 10, negrita: true })
    if (series.length > 1) leyenda(M, y + 5, series)
    const top = y + (series.length > 1 ? 9 : 4)
    const px = M + 16
    const pw = W - 18
    const ph = h - 12
    const todos = series.flatMap((s) => s.valores)
    const aY = ejes(px, top, pw, ph, Math.min(...todos), Math.max(...todos), o.fmt ?? euroEje)
    const n = etiquetas.length
    const aX = (i: number) => (n === 1 ? px + pw / 2 : px + 3 + (i / (n - 1)) * (pw - 6))
    series.forEach((s, si) => {
      const pts = s.valores.map((v, i) => [aX(i), aY(v)] as const)
      if (o.area && si === 0 && pts.length > 1) {
        const base = aY(Math.max(escalaBonita(Math.min(...todos), Math.max(...todos)).min, 0))
        const deltas: [number, number][] = [[0, pts[0][1] - base]]
        for (let i = 1; i < pts.length; i++) deltas.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]])
        deltas.push([0, base - pts[pts.length - 1][1]])
        doc.saveGraphicsState()
        doc.setGState(doc.GState({ opacity: 0.12 }))
        relleno(s.color)
        doc.lines(deltas, pts[0][0], base, [1, 1], 'F', true)
        doc.restoreGraphicsState()
      }
      trazo(s.color)
      doc.setLineWidth(si === 0 ? 0.8 : 0.55)
      for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])
      if (n <= 24) {
        relleno(s.color)
        for (const [cx, cy] of pts) doc.circle(cx, cy, si === 0 ? 0.8 : 0.6, 'F')
      }
    })
    etiquetasX(etiquetas, aX, top + ph + 4.5)
    y = top + ph + 10
  }

  function grafBarras(titulo: string, etiquetas: string[], series: Serie[], h = 58, o: { fmt?: (v: number) => string; referencia?: { valor: number; texto: string } } = {}) {
    sitio(h + 14)
    texto(titulo, M, y, { tam: 10, negrita: true })
    if (series.length > 1) leyenda(M, y + 5, series)
    const top = y + (series.length > 1 ? 9 : 4)
    const px = M + 16
    const pw = W - 18
    const ph = h - 12
    const todos = series.flatMap((s) => s.valores).concat(o.referencia ? [o.referencia.valor] : [])
    const aY = ejes(px, top, pw, ph, Math.min(...todos), Math.max(...todos), o.fmt ?? euroEje)
    const n = etiquetas.length
    const hueco = pw / n
    const anchoGrupo = Math.min(hueco * 0.72, 16)
    const anchoBarra = anchoGrupo / series.length
    const aX = (i: number) => px + hueco * (i + 0.5)
    etiquetas.forEach((_, i) => {
      series.forEach((s, si) => {
        const v = s.valores[i]
        if (!v) return
        const x0 = aX(i) - anchoGrupo / 2 + si * anchoBarra
        const y0 = aY(Math.max(v, 0))
        const alto = Math.abs(aY(v) - aY(0))
        relleno(v < 0 && series.length === 1 ? C.rojo : s.color)
        doc.rect(x0 + 0.15, y0, Math.max(anchoBarra - 0.3, 0.3), Math.max(alto, 0.2), 'F')
      })
    })
    if (o.referencia) {
      const ry = aY(o.referencia.valor)
      trazo(C.verde)
      doc.setLineWidth(0.35)
      doc.setLineDashPattern([1.2, 1], 0)
      doc.line(px, ry, px + pw, ry)
      doc.setLineDashPattern([], 0)
      relleno(C.blanco)
      doc.setFontSize(6.5)
      doc.rect(px + 0.5, ry - 3.6, doc.getTextWidth(textoPdf(o.referencia.texto)) + 2, 3, 'F')
      texto(o.referencia.texto, px + 1.5, ry - 1.2, { tam: 6.5, negrita: true, c: C.verde })
    }
    etiquetasX(etiquetas, aX, top + ph + 4.5)
    y = top + ph + 10
  }

  function grafBarrasH(titulo: string, items: { etiqueta: string; valor: Cents; gris?: boolean }[], total: Cents, colorBarra: RGB) {
    const fila = 6.2
    sitio(items.length * fila + 12)
    texto(titulo, M, y, { tam: 10, negrita: true })
    y += 5
    const etW = 52
    const valW = 34
    const bx = M + etW + 2
    const bw = W - etW - valW - 4
    const max = Math.max(...items.map((i) => i.valor), 1)
    for (const it of items) {
      texto(it.etiqueta, M, y + 3.4, { tam: 7.8, ancho: etW })
      relleno(C.fondo)
      doc.roundedRect(bx, y + 0.6, bw, 3.8, 0.8, 0.8, 'F')
      relleno(it.gris ? [176, 186, 201] : colorBarra)
      doc.roundedRect(bx, y + 0.6, Math.max((it.valor / max) * bw, 0.8), 3.8, 0.8, 0.8, 'F')
      texto(eur(it.valor), M + W - 11, y + 3.4, { tam: 7.8, negrita: true, alin: 'right' })
      texto(pct(total ? it.valor / total : null), M + W, y + 3.4, { tam: 6.8, c: C.suave, alin: 'right' })
      y += fila
    }
    y += 4
  }

  function tabla(o: Omit<UserOptions, 'startY'> & { negativos?: number[]; derecha?: number[] }) {
    const { negativos = [], derecha = [], ...resto } = o
    const columnStyles: UserOptions['columnStyles'] = { ...(resto.columnStyles ?? {}) }
    for (const i of derecha) columnStyles[i] = { halign: 'right', ...(columnStyles[i] ?? {}) }
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: PIE + 2, top: M + 2 },
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 7.8, cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 }, textColor: C.texto, lineColor: C.linea, overflow: 'ellipsize' },
      headStyles: { fillColor: C.marino, textColor: C.blanco, fontStyle: 'bold', fontSize: 7.5 },
      footStyles: { fillColor: [235, 240, 247], textColor: C.marino, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: C.fondo },
      ...resto,
      columnStyles,
      didParseCell: (h: CellHookData) => {
        if (h.section !== 'body' && derecha.includes(h.column.index)) h.cell.styles.halign = 'right'
        if (h.section !== 'head' && negativos.includes(h.column.index) && String(h.cell.raw ?? '').trim().startsWith('-')) h.cell.styles.textColor = C.rojo
        resto.didParseCell?.(h)
      },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }
  const filas = (xs: (string | number)[][]) => xs.map((r) => r.map((c) => (typeof c === 'string' ? textoPdf(c) : c)))

  const k = inf.kpis
  const meses = inf.meses
  const etiquetas = meses.map((m) => mesCorto(m.mes.fecha))
  const periodo = inf.desde && inf.hasta
    ? `${nombreMes(inf.desde)} – ${nombreMes(inf.hasta)} · ${meses.length} ${meses.length === 1 ? 'mes' : 'meses'}`
    : 'Todavía no hay ningún mes'

  // ================= PORTADA =================
  relleno(C.marino)
  doc.rect(0, 0, AN, 64, 'F')
  doc.saveGraphicsState()
  doc.setGState(doc.GState({ opacity: 0.35 }))
  relleno(C.marinoClaro)
  doc.circle(AN - 12, 10, 38, 'F')
  doc.circle(AN - 52, 50, 9, 'F')
  doc.restoreGraphicsState()
  // Título: tu nombre en la cuenta personal; el nombre de la cuenta (y quiénes sois) en la compartida
  const titulo = inf.compartida ? inf.cuenta : inf.titular || inf.cuenta
  const subtitulo = inf.compartida
    ? (inf.miembros.length ? `Cuenta compartida de ${unir(inf.miembros)}` : 'Cuenta compartida')
    : inf.titular ? 'Cuenta personal' : ''
  texto('INFORME DE PATRIMONIO', M, 20, { tam: 9, negrita: true, c: [180, 198, 230] })
  texto(titulo, M, 32, { tam: 26, negrita: true, c: C.blanco, ancho: W - 20 })
  if (subtitulo) texto(subtitulo, M, 39.5, { tam: 10.5, negrita: true, c: [214, 224, 242], ancho: W - 20 })
  texto(periodo, M, 47, { tam: 10, c: [214, 224, 242] })
  texto(`Generado el ${inf.generado.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`, M, 54, { tam: 8.5, c: [180, 198, 230] })
  y = 74

  // Dinero total (destacado)
  tarjeta(M, y, W, 24, 'Dinero total actual', eur(k.dineroTotal), {
    grande: true,
    acento: C.marino,
    sub: inf.compartida ? undefined : `${conSigno(k.variacion)} desde el inicio (partías de ${eur(k.saldoInicial)})`,
    subColor: k.variacion >= 0 ? C.verde : C.rojo,
  })
  y += 29

  type Carta = [string, string, { sub?: string; subColor?: RGB; acento?: RGB }]
  const cartas: Carta[] = inf.compartida
    ? [
        ['Saldo disponible', eur(k.saldoDisponible), { acento: C.verde }],
        ['Ingresos acumulados', eur(k.ingresos), { acento: C.azul }],
        ['Gastos acumulados', eur(k.gastos), { acento: C.naranja }],
        ['Neto acumulado', eur(k.ingresos - k.gastos), { acento: C.violeta }],
      ]
    : [
        ['Saldo disponible', eur(k.saldoDisponible), { acento: C.verde }],
        ['Inversiones', eur(k.inversiones), { acento: C.azul, sub: `Aportado ${eur(k.totalInvertido)} · ${conSigno(k.gananciaInversiones)}`, subColor: k.gananciaInversiones >= 0 ? C.verde : C.rojo }],
        ['Cuenta remunerada', eur(k.cuentaRemunerada), { acento: C.violeta }],
        ['Ingresos acumulados', eur(k.ingresos), { acento: C.azul }],
        ['Gastos acumulados', eur(k.gastos), { acento: C.naranja }],
        ['Ahorro desde ingresos', eur(k.ahorroDesdeIngresos), { acento: C.verde, sub: k.pctAhorro === null ? undefined : `${pct(k.pctAhorro)} de lo ingresado` }],
      ]
  const porFila = inf.compartida ? 2 : 3
  const gap = 4
  const cw = (W - gap * (porFila - 1)) / porFila
  cartas.forEach(([t, v, o], i) => {
    tarjeta(M + (i % porFila) * (cw + gap), y + Math.floor(i / porFila) * 23, cw, 19, t, v, o)
  })
  y += Math.ceil(cartas.length / porFila) * 23 + 3

  if (inf.destacados.length) {
    const dw = (W - gap * (inf.destacados.length - 1)) / inf.destacados.length
    inf.destacados.forEach((x, i) => {
      const dx = M + i * (dw + gap)
      relleno([235, 240, 247])
      doc.roundedRect(dx, y, dw, 13, 2, 2, 'F')
      texto(x.titulo, dx + 3.5, y + 5, { tam: 6.8, c: C.suave, ancho: dw - 6 })
      texto(x.texto, dx + 3.5, y + 10, { tam: 9, negrita: true, c: C.marino, ancho: dw - 6 })
    })
    y += 20
  }

  if (meses.length > 0) {
    grafLineas(inf.compartida ? 'Evolución del saldo disponible' : 'Evolución del dinero total', etiquetas,
      [{ nombre: inf.compartida ? 'Saldo disponible' : 'Dinero total', color: C.marino, valores: meses.map((m) => (inf.compartida ? m.saldoDisponible : m.dineroTotal)) }],
      Math.max(50, AL - PIE - y - 15), { area: true })
  } else {
    texto('Todavía no hay meses: el informe se irá llenando a medida que apuntes.', M, y + 6, { c: C.suave })
  }

  if (meses.length > 0) {
    // ================= EVOLUCIÓN =================
    nuevaPagina()
    seccion('Evolución mes a mes', 'Cómo han cambiado tus cuentas y tus ingresos y gastos en cada mes.')
    if (!inf.compartida) {
      grafLineas('Dónde está tu dinero', etiquetas, [
        { nombre: 'Dinero total', color: C.marino, valores: meses.map((m) => m.dineroTotal) },
        { nombre: 'Inversiones', color: C.azul, valores: meses.map((m) => m.inversionesAcum) },
        { nombre: 'Cuenta remunerada', color: C.violeta, valores: meses.map((m) => m.cuentaRemAcum) },
        { nombre: 'Saldo disponible', color: C.verde, valores: meses.map((m) => m.saldoDisponible) },
      ], 72)
    }
    grafBarras('Ingresos y gastos', etiquetas, [
      { nombre: 'Ingresos', color: C.azul, valores: meses.map((m) => m.ingresosTotales) },
      { nombre: 'Gastos', color: C.naranja, valores: meses.map((m) => m.gastosTotales) },
    ], 66)
    const conIngresos = meses.map((m) => (m.pctAhorro === null ? 0 : m.pctAhorro * 100))
    grafBarras('Porcentaje de ahorro sobre lo ingresado', etiquetas, [{ nombre: '% ahorro', color: C.verde, valores: conIngresos }], 56, {
      fmt: (v) => `${Math.round(v)} %`,
      referencia: inf.compartida ? undefined : { valor: 20, texto: 'Objetivo 20 %' },
    })

    // ================= GASTOS POR CONCEPTO =================
    if (inf.gastosPorConcepto.length) {
      nuevaPagina()
      seccion('¿En qué se va el dinero?', `Gastos de todo el periodo agrupados por concepto. Total: ${eur(k.gastos)}.`)
      const top: { etiqueta: string; valor: Cents; gris?: boolean }[] = inf.gastosPorConcepto.slice(0, 10).map((g) => ({ etiqueta: g.concepto, valor: g.total }))
      const resto = inf.gastosPorConcepto.slice(10).reduce((a, g) => a + g.total, 0)
      if (resto > 0) top.push({ etiqueta: `Resto (${inf.gastosPorConcepto.length - 10} conceptos)`, valor: resto, gris: true })
      grafBarrasH('Principales gastos', top, k.gastos, C.naranja)
      tabla({
        head: [['Concepto', 'Total', '% del gasto', 'Meses', 'Media por mes']],
        body: filas(inf.gastosPorConcepto.map((g) => [g.concepto, eur(g.total), pct(k.gastos ? g.total / k.gastos : null), String(g.meses), eur(Math.round(g.total / Math.max(1, g.meses)))])),
        foot: filas([['Total', eur(k.gastos), '100,0 %', '', '']]),
        derecha: [1, 2, 3, 4],
        columnStyles: { 0: { cellWidth: 70 } },
      })
    }
    if (inf.ingresosPorConcepto.length) {
      seccion('¿De dónde viene?', `Ingresos de todo el periodo por fuente. Total: ${eur(k.ingresos)}.`)
      tabla({
        head: [['Fuente', 'Total', '% de lo ingresado', 'Meses', 'Media por mes']],
        body: filas(inf.ingresosPorConcepto.map((g) => [g.concepto, eur(g.total), pct(k.ingresos ? g.total / k.ingresos : null), String(g.meses), eur(Math.round(g.total / Math.max(1, g.meses)))])),
        foot: filas([['Total', eur(k.ingresos), '100,0 %', '', '']]),
        derecha: [1, 2, 3, 4],
        columnStyles: { 0: { cellWidth: 70 } },
      })
    }

    // ================= AÑOS E HISTORIAL =================
    nuevaPagina()
    seccion('Resumen por año')
    tabla({
      head: [['Año', 'Ingresos', 'Gastos', 'Neto', 'Ahorro', '% ahorro', 'Saldo final', 'Dinero total'].slice(0, inf.compartida ? 7 : 8)],
      body: filas(inf.anios.map((a) => [String(a.anio), eur(a.total.ingresos), eur(a.total.gastos), eur(a.total.neto), eur(a.total.ahorroDesdeIngresos), pct(a.total.pctAhorro), eur(a.total.saldoDisponible), eur(a.total.dineroTotal)].slice(0, inf.compartida ? 7 : 8))),
      derecha: [1, 2, 3, 4, 5, 6, 7],
      negativos: [3, 4, 6],
    })
    seccion('Historial mensual', 'Una fila por mes. Ahorro = lo que pasó de la cuenta de gastos al ahorro (negativo si sacaste más).')
    tabla(inf.compartida
      ? {
          head: [['Mes', 'Estado', 'Ingresos', 'Gastos', 'Neto', 'Saldo disponible']],
          body: filas(meses.map((m) => [m.nombre, m.mes.estado, eur(m.ingresosTotales), eur(m.gastosTotales), eur(m.neto), eur(m.saldoDisponible)])),
          derecha: [2, 3, 4, 5],
          negativos: [4, 5],
        }
      : {
          head: [['Mes', 'Ingresos', 'Gastos', 'Ahorro', '% ahorro', 'Saldo disp.', 'Inversiones', 'Cta. rem.', 'Dinero total']],
          body: filas(meses.map((m) => [m.nombre, eur(m.ingresosTotales), eur(m.gastosTotales), eur(m.ahorroDesdeIngresos), pct(m.pctAhorro), eur(m.saldoDisponible), eur(m.inversionesAcum), eur(m.cuentaRemAcum), eur(m.dineroTotal)])),
          derecha: [1, 2, 3, 4, 5, 6, 7, 8],
          negativos: [3, 4, 5],
          styles: { font: 'helvetica', fontSize: 6.9, cellPadding: { top: 1.4, bottom: 1.4, left: 1.4, right: 1.4 }, textColor: C.texto, overflow: 'ellipsize' },
          columnStyles: { 0: { cellWidth: 26 }, 8: { fontStyle: 'bold' } },
        })
  }

  // ================= TE DEBEN Y VIAJES =================
  if (inf.deudasPendientes.length) {
    const total = inf.deudasPendientes.reduce((a, x) => a + x.importe, 0)
    seccion('Te deben', 'Dinero pendiente de que te devuelvan. No se suma al dinero total.')
    tabla({
      head: [['Persona', 'Concepto', 'Desde', 'Importe']],
      body: filas(inf.deudasPendientes.map((x) => [x.persona, x.concepto, formatFecha(x.fecha), eur(x.importe)])),
      foot: filas([['Total', '', '', eur(total)]]),
      derecha: [3],
    })
  }
  if (inf.viajes.length) {
    seccion('Viajes', 'Gastos de cada viaje pasados a euros.')
    tabla({
      head: [['Viaje', 'Fechas', 'Gastado', 'Presupuesto', 'Media por día']],
      body: filas(inf.viajes.map(({ viaje: v, resumen: r }) => [
        v.nombre,
        v.fecha_inicio ? `${formatFecha(v.fecha_inicio)}${v.fecha_fin ? ` – ${formatFecha(v.fecha_fin)}` : ''}` : '',
        eur(r.total),
        v.presupuesto === null ? '' : `${eur(v.presupuesto)}${r.pct !== null ? ` (${pct(r.pct)})` : ''}`,
        r.dias ? eur(r.mediaDiaria) : '',
      ])),
      derecha: [2, 3, 4],
    })
  }

  // ================= DETALLE DE CADA MES =================
  if (meses.length > 0) {
    nuevaPagina()
    seccion('Detalle de cada mes', 'Todo lo apuntado, mes a mes. Se omiten los conceptos a 0.')
    for (const m of meses) {
      const ing = d.incomes.filter((x) => x.month_id === m.mes.id && x.importe !== 0).sort((a, b) => a.orden - b.orden)
      const gas = d.expenses.filter((x) => x.month_id === m.mes.id && x.importe !== 0).sort((a, b) => a.orden - b.orden)
      const aho = d.savings.filter((x) => x.month_id === m.mes.id && x.importe !== 0).sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
      sitio(34)
      relleno([235, 240, 247])
      doc.roundedRect(M, y - 4.5, W, 12.5, 1.5, 1.5, 'F')
      texto(m.nombre, M + 3, y + 0.5, { tam: 11, negrita: true, c: C.marino })
      texto(m.mes.estado, M + W - 3, y + 0.5, { tam: 7.5, negrita: true, c: m.mes.estado === 'Cerrado' ? C.suave : C.verde, alin: 'right' })
      texto(`Ingresos ${eur(m.ingresosTotales)}   ·   Gastos ${eur(m.gastosTotales)}   ·   Ahorro ${eur(m.ahorroDesdeIngresos)}   ·   Saldo disponible ${eur(m.saldoDisponible)}`,
        M + 3, y + 5.6, { tam: 7.3, c: C.suave, ancho: W - 6 })
      y += 11

      const cuerpo: (string | { content: string; colSpan: number; styles: object })[][] = []
      const cabecera = (t: string) => cuerpo.push([{ content: textoPdf(t), colSpan: 3, styles: { fontStyle: 'bold', textColor: C.marino, fillColor: C.blanco, fontSize: 7.6 } }])
      if (ing.length) {
        cabecera('Ingresos')
        for (const x of ing) cuerpo.push([textoPdf(x.concepto), x.aportacion_de ? 'Aportación automática' : '', eur(x.importe)])
      }
      if (gas.length) {
        cabecera('Gastos')
        for (const g of gas) {
          const notas = [
            g.fecha_vencimiento ? `vence ${formatFecha(g.fecha_vencimiento)}` : '',
            g.presupuesto !== null ? `presupuesto ${eur(g.presupuesto)}` : '',
            g.fijo ? 'fijo' : '',
            g.aportacion_cuenta ? 'aportación automática' : '',
          ].filter(Boolean).join(' · ')
          cuerpo.push([textoPdf(g.concepto), textoPdf(notas), eur(g.importe)])
        }
      }
      if (aho.length) {
        cabecera('Ahorro y traspasos')
        for (const a of aho) cuerpo.push([`${nombreCuenta(cuentaOrigen(a))} -> ${nombreCuenta(cuentaDestino(a))}`, a.fecha ? formatFecha(a.fecha) : '', eur(a.importe)])
      }
      if (m.ajuste !== 0) {
        cabecera('Ajuste con el saldo real del banco')
        cuerpo.push([m.ajuste > 0 ? 'Ingreso extra' : 'Gasto no apuntado', `saldo real ${eur(m.mes.saldo_real_cuenta)}`, eur(Math.abs(m.ajuste))])
      }
      if (!cuerpo.length) {
        texto('Sin movimientos.', M + 3, y + 2, { tam: 8, c: C.suave })
        y += 9
        continue
      }
      tabla({
        body: cuerpo,
        derecha: [2],
        alternateRowStyles: {},
        styles: { font: 'helvetica', fontSize: 7.6, cellPadding: { top: 1.1, bottom: 1.1, left: 3, right: 2 }, textColor: C.texto, lineColor: C.linea, lineWidth: { bottom: 0.1 }, overflow: 'ellipsize' },
        columnStyles: { 0: { cellWidth: 72 }, 1: { textColor: C.suave, fontSize: 6.8 }, 2: { cellWidth: 30 } },
      })
      y -= 2
    }
  }

  // ================= PIE DE PÁGINA =================
  const total = doc.getNumberOfPages()
  for (let i = 2; i <= total; i++) {
    doc.setPage(i)
    trazo(C.linea)
    doc.setLineWidth(0.2)
    doc.line(M, AL - 10, AN - M, AL - 10)
    texto(`Informe de patrimonio · ${quien}`, M, AL - 6, { tam: 7, c: C.suave, ancho: W - 30 })
    texto(`Página ${i} de ${total}`, AN - M, AL - 6, { tam: 7, c: C.suave, alin: 'right' })
  }

  return doc.output('blob')
}

export function nombreArchivoInforme(cuenta: string, fecha = new Date()): string {
  const slug = cuenta.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'cuenta'
  return `informe-${slug}-${fecha.toISOString().slice(0, 10)}.pdf`
}
