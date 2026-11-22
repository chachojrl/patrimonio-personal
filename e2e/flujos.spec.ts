import { test, expect, guardado, esMovil } from './datos'

test('todas las pantallas se abren sin errores', async ({ app }) => {
  for (const ruta of ['/', '/mes/2026-11', '/historial', '/resumen/2026', '/ajustes', '/ajustes/apariencia', '/ajustes/guia', '/ajustes/informe', '/buscar', '/te-deben', '/compra', '/viajes', '/actividad', '/permitir', '/huchas', '/futuro']) {
    await app.goto(`/#${ruta}`)
    // Que la pantalla tenga contenido (y, gracias al fixture, que no haya errores de JavaScript)
    await expect(app.locator('main h1, main h2, main input[aria-label="Título del mes"]').filter({ visible: true }).first()).toBeVisible()
  }
})

test('Inicio: patrimonio, mes en curso y aviso de mes sin cerrar', async ({ app }) => {
  await app.goto('/#/')
  await expect(app.getByRole('heading', { name: 'Patrimonio' })).toBeVisible()
  await expect(app.getByText('Octubre 2026 sigue abierto')).toBeVisible()
  await expect(app.getByText('Noviembre 2026 · abierto')).toBeVisible()
})

test('apuntar un gasto con el panel rápido, y deshacerlo', async ({ app }) => {
  await app.goto('/#/')
  const antes = await guardado(app)
  if (esMovil(app)) await app.locator('nav[aria-label="Secciones"]').getByRole('button', { name: 'Apuntar un gasto' }).click()
  else await app.getByRole('button', { name: 'Apuntar gasto' }).click()
  await app.getByRole('radio', { name: 'Supermercado' }).click()
  for (const t of ['1', '2', 'Coma', '5']) await app.getByRole('button', { name: t, exact: true }).click()
  await app.getByLabel('Nota').fill('Mercadona')
  await app.getByRole('button', { name: 'Apuntar 12,50 € en Supermercado' }).click()
  await expect(app.getByText('Apuntado 12,50 € en Supermercado («Mercadona»).')).toBeVisible()

  await expect.poll(async () => (await guardado(app)).expense_entries.length).toBe(antes.expense_entries.length + 1)
  expect((await guardado(app)).expense_entries.at(-1)).toMatchObject({ importe: 1250, nota: 'Mercadona' })

  await app.getByRole('button', { name: 'Deshacer' }).click()
  await expect.poll(async () => (await guardado(app)).expense_entries.length).toBe(antes.expense_entries.length)
})

test('el mes: sumar a un gasto con la casilla «+ € nota»', async ({ app }) => {
  await app.goto('/#/mes/2026-11')
  const casilla = app.getByLabel('Añadir gasto a Supermercado')
  await casilla.fill('20 cena')
  await casilla.press('Enter')
  await expect(app.getByText('Añadido 20,00 € a Supermercado («cena»)')).toBeVisible()
  await expect.poll(async () => {
    const d = await guardado(app)
    const nov = d.months.find((m) => m.fecha === '2026-11-01')!
    return d.expenses.find((g) => g.month_id === nov.id && g.concepto === 'Supermercado')!.importe
  }).toBe(2000)
})

test('cerrar un mes con el repaso', async ({ app }) => {
  await app.goto('/#/mes/2026-10')
  await app.getByRole('button', { name: 'Cerrar mes…' }).click()
  await app.getByRole('button', { name: 'Cerrar el mes' }).click()
  await expect(app.getByText('Mes cerrado: todo está en solo lectura.')).toBeVisible()
  await expect.poll(async () => (await guardado(app)).months.find((m) => m.fecha === '2026-10-01')!.estado).toBe('Cerrado')
})

test('Ajustes: el buscador filtra y la apariencia cambia el color de la app', async ({ app }) => {
  await app.goto('/#/ajustes')
  await app.getByLabel('Buscar en Ajustes').fill('excel')
  await expect(app.getByRole('link', { name: /Exportar/ })).toBeVisible()
  await expect(app.getByRole('link', { name: /Face ID/ })).toHaveCount(0)

  await app.goto('/#/ajustes/apariencia')
  await app.getByRole('radio', { name: 'Ciruela' }).click()
  await expect(app.locator('html')).toHaveAttribute('data-acento', 'ciruela')
  await app.getByRole('radio', { name: 'Redondear' }).click()
  await expect(app.getByText('938 €')).toBeVisible()
})

test('informe PDF de un año concreto', async ({ app }) => {
  await app.goto('/#/ajustes/informe')
  await app.getByRole('radio', { name: 'Un año' }).click()
  await app.locator('select').selectOption('2026')
  await expect(app.getByText(/Entran 11 meses/)).toBeVisible()
  const [descarga] = await Promise.all([app.waitForEvent('download'), app.getByRole('button', { name: 'Generar PDF' }).click()])
  expect(descarga.suggestedFilename()).toMatch(/^informe-.*-2026-\d{4}-\d{2}-\d{2}\.pdf$/)
})

test('exportar a Excel', async ({ app }) => {
  await app.goto('/#/ajustes/exportar')
  const [descarga] = await Promise.all([app.waitForEvent('download'), app.getByRole('button', { name: /Excel/ }).click()])
  expect(descarga.suggestedFilename()).toMatch(/\.xlsx$/)
})

test('¿Me lo puedo permitir?', async ({ app }) => {
  await app.goto('/#/permitir')
  await app.getByLabel('Importe').fill('1200')
  await expect(app.getByRole('heading', { name: 'Sí, te lo puedes permitir' })).toBeVisible()
  await app.getByLabel('Importe').fill('500000')
  await expect(app.getByRole('heading', { name: 'Mejor esperar' })).toBeVisible()
})

test('Tu año en cifras: se recorre hasta el final', async ({ app }) => {
  await app.emulateMedia({ reducedMotion: 'reduce' })
  await app.goto('/#/resumen/2026')
  await app.getByRole('link', { name: /Tu 2026 en cifras/ }).click()
  const siguiente = app.getByRole('button', { name: 'Siguiente' })
  while (await siguiente.isEnabled()) await siguiente.click()
  await expect(app.getByText('Así fue tu 2026')).toBeVisible()
  await app.getByRole('button', { name: 'Cerrar', exact: true }).last().click()
  await expect(app.getByRole('heading', { name: 'Resumen 2026' })).toBeVisible()
})

test('recorrido guiado desde Ajustes › Guía de uso', async ({ app }) => {
  await app.goto('/#/ajustes/guia')
  await app.getByRole('button', { name: 'Hacer el recorrido guiado' }).click()
  const dialogo = app.locator('[aria-labelledby="titulo-recorrido"]')
  await expect(dialogo.getByRole('heading', { name: 'Bienvenido' })).toBeVisible()
  for (let i = 0; i < 7; i++) await dialogo.getByRole('button', { name: /Empezar|Siguiente/ }).click()
  await expect(dialogo.getByRole('heading', { name: '¡Listo!' })).toBeVisible()
  await dialogo.getByRole('button', { name: 'Terminar' }).click()
  await expect(dialogo).toHaveCount(0)
})

test('¿Me lo puedo permitir? a plazos a medida, con entrada y TAE', async ({ app }) => {
  await app.goto('/#/permitir')
  await app.getByLabel('Importe').fill('20000')
  await app.getByRole('radio', { name: 'Otro' }).click()
  await app.getByLabel('Número de meses').fill('60')
  await app.getByLabel('Entrada').fill('4000')
  await app.getByLabel('TAE en porcentaje').fill('7,5')
  await expect(app.getByText('60 meses al 7,5 % TAE')).toBeVisible()
  await expect(app.getByText('Intereses', { exact: true })).toBeVisible()
  await expect(app.getByText('Total que pagarás')).toBeVisible()
  await app.getByLabel('Número de meses').fill('900')
  await expect(app.getByText('Escribe entre 2 y 480 meses.')).toBeVisible()
})

test('TAE de la cuenta remunerada: intereses en Inicio, en el mes y al cerrarlo', async ({ app }) => {
  await app.goto('/#/ajustes/intereses')
  await app.getByRole('button', { name: 'Poner la TAE' }).click()
  const tae = app.getByLabel(/^TAE desde/)
  await tae.fill('2,5')
  await tae.press('Enter')
  await expect(app.getByText('generas unos')).toBeVisible()
  await expect.poll(async () => (await guardado(app)).config.tae_cuenta_rem).toEqual([{ desde: '2025-12-01', tae: 2.5 }])

  await app.goto('/#/')
  await expect(app.getByText(/de intereses este mes \(2,5 % TAE\)/)).toBeVisible()

  // La página no se sale de la pantalla (en el móvil) con las filas nuevas
  await app.goto('/#/mes/2026-10')
  if (esMovil(app)) expect(await app.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(app.viewportSize()!.width)
  await expect(app.getByText('Intereses al 2,5 % TAE')).toBeVisible()

  // Al cerrar el mes se pueden escribir los intereses que pagó el banco
  await app.getByRole('button', { name: 'Cerrar mes…' }).click()
  const dialogo = app.getByRole('dialog')
  await dialogo.getByLabel('Intereses cuenta remunerada').fill('12,34')
  await dialogo.getByLabel('Intereses cuenta remunerada').press('Tab')
  await dialogo.getByRole('button', { name: 'Cerrar el mes' }).click()
  await expect(app.getByText('Mes cerrado: todo está en solo lectura.')).toBeVisible()
  await expect.poll(async () => (await guardado(app)).months.find((m) => m.fecha === '2026-10-01')!.intereses_cuenta_rem).toBe(1234)
  await expect(app.getByText('Intereses del banco')).toBeVisible()
})

test('Huchas: crear con dinero que ya tienes, llenarla y la aportación mensual al cerrar el mes', async ({ app }) => {
  await app.goto('/#/huchas')
  await app.getByRole('button', { name: 'Nueva hucha' }).click()
  const dialogo = app.getByRole('dialog')
  await dialogo.getByLabel('Nombre de la hucha').fill('Japón')
  await dialogo.getByRole('button', { name: 'Icono ✈️' }).click()
  await dialogo.getByLabel('Objetivo').fill('1000')
  await dialogo.getByLabel('Aportación mensual').fill('200')
  await dialogo.getByLabel('Meter ya').fill('600')
  await dialogo.getByRole('button', { name: 'Crear hucha' }).click()
  await expect(app.getByText('Hucha «Japón» creada con 600,00 €.')).toBeVisible()
  await expect(app.getByRole('heading', { name: 'Japón' })).toBeVisible()
  await expect(app.getByText('Con 200,00 € al mes llegas en')).toBeVisible()

  // Meter lo que falta: se llena
  await app.getByRole('button', { name: 'Meter', exact: true }).click()
  await app.getByRole('dialog').getByLabel('Importe').fill('400')
  await app.getByRole('dialog').getByRole('button', { name: 'Meter' }).click()
  await expect(app.getByText('¡Has llenado «Japón»! ✈️')).toBeVisible()
  await expect.poll(async () => (await guardado(app)).hucha_movimientos.reduce((s, m) => s + m.importe, 0)).toBe(100000)

  // Sacar más de lo que hay no se puede
  await app.getByRole('button', { name: 'Sacar' }).click()
  await app.getByRole('dialog').getByLabel('Importe').fill('2000')
  await app.getByRole('dialog').getByRole('button', { name: 'Sacar' }).click()
  await expect(app.getByRole('alert')).toHaveText('En la hucha solo hay 1.000,00 €.')
  await app.getByRole('dialog').getByLabel('Importe').fill('300')
  await app.getByRole('dialog').getByRole('button', { name: 'Sacar' }).click()
  await expect(app.getByText('Sacados 300,00 € de «Japón».')).toBeVisible()

  // En Huchas: reservado y libre
  await app.goto('/#/huchas')
  await expect(app.getByText('70 %')).toBeVisible()

  // Al cerrar un mes propone la aportación mensual (200 €, sin pasarse de lo que falta)
  await app.goto('/#/mes/2026-10')
  await app.getByRole('button', { name: 'Cerrar mes…' }).click()
  const cierre = app.getByRole('dialog')
  await expect(cierre.getByText('Aportaciones a tus huchas')).toBeVisible()
  await expect(cierre.getByLabel('Importe para Japón')).toHaveValue('200,00')
  await cierre.getByLabel('Importe para Japón').fill('150')
  await cierre.getByRole('button', { name: 'Cerrar el mes' }).click()
  await expect(app.getByText('Mes cerrado: todo está en solo lectura.')).toBeVisible()
  await expect.poll(async () => (await guardado(app)).hucha_movimientos.find((m) => m.mes === '2026-10-01')?.importe).toBe(15000)

  // Inicio la muestra
  await app.goto('/#/')
  await expect(app.getByRole('heading', { name: /Huchas ·/ })).toBeVisible()
  if (esMovil(app)) expect(await app.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(app.viewportSize()!.width)
})

test('Futuro: proyección, ahorro extra y libertad financiera', async ({ app }) => {
  await app.goto('/#/futuro')
  await expect(app.getByText(/En 10 años \(.+\) tendrías unos/)).toBeVisible()
  const antes = await app.locator('strong', { hasText: '€' }).first().textContent()
  await app.getByRole('tab', { name: '30 años' }).click()
  await expect(app.getByText(/En 30 años/)).toBeVisible()
  // Ahorrar más da más patrimonio
  await app.getByRole('tab', { name: '10 años' }).click()
  await app.getByLabel('Ahorro extra al mes').fill('500')
  await expect(app.getByText('+500,00 €')).toBeVisible()
  const despues = await app.locator('strong', { hasText: '€' }).first().textContent()
  const num = (t: string | null) => Number((t ?? '').replace(/[^\d,]/g, '').replace(',', '.'))
  expect(num(despues)).toBeGreaterThan(num(antes))
  // Libertad financiera: quitar un gasto baja el número
  await expect(app.getByRole('heading', { name: 'Libertad financiera' })).toBeVisible()
  const numero = async () => num(await app.getByText('Tu número').locator('xpath=following-sibling::div[1]').textContent())
  const n1 = await numero()
  await app.getByText('Quitar gastos que entonces no tendrías').click()
  await app.locator('details li input[type=checkbox]').first().uncheck()
  await expect.poll(numero).toBeLessThan(n1)
  await expect.poll(async () => (await guardado(app)).config.fire_excluidos.length).toBe(1)
  if (esMovil(app)) expect(await app.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(app.viewportSize()!.width)
})
