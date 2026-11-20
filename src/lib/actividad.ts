// Historial de cambios: convierte lo que apunta la base de datos (tabla «cambios») en frases.
import { nombreMes } from './fechas'

export interface Cambio {
  id: number
  user_id: string | null
  tabla: string
  fila_id: string | null
  accion: 'alta' | 'cambio' | 'baja'
  detalle: {
    nombre?: string | null
    mes?: string | null
    importe?: number | null
    nota?: string | null
    concepto?: string | null
    cambios?: Record<string, [unknown, unknown]>
  }
  creado_en: string
}

/** Formatea euros (los importes del historial vienen en euros, no en céntimos). */
export type FormatoEur = (centimos: number) => string

const cent = (v: unknown) => Math.round(Number(v) * 100)
const q = (s: unknown) => `«${String(s ?? '').trim() || 'sin nombre'}»`

function enMes(c: Cambio): string {
  return c.detalle.mes ? ` en ${nombreMes(c.detalle.mes)}` : ''
}

/** Frase en tercera persona sin sujeto: «cambió «Super»: 50,00 € → 60,00 €». */
export function describir(c: Cambio, eur: FormatoEur): string {
  const d = c.detalle
  const nombre = q(d.nombre)
  const cambios = d.cambios ?? {}
  const campos = Object.keys(cambios)
  const de = (campo: string) => cambios[campo][0]
  const a = (campo: string) => cambios[campo][1]

  switch (c.tabla) {
    case 'months': {
      const mes = d.mes ? nombreMes(d.mes) : 'un mes'
      if (c.accion === 'alta') return `creó el mes ${mes}`
      if (c.accion === 'baja') return `borró el mes ${mes}`
      if (campos.includes('estado')) return a('estado') === 'Cerrado' ? `cerró el mes ${mes}` : `reabrió el mes ${mes}`
      if (campos.includes('valor_real_inversiones'))
        return a('valor_real_inversiones') === null
          ? `quitó el valor real de las inversiones de ${mes}`
          : `actualizó el valor de las inversiones de ${mes} a ${eur(cent(a('valor_real_inversiones')))}`
      if (campos.includes('saldo_real_cuenta'))
        return a('saldo_real_cuenta') === null ? `quitó el saldo real de ${mes}` : `puso el saldo real de ${mes} en ${eur(cent(a('saldo_real_cuenta')))}`
      if (campos.includes('titulo')) return `cambió el título de ${mes} a ${q(a('titulo'))}`
      return `modificó el mes ${mes}`
    }
    case 'incomes':
    case 'expenses': {
      const tipo = c.tabla === 'incomes' ? 'el ingreso' : 'el gasto'
      if (c.accion === 'alta') return `añadió ${tipo} ${nombre}${d.importe ? ` (${eur(cent(d.importe))})` : ''}${enMes(c)}`
      if (c.accion === 'baja') return `borró ${tipo} ${nombre}${enMes(c)}`
      if (campos.includes('concepto')) return `renombró ${q(de('concepto'))} a ${q(a('concepto'))}${enMes(c)}`
      if (campos.includes('importe')) return `cambió ${nombre}: ${eur(cent(de('importe')))} → ${eur(cent(a('importe')))}${enMes(c)}`
      if (campos.includes('fijo')) return a('fijo') ? `marcó ${nombre} como gasto fijo` : `quitó ${nombre} de los gastos fijos`
      if (campos.includes('presupuesto'))
        return a('presupuesto') === null ? `quitó el presupuesto de ${nombre}` : `puso un presupuesto de ${eur(cent(a('presupuesto')))} a ${nombre}`
      if (campos.includes('fecha_vencimiento')) return `cambió el vencimiento de ${nombre}${enMes(c)}`
      return `modificó ${nombre}${enMes(c)}`
    }
    case 'expense_entries': {
      const nota = d.nota ? ` (${d.nota})` : ''
      if (c.accion === 'alta') return `sumó ${eur(cent(d.importe))} a ${nombre}${nota}${enMes(c)}`
      if (c.accion === 'baja') return `deshizo un apunte de ${eur(cent(d.importe))} en ${nombre}${enMes(c)}`
      if (campos.includes('nota')) return a('nota') ? `puso la nota «${a('nota')}» a un apunte de ${nombre}` : `quitó la nota de un apunte de ${nombre}`
      return `modificó un apunte de ${nombre}`
    }
    case 'savings': {
      if (c.accion === 'alta') return `apuntó un ahorro${d.importe ? ` de ${eur(cent(d.importe))}` : ''} (${d.nombre ?? 'ahorro'})${enMes(c)}`
      if (c.accion === 'baja') return `borró un ahorro${enMes(c)}`
      if (campos.includes('importe')) return `cambió un ahorro: ${eur(cent(de('importe')))} → ${eur(cent(a('importe')))}${enMes(c)}`
      return `modificó un ahorro${enMes(c)}`
    }
    case 'debts': {
      const persona = String(d.nombre ?? '').trim() || 'alguien'
      if (c.accion === 'alta') return `apuntó que ${persona} debe ${eur(cent(d.importe))}${d.concepto ? ` (${d.concepto})` : ''}`
      if (c.accion === 'baja') return `borró una deuda de ${persona}`
      if (campos.includes('devuelto_en')) return a('devuelto_en') ? `marcó como devuelto lo de ${persona}` : `volvió a poner como pendiente lo de ${persona}`
      if (campos.includes('importe')) return `cambió lo que debe ${persona}: ${eur(cent(de('importe')))} → ${eur(cent(a('importe')))}`
      return `modificó una deuda de ${persona}`
    }
    default:
      return 'hizo un cambio'
  }
}

/**
 * Quita el ruido: al sumar un apunte («+ €») o deshacerlo, la app también cambia el importe de la
 * fila. Esa segunda línea se oculta si coincide (misma persona, mismo concepto y mes, importe y
 * menos de 15 s de diferencia).
 */
export function limpiar(cambios: Cambio[]): Cambio[] {
  const apuntes = cambios.filter((c) => c.tabla === 'expense_entries' && c.accion !== 'cambio')
  return cambios.filter((c) => {
    if (c.tabla !== 'expenses' || c.accion !== 'cambio') return true
    const cc = c.detalle.cambios ?? {}
    if (Object.keys(cc).length !== 1 || !cc.importe) return true
    const dif = cent(cc.importe[1]) - cent(cc.importe[0])
    const t = Date.parse(c.creado_en)
    return !apuntes.some(
      (a) =>
        a.user_id === c.user_id &&
        a.detalle.nombre === c.detalle.nombre &&
        a.detalle.mes === c.detalle.mes &&
        Math.abs(Date.parse(a.creado_en) - t) < 15000 &&
        cent(a.detalle.importe) === (a.accion === 'alta' ? dif : -dif),
    )
  })
}

/** «Hoy», «Ayer» o la fecha, para agrupar por días. */
export function etiquetaDia(iso: string, ahora = new Date()): string {
  const f = new Date(iso)
  const dia = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`
  const ayer = new Date(ahora)
  ayer.setDate(ayer.getDate() - 1)
  if (dia(f) === dia(ahora)) return 'Hoy'
  if (dia(f) === dia(ayer)) return 'Ayer'
  return f.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', ...(f.getFullYear() !== ahora.getFullYear() ? { year: 'numeric' } : {}) })
}

const SEGUNDA: Record<string, string> = {
  creó: 'creaste', borró: 'borraste', cerró: 'cerraste', reabrió: 'reabriste', actualizó: 'actualizaste', quitó: 'quitaste',
  puso: 'pusiste', cambió: 'cambiaste', modificó: 'modificaste', añadió: 'añadiste', renombró: 'renombraste', marcó: 'marcaste',
  sumó: 'sumaste', deshizo: 'deshiciste', apuntó: 'apuntaste', volvió: 'volviste', hizo: 'hiciste',
}

/** «cambió «Super»…» → «cambiaste «Super»…» (para los cambios hechos por ti). */
export function enSegundaPersona(frase: string): string {
  const [verbo, ...resto] = frase.split(' ')
  return [SEGUNDA[verbo] ?? verbo, ...resto].join(' ')
}
