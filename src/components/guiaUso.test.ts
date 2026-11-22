import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { GUIA, textoFicha } from './guiaUso'

const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')
const ajustes = readFileSync(new URL('../pages/AjustesPage.tsx', import.meta.url), 'utf8')
const rutas = [...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1])
const apartados = [...ajustes.matchAll(/^ {2}(\w+): \{ id: '(\w+)'/gm)].map((m) => m[2])

describe('Guía de uso', () => {
  const fichas = GUIA.flatMap((g) => g.fichas)

  it('cada ficha tiene resumen y al menos una sección con pasos', () => {
    expect(fichas.length).toBeGreaterThan(40)
    for (const f of fichas) {
      expect(f.resumen.length, f.titulo).toBeGreaterThan(10)
      expect(f.secciones.length, f.titulo).toBeGreaterThan(0)
      for (const s of f.secciones) expect(s.pasos.length, f.titulo).toBeGreaterThan(0)
    }
  })

  it('los títulos no se repiten', () => {
    const t = fichas.map((f) => f.titulo)
    expect(new Set(t).size).toBe(t.length)
  })

  it('los enlaces llevan a pantallas que existen', () => {
    for (const f of fichas.filter((x) => x.ir)) {
      const to = f.ir!.to.replace(/^\//, '')
      if (to === '') continue
      const aj = to.match(/^ajustes\/(\w+)$/)
      if (aj) expect(apartados, f.titulo).toContain(aj[1])
      else expect(rutas.some((r) => r === to || r.split('/')[0] === to.split('/')[0]), f.titulo).toBe(true)
    }
  })

  it('se puede buscar sin tildes', () => {
    const f = fichas.find((x) => x.titulo === 'Intereses de la cuenta remunerada')!
    expect(textoFicha(f)).toContain('retencion')
  })
})
