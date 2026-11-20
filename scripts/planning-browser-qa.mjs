import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { createNotebookEvent } from '../src/config/servicePresets.ts'
import { dayInZone, addCalendarDays } from '../src/services/planningDates.ts'

const require = createRequire(import.meta.url)
const { chromium } = process.env.EVENTFLOW_PLAYWRIGHT ? require(process.env.EVENTFLOW_PLAYWRIGHT) : require('playwright')
const base = process.env.EVENTFLOW_QA_URL || 'http://127.0.0.1:5173/EventFlow/'
const directory = process.env.EVENTFLOW_QA_OUTPUT || '.local/planning-qa'
await mkdir(directory, { recursive: true })
const server = process.env.EVENTFLOW_QA_START === '1' ? spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173'], { stdio: 'ignore' }) : null
if (server) for (let attempt = 0; attempt < 60; attempt++) {
  try { if ((await fetch(base)).ok) break } catch { /* preview starting */ }
  await new Promise((resolve) => setTimeout(resolve, 500))
}
const today = dayInZone(), tomorrow = addCalendarDays(today, 1), now = new Date().toISOString()
const event = createNotebookEvent({ id: 'qa-event', title: 'Учебная конференция', city: 'Москва', company: 'Учебная компания', dateFrom: today, dateTo: addCalendarDays(today, 2), commonChecklist: [{ id: 'common-1', title: 'Согласовать программу', completed: false, deadline: today }, { id: 'common-2', title: 'Отправить материалы', completed: false, deadline: addCalendarDays(today, -1) }], services: [{ id: 'qa-catering', eventId: 'qa-event', type: 'catering', title: 'Кейтеринг', providerName: 'Учебный поставщик', providerContact: 'Контакт для примера', notes: '', checklist: [{ id: 'menu', title: 'Подтвердить меню', completed: false, priority: 'high' }] }], waitingItems: [{ id: 'qa-wait', text: 'Получить подтверждение площадки', completed: false, createdAt: now, waitingFor: 'Учебная площадка' }], nextStep: 'Направить программу клиенту' })
const data = { events: [event], tasks: [], risks: [], activities: [], checklistItems: [], questions: [], contractors: [], templates: [{ id: 'qa-template', name: 'Запрос условий площадке', category: 'Работа с площадками', subject: 'Запрос условий мероприятия', body: 'Здравствуйте!\nПросим подтвердить условия и сроки для учебного мероприятия.\nСпасибо!', requiredTopics: [], custom: true, updatedAt: now }], budgets: [], floodEntries: [], settings: { userName: 'Учебный профиль', workdayStart: '09:00', workdayEnd: '18:00', dateFormat: 'DD.MM.YYYY', lastBackupAt: null, timeZone: 'Europe/Moscow' } }
let remote = { version: 1, updated_at: now, data: { ...data }, record_versions: {}, tombstones: {} }, puts = 0
const browser = await chromium.launch({ headless: true, ...(process.env.EVENTFLOW_CHROME_PATH ? { executablePath: process.env.EVENTFLOW_CHROME_PATH } : {}) })
const contexts = []
async function context(viewport = { width: process.env.EVENTFLOW_GUIDE_SHOTS ? 1100 : 1440, height: 1000 }, seed = true) {
  const ctx = await browser.newContext({ viewport, timezoneId: process.env.EVENTFLOW_GUIDE_SHOTS ? 'Europe/Moscow' : 'America/Los_Angeles' })
  contexts.push(ctx)
  await ctx.route('https://api.github.com/**', async (route) => {
    assert.match(route.request().url(), /repos\/LeSauteur\/EventFlow\/contents\/data\/eventflow-data\.json/)
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      remote = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')); puts++
      await route.fulfill({ json: { content: { sha: `qa-${puts}` } } })
    } else await route.fulfill({ json: { sha: `qa-${puts}`, content: Buffer.from(JSON.stringify(remote)).toString('base64') } })
  })
  if (seed) await ctx.addInitScript(({ data, now }) => {
    // A browser network-error document has an opaque origin; it is not the app.
    if (!['http:', 'https:'].includes(location.protocol)) return
    try { void localStorage.length } catch { return }
    if (localStorage.getItem('qa-initialized')) return
    localStorage.setItem('qa-initialized', 'true')
    for (const [key, value] of Object.entries(data)) localStorage.setItem(`eventflow.${key}`, JSON.stringify(value))
    localStorage.setItem('eventflow.schemaVersion', '6')
    sessionStorage.setItem('eventflow.githubToken', 'synthetic-browser-qa-token')
    localStorage.setItem('eventflow.syncMeta', JSON.stringify({ revision: 0, dirty: false, dirtyCount: 0, initialized: true, preferRemoteOnFirstLoad: false, lastOnlineSync: now, recordVersions: {}, tombstones: {} }))
  }, { data, now })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())
  return { ctx, page, errors }
}
const go = async (page, path) => {
  for (let attempt = 0; ; attempt++) {
    try { await page.goto(`${base}#${path}`); break }
    catch (error) { if (attempt >= 2 || !/ERR_CONNECTION|ERR_TIMED_OUT/.test(String(error))) throw error; await page.waitForTimeout(600) }
  }
  await page.waitForSelector('.planning-page, .event-page, .settings-page, .new-event-page, .templates-page')
  await page.waitForTimeout(250)
}
const screenshot = async (page, name) => {
  if (process.env.EVENTFLOW_GUIDE_SHOTS) {
    while (await page.locator('.toast button').count()) await page.locator('.toast button').last().click()
    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
  }
  if (!name.startsWith('03-')) await page.evaluate(() => window.scrollTo(0, 0))
  const focus = process.env.EVENTFLOW_GUIDE_SHOTS && ({ '02-event-workspace': '.passport-section', '03-task-details': '.registry-task:has(.registry-details)', '04-calendar-month': '.planning-card:has(.planning-calendar-grid)', '06-flood-inbox': '.flood-entry:last-child', '08-settings-sync': '.sync-settings-card', '09-new-event': '.notebook-form-section:first-child', '10-templates': '.template-editor-card', '11-service-block': '.services-section', '12-backup': '.settings-card:last-child' })[name]
  if (focus) await page.locator(focus).screenshot({ path: `${directory}/${name}.png` })
  else await page.screenshot({ path: `${directory}/${name}.png`, fullPage: false })
}
const row = (page, key) => page.locator(`[data-task-key="${key}"]`)
const { page, ctx, errors } = await context()
try {
  await go(page, '/today')
  assert.equal(await page.getByRole('heading', { name: 'Сегодня', exact: true, level: 1 }).count(), 1)
  assert.equal(await page.evaluate(() => !!localStorage.getItem('eventflow.backup.before-schema-7')), true)
  const key = 'service:qa-event:qa-catering:menu'
  await row(page, key).getByLabel('Горит', { exact: true }).click()
  assert.equal(await row(page, key).locator('.badge-hot').count(), 1)
  await row(page, key).getByLabel('Важность', { exact: true }).selectOption('critical')
  await row(page, key).getByLabel('Срок задачи', { exact: true }).fill(tomorrow)
  await row(page, key).getByLabel('Параметры задачи').click()
  await row(page, key).getByLabel('Метки задачи').fill('Клиент, Меню')
  await row(page, key).getByLabel('Метки задачи').press('Tab')
  assert.equal(await row(page, key).getByText('#Меню', { exact: true }).count(), 1)
  await row(page, key).getByLabel('Параметры задачи').click()
  await page.getByLabel('Название фильтра').fill('Важное для клиента')
  await page.getByRole('button', { name: 'Сохранить фильтр', exact: true }).click()
  await screenshot(page, '01-today-desktop')
  await go(page, `/events/qa-event?task=${encodeURIComponent(key)}`)
  assert.equal(await row(page, key).getByLabel('Важность', { exact: true }).inputValue(), 'critical')
  if (process.env.EVENTFLOW_GUIDE_SHOTS) await screenshot(page, '11-service-block')
  await row(page, key).getByLabel('Статус задачи', { exact: true }).selectOption('done')
  await page.getByRole('button', { name: 'Закрепить', exact: true }).click()
  await screenshot(page, '02-event-workspace')
  await go(page, '/today')
  assert.equal(await row(page, key).count(), 0)
  await page.getByLabel('Завершённые и архив').check()
  await row(page, key).getByLabel('Статус задачи', { exact: true }).selectOption('waiting')
  await row(page, key).getByLabel('Параметры задачи').click()
  await row(page, key).getByLabel('Напоминание', { exact: true }).fill(`${today}T15:00`)
  await row(page, key).getByLabel('Напоминание', { exact: true }).press('Tab')
  await row(page, key).getByLabel('От кого ждём').fill('Учебный клиент')
  await row(page, key).getByLabel('От кого ждём').press('Tab')
  await screenshot(page, '03-task-details')
  await go(page, '/calendar')
  assert.ok(await page.locator('.planning-calendar-grid > button').count() === 42)
  await screenshot(page, '04-calendar-month')
  await page.getByRole('button', { name: 'Неделя', exact: true }).click()
  assert.equal(await page.locator('.planning-calendar-grid > button').count(), 7)
  await page.getByRole('button', { name: 'Расписание', exact: true }).click()
  assert.ok(await page.locator('.calendar-agenda-item.cal-reminder').count() > 0)
  await screenshot(page, '05-calendar-agenda')
  await page.getByLabel('Новая задача', { exact: true }).fill('Задача из календаря')
  await page.getByRole('button', { name: 'Добавить задачу', exact: true }).click()
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('eventflow.checklistItems') || '[]').some((item) => item.title === 'Задача из календаря' && item.deadline))

  await go(page, '/flood')
  const composer = page.getByLabel('Новая запись Флуда')
  await composer.fill('Учебное письмо\nУточнить условия раннего заезда.')
  await page.getByRole('button', { name: 'Новая запись', exact: true }).click()
  assert.equal(await page.locator('.flood-entry').count(), 1)
  // Large multiline paste must create a second independent record.
  await composer.evaluate((el) => { const transfer = new DataTransfer(); transfer.setData('text/plain', 'Учебная переписка\n'.repeat(3000)); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true })) })
  assert.equal(await page.locator('.flood-entry').count(), 2)
  await page.getByRole('button', { name: 'Новая запись', exact: true }).click()
  const first = page.locator('.flood-entry').last()
  await first.getByLabel('Привязка записи к мероприятию').selectOption('qa-event')
  await first.getByLabel('Текст записи Флуда').fill('Учебное письмо\nСогласовать дополнительный кофе-брейк.')
  await screenshot(page, '06-flood-inbox')
  await first.getByRole('button', { name: 'В корзину', exact: true }).click()
  assert.equal(await page.locator('.flood-entry').count(), 1)
  await page.getByRole('button', { name: 'Отменить', exact: true }).click()
  assert.equal(await page.locator('.flood-entry').count(), 2)
  await go(page, '/events/qa-event')
  await page.getByRole('button', { name: /^Флуд ·/ }).click()
  assert.equal(await page.locator('.flood-entry').count(), 1)
  await screenshot(page, '07-event-flood')
  await page.locator('.flood-entry').getByLabel('Привязка записи к мероприятию').selectOption('')
  assert.equal(await page.locator('.flood-entry').count(), 0)
  await page.getByRole('button', { name: 'Сохранить в GitHub', exact: true }).click()
  await page.waitForSelector('.notebook-save-state.online')
  assert.ok(puts > 0)
  assert.equal(remote.data.floodEntries.length, 2)
  await go(page, '/settings')
  await screenshot(page, '08-settings-sync')
  if (process.env.EVENTFLOW_GUIDE_SHOTS) await screenshot(page, '12-backup')
  await go(page, '/events/new')
  await screenshot(page, '09-new-event')
  await go(page, '/templates')
  await screenshot(page, '10-templates')

  // A clean second device reads precisely the uploaded records, not local demo copies.
  const second = await context({ width: 430, height: 932 }, false)
  await go(second.page, '/flood')
  await second.page.waitForFunction(() => JSON.parse(localStorage.getItem('eventflow.floodEntries') || '[]').length === 2)
  assert.equal(await second.page.locator('.flood-entry').count(), 2)
  await second.page.getByLabel('Новая запись Флуда').fill('Отдельная запись с телефона')
  await second.page.evaluate(() => sessionStorage.setItem('eventflow.githubToken', 'synthetic-browser-qa-token'))
  await second.page.reload()
  await second.page.getByRole('button', { name: 'Сохранить в GitHub', exact: true }).click()
  await second.page.waitForSelector('.notebook-save-state.online')
  await page.reload()
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('eventflow.floodEntries') || '[]').length === 3)

  for (const width of [390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const path of ['/today', '/calendar', '/flood', '/events/qa-event']) {
      await go(page, path)
      const metrics = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll('.registry-task, .registry-quick-controls, .planning-card, .flood-composer')].filter((el) => el.getBoundingClientRect().right > innerWidth + 1).length }))
      assert.ok(metrics.scroll <= width, `${width} ${path}: ${JSON.stringify(metrics)}`)
      assert.equal(metrics.overflow, 0, `${width} ${path}: cards overflow`)
      if (width === 390 || width === 430) { await page.locator('main').scrollIntoViewIfNeeded(); await screenshot(page, `${width}-${path.replaceAll('/', '-')}`) }
    }
  }
  assert.deepEqual(errors, [])
  assert.deepEqual(second.errors, [])
  console.log(JSON.stringify({ result: 'passed', viewportWidths: [390, 430, 768, 1440], syntheticPuts: puts, checks: 'registry edits, source consistency, hot flag without date, saved filter, event pin, month/week/agenda, large paste, event assignment, deletion/undo, second-device read/write, migration backup, no overflow, no page errors', screenshots: directory }, null, 2))
} finally { await browser.close(); server?.kill() }
