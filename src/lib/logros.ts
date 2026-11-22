// Rachas y logros. Módulo PURO: todo se calcula con tus meses (no se guarda nada en la base de datos).
import type { Cents } from './money'
import type { Calculo, MesCalculado } from './calculos'
import type { Datos } from './tipos'
import { estadoPresupuesto } from './operaciones'
import { saldoHucha } from './huchas'

// ---------------- Rachas ----------------

export interface Racha {
  id: 'ahorro' | 'neto' | 'presupuesto' | 'cerrados'
  titulo: string
  /** Para qué cuenta un mes. */
  explicacion: string
  icono: string
  /** Meses seguidos hasta ahora (0 si la racha se ha roto). */
  actual: number
  /** La mejor que has tenido. */
  mejor: number
}

/** ¿El mes cuenta para la racha? null = no se puede saber todavía (mes en curso sin cumplirlo aún): ni suma ni rompe. */
type Criterio = (m: MesCalculado, d: Pick<Datos, 'expenses'>) => boolean | null

const abierto = (m: MesCalculado) => m.mes.estado === 'Abierto'

const CRITERIOS: Record<Racha['id'], Criterio> = {
  ahorro: (m) => (m.ahorroDesdeIngresos > 0 ? true : abierto(m) ? null : false),
  neto: (m) => (m.ingresosTotales > 0 && m.neto > 0 ? true : abierto(m) ? null : false),
  presupuesto: (m, d) => {
    const con = d.expenses.filter((g) => g.month_id === m.mes.id && g.presupuesto !== null)
    if (con.length === 0) return abierto(m) ? null : false
    const pasado = con.some((g) => (estadoPresupuesto(g)?.exceso ?? 0) > 0)
    if (pasado) return false // pasarse ya rompe la racha, aunque el mes siga abierto
    return abierto(m) ? null : true
  },
  cerrados: (m) => (abierto(m) ? null : true),
}

/** Racha actual y mejor racha de meses seguidos que cumplen el criterio. */
export function racha(calc: Calculo, d: Pick<Datos, 'expenses'>, criterio: Criterio): { actual: number; mejor: number; alcanzado: Map<number, string> } {
  let actual = 0
  let mejor = 0
  // Primer mes en que se alcanzó cada longitud de racha (para fechar los logros)
  const alcanzado = new Map<number, string>()
  for (const m of calc.meses) {
    const r = criterio(m, d)
    if (r === null) continue
    if (r) {
      actual++
      if (!alcanzado.has(actual)) alcanzado.set(actual, m.mes.fecha)
    } else actual = 0
    mejor = Math.max(mejor, actual)
  }
  return { actual, mejor, alcanzado }
}

export function rachas(calc: Calculo, d: Pick<Datos, 'expenses'>): Racha[] {
  const def: Omit<Racha, 'actual' | 'mejor'>[] = [
    { id: 'ahorro', titulo: 'Ahorrando', explicacion: 'Meses seguidos pasando dinero de la cuenta de gastos al ahorro.', icono: '🔥' },
    { id: 'neto', titulo: 'Gastando menos de lo que entra', explicacion: 'Meses seguidos con más ingresos que gastos.', icono: '📈' },
    { id: 'presupuesto', titulo: 'Sin pasarte del presupuesto', explicacion: 'Meses seguidos con presupuestos y sin pasarte de ninguno.', icono: '🎯' },
    { id: 'cerrados', titulo: 'Meses cerrados', explicacion: 'Meses seguidos repasados y cerrados.', icono: '✅' },
  ]
  return def.map((x) => ({ ...x, ...racha(calc, d, CRITERIOS[x.id]) }))
}

// ---------------- Logros ----------------

export interface Logro {
  id: string
  titulo: string
  descripcion: string
  icono: string
  /** Fecha en que lo conseguiste (primer día del mes o un día), o null si aún no. */
  conseguido: string | null
  /** De 0 a 1 hacia el logro. */
  progreso: number
  /** «2 de 6 meses», «12.300 € de 25.000 €»… (para los que aún no tienes). */
  textoProgreso: string
}

const eurCorto = (c: Cents) => `${Math.round(c / 100).toLocaleString('es-ES')} €`
const PATRIMONIO = [1000000, 2500000, 5000000, 10000000, 25000000, 50000000, 100000000]

export function logros(calc: Calculo, d: Pick<Datos, 'expenses' | 'huchas' | 'hucha_movimientos' | 'config'>): Logro[] {
  const lista: Logro[] = []
  const meses = calc.meses
  const add = (l: Logro) => lista.push(l)
  const deRacha = (id: string, titulo: string, descripcion: string, icono: string, n: number, r: ReturnType<typeof racha>) =>
    add({ id, titulo, descripcion, icono, conseguido: r.alcanzado.get(n) ?? null, progreso: Math.min(1, Math.max(r.actual, 0) / n), textoProgreso: `${Math.min(r.actual, n)} de ${n} meses seguidos` })

  // Empezar
  const primerCerrado = meses.find((m) => !abierto(m))
  add({ id: 'primer-mes', titulo: 'Primer mes cerrado', descripcion: 'Repasa y cierra tu primer mes.', icono: '🌱', conseguido: primerCerrado?.mes.fecha ?? null, progreso: primerCerrado ? 1 : 0, textoProgreso: 'Cierra un mes' })
  const doce = meses[11]
  add({ id: 'un-anio', titulo: 'Un año de cuentas', descripcion: '12 meses apuntados.', icono: '📅', conseguido: doce?.mes.fecha ?? null, progreso: Math.min(1, meses.length / 12), textoProgreso: `${Math.min(meses.length, 12)} de 12 meses` })

  // Rachas de ahorro
  const rAhorro = racha(calc, d, CRITERIOS.ahorro)
  deRacha('ahorro-3', '3 meses ahorrando', 'Ahorra 3 meses seguidos.', '🔥', 3, rAhorro)
  deRacha('ahorro-6', '6 meses ahorrando', 'Ahorra 6 meses seguidos.', '🔥', 6, rAhorro)
  deRacha('ahorro-12', 'Un año ahorrando', 'Ahorra 12 meses seguidos.', '🏆', 12, rAhorro)

  // % de ahorro
  const mejorPct = Math.max(0, ...meses.map((m) => m.pctAhorro ?? 0))
  const mes20 = meses.find((m) => (m.pctAhorro ?? 0) >= 0.2)
  add({ id: 'ahorro-20', titulo: 'El 20 % al ahorro', descripcion: 'Un mes ahorrando al menos el 20 % de lo que entra.', icono: '💪', conseguido: mes20?.mes.fecha ?? null, progreso: Math.min(1, mejorPct / 0.2), textoProgreso: `Tu mejor mes: ${Math.round(mejorPct * 100)} %` })

  // Presupuesto
  const rPres = racha(calc, d, CRITERIOS.presupuesto)
  add({ id: 'presupuesto', titulo: 'Dentro del presupuesto', descripcion: 'Un mes con presupuestos sin pasarte de ninguno.', icono: '🎯', conseguido: rPres.alcanzado.get(1) ?? null, progreso: rPres.mejor > 0 ? 1 : 0, textoProgreso: 'Pon presupuestos y no te pases' })

  // Colchón: meses que podrías vivir con lo líquido (disponible + remunerada), con el gasto medio de hasta 6 meses
  const colchonEn = (i: number) => {
    const m = meses[i]
    const rec = meses.slice(0, i + 1).filter((x) => x.gastosTotales > 0).slice(-6)
    const gasto = rec.length ? rec.reduce((a, x) => a + x.gastosTotales, 0) / rec.length : 0
    return gasto > 0 ? Math.max(0, m.saldoDisponible + m.cuentaRemAcum) / gasto : 0
  }
  const colchones = meses.map((_, i) => colchonEn(i))
  const colchonHoy = colchones.at(-1) ?? 0
  for (const n of [3, 6]) {
    const i = colchones.findIndex((x) => x >= n)
    add({
      id: `colchon-${n}`, titulo: `Colchón de ${n} meses`, descripcion: `Tener para vivir ${n} meses sin ingresos (sin contar inversiones).`, icono: n === 3 ? '🛟' : '🏰',
      conseguido: i >= 0 ? meses[i].mes.fecha : null, progreso: Math.min(1, colchonHoy / n), textoProgreso: `Ahora: ${colchonHoy.toLocaleString('es-ES', { maximumFractionDigits: 1 })} meses`,
    })
  }

  // Patrimonio: el siguiente objetivo y los ya conseguidos
  const actual = calc.kpis.dineroTotalActual
  let siguienteMostrado = false
  for (const x of PATRIMONIO) {
    const m = meses.find((mm) => mm.dineroTotal >= x)
    if (!m && siguienteMostrado) break
    if (!m) siguienteMostrado = true
    add({
      id: `patrimonio-${x / 100}`, titulo: x >= 100000000 ? '1 millón de €' : eurCorto(x),
      descripcion: `Patrimonio de ${eurCorto(x)}.`, icono: x >= 10000000 ? '💎' : '💰',
      conseguido: m?.mes.fecha ?? null, progreso: Math.min(1, Math.max(0, actual) / x), textoProgreso: `${eurCorto(Math.max(0, actual))} de ${eurCorto(x)}`,
    })
  }

  // Huchas
  const conseguidas = d.huchas.filter((h) => h.conseguida_en).sort((a, b) => a.conseguida_en!.localeCompare(b.conseguida_en!))
  const mejorHucha = Math.max(0, ...d.huchas.map((h) => (h.objetivo > 0 ? Math.max(0, saldoHucha(h.id, d.hucha_movimientos)) / h.objetivo : 0)))
  add({
    id: 'hucha', titulo: 'Primera hucha conseguida', descripcion: 'Llena una hucha y márcala como conseguida.', icono: '🐷',
    conseguido: conseguidas[0]?.conseguida_en ?? null, progreso: conseguidas.length ? 1 : Math.min(0.99, mejorHucha),
    textoProgreso: d.huchas.length ? `Tu hucha más llena: ${Math.round(mejorHucha * 100)} %` : 'Crea una hucha',
  })

  // Intereses
  let acum = 0
  let mesInt: string | null = null
  for (const m of meses) {
    acum += m.interesesCtaRem
    if (!mesInt && acum >= 10000) mesInt = m.mes.fecha
  }
  add({ id: 'intereses-100', titulo: '100 € de intereses', descripcion: 'Que tu cuenta remunerada te genere 100 €.', icono: '🌿', conseguido: mesInt, progreso: Math.min(1, Math.max(0, acum) / 10000), textoProgreso: `${eurCorto(Math.max(0, acum))} de 100 €` })

  // Inversiones
  const ganancia = calc.kpis.gananciaInversiones
  add({
    id: 'inversiones-1000', titulo: '1.000 € ganados invirtiendo', descripcion: 'Que tus inversiones valgan 1.000 € más de lo que metiste.', icono: '📊',
    conseguido: ganancia >= 100000 && meses.length ? meses[meses.length - 1].mes.fecha : null,
    progreso: Math.min(1, Math.max(0, ganancia) / 100000), textoProgreso: `Ahora: ${eurCorto(ganancia)}`,
  })

  return lista
}

/** Logros conseguidos que aún no se han enseñado (ids vistos guardados en este dispositivo). */
export function nuevosLogros(lista: Logro[], vistos: string[] | null): Logro[] {
  if (vistos === null) return [] // la primera vez no se avisa de todo lo anterior
  const v = new Set(vistos)
  return lista.filter((l) => l.conseguido && !v.has(l.id))
}
