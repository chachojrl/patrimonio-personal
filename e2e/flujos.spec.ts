import { test, expect, guardado, esMovil } from './datos'

test('todas las pantallas se abren sin errores', async ({ app }) => {
  for (const ruta of ['/', '/mes/2026-11', '/historial', '/resumen/2026', '/ajustes', '/ajustes/apariencia', '/ajustes/guia', '/ajustes/informe', '/buscar', '/te-deben', '/compra', '/viajes', '/actividad', '/permitir']) {
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
