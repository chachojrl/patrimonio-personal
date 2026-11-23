// Futuro › Tus planes: año de nacimiento (para verlo todo por edad) y cambios que ya sabes que van a pasar.
import { useState } from 'react'
import { useStore } from '../data/store'
import { Card, cx } from './ui'
import { Icono, type NombreIcono } from './ios'
import { useEur } from '../lib/discreto'
import { parseImporte } from '../lib/money'
import { mesActual, mesLargo } from '../lib/fechas'
import { uid } from '../lib/operaciones'
import { TIPOS_EVENTO, edadEn, type EventoFuturo, type TipoEvento } from '../lib/futuro'

const ICONO: Record<TipoEvento, NombreIcono> = {
  gasto_unico: 'carrito', ingreso_unico: 'regalo', gasto_nuevo: 'calendario', gasto_fin: 'casa', sueldo: 'billete', pension: 'sol', inversion: 'tendencia',
}

const bordeCampo = 'min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[15px] outline-none focus:border-marino dark:border-white/15 dark:bg-white/5'
const campo = `w-full ${bordeCampo}`

export function PlanesFuturo() {
  const { datos, actualizarConfig } = useStore()
  const cfg = datos.config
  const eur = useEur()
  const [anioTxt, setAnioTxt] = useState(cfg.anio_nacimiento ? String(cfg.anio_nacimiento) : '')
  const [abierto, setAbierto] = useState(false)
  const eventos = [...cfg.eventos_futuro].sort((a, b) => a.desde.localeCompare(b.desde))
  const anioActual = Number(mesActual().slice(0, 4))

  const guardarAnio = (txt: string) => {
    const n = Number(txt)
    const valor = txt.trim() === '' ? null : Number.isInteger(n) && n >= 1900 && n <= anioActual ? n : undefined
    if (valor !== undefined && valor !== cfg.anio_nacimiento) actualizarConfig({ anio_nacimiento: valor })
  }
  const anioMal = anioTxt.trim() !== '' && !(Number.isInteger(Number(anioTxt)) && Number(anioTxt) >= 1900 && Number(anioTxt) <= anioActual)

  const importeTexto = (e: EventoFuturo) => {
    if (e.tipo === 'inversion') return `${eur(e.importe, { dash: false })} al mes a inversiones`
    const signo = e.tipo === 'gasto_unico' || e.tipo === 'gasto_nuevo' ? '−' : e.importe < 0 ? '−' : '+'
    return `${signo}${eur(Math.abs(e.importe), { dash: false })}${TIPOS_EVENTO[e.tipo].mensual ? ' al mes' : ''}`
  }

  return (
    <Card titulo="Tus planes" accion={!abierto && (
      <button type="button" onClick={() => setAbierto(true)} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[15px] font-medium text-marino hover:bg-slate-100 dark:text-sky-300 dark:hover:bg-white/10">
        <Icono nombre="mas" className="h-4 w-4" grosor={2.4} />Añadir cambio
      </button>
    )}>
      <p className="text-[13px] text-slate-500 dark:text-slate-400">
        Lo que ya sabes que va a cambiar: una compra grande, el fin de la hipoteca, la pensión… Se tiene en cuenta en la proyección y en la libertad financiera.
        Los importes van en euros de hoy: se actualizan solos con la inflación.
      </p>

      <label className="mt-3 flex items-center gap-3 text-sm">
        <span className="flex-1 font-medium">Año en que naciste</span>
        <input
          inputMode="numeric"
          aria-label="Año en que naciste"
          placeholder="1990"
          maxLength={4}
          value={anioTxt}
          onChange={(e) => setAnioTxt(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={(e) => guardarAnio(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && guardarAnio((e.target as HTMLInputElement).value)}
          className={cx(bordeCampo, 'num w-24 shrink-0 text-right', anioMal && 'border-red-400')}
        />
      </label>
      <p className="mt-1 text-xs text-slate-500">{anioMal ? `Escribe un año entre 1900 y ${anioActual}.` : 'Opcional: así ves la proyección por edad («a los 52»).'}</p>

      {abierto && <FormularioEvento onCerrar={() => setAbierto(false)} onGuardar={(e) => { actualizarConfig({ eventos_futuro: [...cfg.eventos_futuro, e] }); setAbierto(false) }} />}

      {eventos.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
          {eventos.map((e) => {
            const edad = edadEn(cfg, e.desde)
            return (
              <li key={e.id} className="flex items-center gap-3 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-marino/10 text-marino dark:bg-sky-400/15 dark:text-sky-300" aria-hidden>
                  <Icono nombre={ICONO[e.tipo]} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{e.nombre}</span>
                  <span className="block text-xs text-slate-500">
                    {TIPOS_EVENTO[e.tipo].mensual ? `Desde ${mesLargo(e.desde)}${e.hasta ? ` hasta ${mesLargo(e.hasta)}` : ''}` : mesLargo(e.desde)}
                    {edad !== null && ` · a los ${edad}`}
                  </span>
                </span>
                <span className="num shrink-0 text-sm">{importeTexto(e)}</span>
                <button
                  type="button"
                  aria-label={`Quitar «${e.nombre}»`}
                  onClick={() => actualizarConfig({ eventos_futuro: cfg.eventos_futuro.filter((x) => x.id !== e.id) })}
                  className="flex h-9 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                >
                  <Icono nombre="papelera" className="h-4 w-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function FormularioEvento({ onGuardar, onCerrar }: { onGuardar: (e: EventoFuturo) => void; onCerrar: () => void }) {
  const { datos } = useStore()
  const [tipo, setTipo] = useState<TipoEvento>('gasto_unico')
  const [nombre, setNombre] = useState('')
  const [importeTxt, setImporteTxt] = useState('')
  const [desde, setDesde] = useState(`${Number(mesActual().slice(0, 4)) + 1}-01`)
  const [hasta, setHasta] = useState('')
  const info = TIPOS_EVENTO[tipo]
  const importe = parseImporte(importeTxt)
  const edad = /^\d{4}-\d{2}$/.test(desde) ? edadEn(datos.config, `${desde}-01`) : null
  const error =
    !nombre.trim() ? 'Ponle un nombre.'
      : importe === null || (importe === 0 && tipo !== 'inversion') ? 'Escribe el importe.'
        : importe < 0 && tipo !== 'sueldo' ? 'El importe va en positivo (solo el sueldo puede bajar).'
          : !/^\d{4}-\d{2}$/.test(desde) ? 'Elige el mes.'
            : info.mensual && hasta && hasta < desde ? 'El final tiene que ser después del principio.'
              : null
  const [intentado, setIntentado] = useState(false)

  const guardar = () => {
    setIntentado(true)
    if (error || importe === null) return
    onGuardar({ id: uid(), nombre: nombre.trim().slice(0, 60), tipo, importe, desde: `${desde}-01`, hasta: info.mensual && hasta ? `${hasta}-01` : null })
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3 dark:bg-white/5" role="group" aria-label="Nuevo cambio">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Qué cambia</span>
        <select aria-label="Tipo de cambio" value={tipo} onChange={(e) => setTipo(e.target.value as TipoEvento)} className={campo}>
          {(Object.keys(TIPOS_EVENTO) as TipoEvento[]).map((t) => <option key={t} value={t}>{TIPOS_EVENTO[t].texto}</option>)}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Nombre</span>
          <input aria-label="Nombre del cambio" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={info.ejemplo} maxLength={60} className={campo} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{tipo === 'inversion' ? 'Inviertes al mes' : info.mensual ? 'Importe al mes' : 'Importe'}</span>
          <input aria-label="Importe del cambio" inputMode="decimal" value={importeTxt} onChange={(e) => setImporteTxt(e.target.value)} placeholder={tipo === 'sueldo' ? '300 € o −500 €' : tipo === 'inversion' ? 'Lo nuevo: 500 €' : '650 €'} className={cx(campo, 'num text-right')} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{info.mensual ? 'Desde' : 'Cuándo'}{edad !== null && <span className="font-normal text-slate-500"> · a los {edad}</span>}</span>
          <input aria-label={info.mensual ? 'Desde' : 'Cuándo'} type="month" value={desde} onChange={(e) => setDesde(e.target.value)} className={campo} />
        </label>
        {info.mensual && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Hasta <span className="font-normal text-slate-500">(opcional)</span></span>
            <input aria-label="Hasta" type="month" value={hasta} onChange={(e) => setHasta(e.target.value)} className={campo} />
          </label>
        )}
      </div>
      {intentado && error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCerrar} className="h-9 rounded-lg px-3 text-[15px] text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">Cancelar</button>
        <button type="button" onClick={guardar} className="h-9 rounded-lg bg-marino px-3 text-[15px] font-medium text-white hover:opacity-90 dark:bg-sky-500">Guardar cambio</button>
      </div>
    </div>
  )
}
