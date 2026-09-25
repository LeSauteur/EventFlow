import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { calculateChecklistProgress, createChecklistForEvent } from '../src/config/checklistPresets.ts'
import { calculateEventRisks } from '../src/config/riskRules.ts'
import { calculateBudget } from '../src/services/budget.ts'
import { createBackup, ensureSeedData, importBackup, loadEvents, saveEvents, SCHEMA_VERSION, STORAGE_KEYS, validateBackup } from '../src/services/storage.ts'
import { EventFlowSyncEngine, markDeleted, markSyncDirty, mergeSnapshots, normalizeSnapshot, readSyncMeta, snapshotFromLocal, SyncConflictError, SYNC_DIRTY_THRESHOLD, SYNC_META_KEY, SYNC_TOKEN_KEY } from '../src/services/sync.ts'
import { checkTemplateCoverage, renderTemplate } from '../src/services/templateEngine.ts'
import { getDeadlineState, toDateKey, addDays } from '../src/utils/dates.ts'
import { calculateDashboard } from '../src/services/dashboard.ts'
import { APPLICATION_ROUTES } from '../src/data/navigation.ts'
import { parseQuickCapture } from '../src/services/quickCapture.ts'

class MemoryStorage {
  #data = new Map()
  get length() { return this.#data.size }
  clear() { this.#data.clear() }
  getItem(key) { return this.#data.has(key) ? this.#data.get(key) : null }
  key(index) { return [...this.#data.keys()][index] ?? null }
  removeItem(key) { this.#data.delete(key) }
  setItem(key, value) { this.#data.set(String(key), String(value)) }
}

test('storage seeds an empty browser store and preserves created events', () => {
  const storage = new MemoryStorage()
  const seeded = ensureSeedData(storage)
  assert.equal(storage.getItem(STORAGE_KEYS.schemaVersion), SCHEMA_VERSION)
  assert.ok(seeded.events.length >= 4)
  const created = { ...seeded.events[0], id: 'created-event', title: 'Созданное мероприятие' }
  saveEvents([created, ...seeded.events], storage)
  assert.equal(loadEvents(storage)[0].id, 'created-event')
  assert.equal(ensureSeedData(storage).events[0].id, 'created-event')
})

test('checklist preset is generated and progress ignores not applicable items', () => {
  const items = createChecklistForEvent('event-test', 'Ужин')
  assert.ok(items.some((item) => item.category === 'catering'))
  const sample = [
    { ...items[0], status: 'done' },
    { ...items[1], status: 'todo' },
    { ...items[2], status: 'not_applicable' },
  ]
  assert.equal(calculateChecklistProgress(sample), 50)
})

test('deadline engine distinguishes today, tomorrow and overdue', () => {
  const now = new Date('2026-09-19T12:00:00')
  assert.equal(getDeadlineState('2026-09-18', now), 'overdue')
  assert.equal(getDeadlineState('2026-09-19', now), 'today')
  assert.equal(getDeadlineState('2026-09-20', now), 'tomorrow')
  assert.equal(getDeadlineState(null, now), 'none')
})

test('risk rules report missing commercial conditions', () => {
  const items = createChecklistForEvent('risk-event', 'Ужин')
  const event = { id: 'risk-event', title: 'Тест', client: 'Client', city: 'Москва', date: toDateKey(addDays(new Date(), 5)), guests: 20, budget: 100000, type: 'Ужин', status: 'В работе', progress: 0 }
  const budget = { eventId: event.id, clientLimit: 100000, baseCost: 0, venue: 70000, catering: 50000, equipment: 0, accommodation: 0, transfer: 0, other: 0, serviceFeePercent: 10, commissionPercent: 0, vatPercent: 0, comment: '', updatedAt: new Date().toISOString() }
  const risks = calculateEventRisks({ event, checklistItems: items, questions: [], budget })
  assert.ok(risks.some((risk) => risk.title.includes('НДС')))
  assert.ok(risks.some((risk) => risk.title.includes('лимит')))
})

test('budget calculator returns total, overage and per guest', () => {
  const summary = calculateBudget({ eventId: 'e', clientLimit: 100000, baseCost: 0, venue: 30000, catering: 50000, equipment: 0, accommodation: 0, transfer: 0, other: 0, serviceFeePercent: 10, commissionPercent: 0, vatPercent: 0, comment: '', updatedAt: '' }, 20)
  assert.equal(summary.total, 88000)
  assert.equal(summary.perGuest, 4400)
  assert.equal(summary.status, 'warning')
})

test('template engine replaces variables and checks deterministic coverage', () => {
  const template = { id: 't', name: 'Запрос', category: 'Работа с площадками', subject: '', body: '', requiredTopics: ['price', 'vat', 'deadline'], custom: false, updatedAt: '' }
  const event = { id: 'e', title: 'Ужин', client: 'Client', city: 'Москва', date: '2026-09-20', guests: 30, budget: 100000, type: 'Ужин', status: 'В работе', progress: 0 }
  const rendered = renderTemplate('{{event.title}} — {{event.city}} — {{event.guests}}', { event })
  assert.equal(rendered, 'Ужин — Москва — 30')
  const coverage = checkTemplateCoverage(template, 'Просим указать стоимость и НДС. Ждём ответ до 20 сентября.')
  assert.equal(coverage.covered, 3)
})

test('backup validates, exports and imports without accepting malformed data', () => {
  const source = new MemoryStorage()
  ensureSeedData(source)
  const backup = createBackup(source)
  assert.equal(validateBackup(backup), true)
  assert.equal(validateBackup({ format: 'eventflow-backup', data: {} }), false)
  const target = new MemoryStorage()
  ensureSeedData(target)
  const targetData = ensureSeedData(target)
  saveEvents([{ ...targetData.events[0], id: 'target-only' }, ...targetData.events], target)
  const imported = importBackup(backup, target)
  assert.equal(imported.events.length, backup.data.events.length + 1)
  assert.equal(imported.templates.length, backup.data.templates.length)
  assert.ok(imported.events.some((event) => event.id === 'target-only'))
  assert.doesNotMatch(JSON.stringify(backup), /githubToken|github_pat_|ghp_/i)
})

test('event edits persist through the storage layer', () => {
  const storage = new MemoryStorage()
  const data = ensureSeedData(storage)
  const edited = { ...data.events[0], city: 'Новый город', guests: 77 }
  saveEvents(data.events.map((event) => event.id === edited.id ? edited : event), storage)
  const loaded = loadEvents(storage).find((event) => event.id === edited.id)
  assert.equal(loaded.city, 'Новый город')
  assert.equal(loaded.guests, 77)
})

test('dashboard aggregates attention items from checklist and questions', () => {
  const storage = new MemoryStorage()
  const data = ensureSeedData(storage)
  const dashboard = calculateDashboard(data)
  assert.equal(dashboard.stats.activeEvents, data.events.length)
  assert.ok(dashboard.attention.some((item) => item.source === 'question'))
  assert.ok(dashboard.risks.length > 0)
})

test('all working routes are declared', () => {
  for (const route of ['/', '/events', '/events/new', '/events/:id', '/contractors', '/templates', '/budget', '/questions', '/settings', '/search']) {
    assert.ok(APPLICATION_ROUTES.includes(route), `missing route ${route}`)
  }
})

test('schema migration preserves existing user entities', () => {
  const storage = new MemoryStorage()
  storage.setItem(STORAGE_KEYS.schemaVersion, '2')
  const customEvent = { id: 'user-event', title: 'Личное мероприятие', client: 'Клиент', city: 'Тула', date: '2026-11-01', guests: 12, budget: 90000, type: 'Ужин', status: 'В работе', progress: 0 }
  const customQuestion = { id: 'user-question', eventId: 'user-event', title: 'Мой вопрос', description: '', responsibleParty: 'Клиент', deadline: null, priority: 'normal', status: 'open', createdAt: '2026-09-19T10:00:00.000Z', resolvedAt: null }
  storage.setItem(STORAGE_KEYS.events, JSON.stringify([customEvent]))
  storage.setItem(STORAGE_KEYS.questions, JSON.stringify([customQuestion]))
  const migrated = ensureSeedData(storage)
  assert.equal(migrated.events[0].id, 'user-event')
  assert.equal(migrated.questions[0].id, 'user-question')
  assert.ok(migrated.checklistItems.some((item) => item.eventId === 'user-event'))
  assert.ok(migrated.budgets.some((item) => item.eventId === 'user-event'))
})

test('quick capture parser proposes money and task actions without applying them', () => {
  const suggestions = parseQuickCapture('Оплатили аванс 120 000 ₽ площадке. Нужно запросить закрывающие документы до 20 мая.', new Date('2026-04-10T12:00:00'))
  const money = suggestions.find((item) => item.kind === 'money')
  const task = suggestions.find((item) => item.kind === 'task')
  assert.equal(money?.amount, 120000)
  assert.match(task?.title ?? '', /Запросить закрывающие документы/i)
  assert.equal(task?.deadline, '2026-05-20')
})

test('GitHub Pages deployment uses the repository base and reload-safe hash routing', () => {
  const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
  const router = readFileSync(new URL('../src/lib/react-router-dom.tsx', import.meta.url), 'utf8')
  const workflow = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8')
  assert.match(viteConfig, /base:\s*['"]\/EventFlow\/['"]/)
  assert.match(router, /window\.location\.hash/)
  assert.match(router, /routerHref\(to\)/)
  assert.match(workflow, /actions\/deploy-pages@v4/)
  assert.match(workflow, /path:\s*\.\/dist/)
})

function createSyncHarness({ client, now = () => new Date('2026-09-25T12:00:00.000Z'), setIntervalFn, clearIntervalFn } = {}) {
  const storage = new MemoryStorage()
  const sessionStorage = new MemoryStorage()
  let data = ensureSeedData(storage)
  sessionStorage.setItem(SYNC_TOKEN_KEY, 'test-token-kept-outside-snapshots')
  const fallbackSnapshot = snapshotFromLocal(data, readSyncMeta(storage), now().toISOString())
  const syncClient = client ?? {
    get: async () => ({ sha: 'sha-1', snapshot: fallbackSnapshot }),
    put: async () => {},
  }
  const engine = new EventFlowSyncEngine({
    storage,
    sessionStorage,
    getLocalData: () => data,
    applySharedData: (shared) => { data = { ...data, ...structuredClone(shared) } },
    client: syncClient,
    now,
    setIntervalFn,
    clearIntervalFn,
  })
  return { storage, sessionStorage, engine, getData: () => data, setData: (next) => { data = next }, fallbackSnapshot }
}

test('local mutations are immediately persisted and enter the dirty queue', () => {
  const storage = new MemoryStorage()
  const data = ensureSeedData(storage)
  const edited = { ...data.events[0], title: 'Локально сохранено' }
  saveEvents(data.events.map((event) => event.id === edited.id ? edited : event), storage)
  markSyncDirty({ events: [edited.id] }, storage, '2026-09-25T10:00:00.000Z')
  assert.equal(loadEvents(storage).find((event) => event.id === edited.id)?.title, 'Локально сохранено')
  const meta = readSyncMeta(storage)
  assert.equal(meta.dirty, true)
  assert.equal(meta.dirtyCount, 1)
  assert.equal(meta.recordVersions.events[edited.id], '2026-09-25T10:00:00.000Z')
})

test('manual save uploads one merged snapshot and clears the dirty queue', async () => {
  let puts = 0
  const harness = createSyncHarness({ client: {
    get: async () => null,
    put: async () => { puts += 1 },
  } })
  markSyncDirty({ events: [harness.getData().events[0].id] }, harness.storage)
  assert.equal(await harness.engine.syncNow(true), true)
  assert.equal(puts, 1)
  assert.equal(readSyncMeta(harness.storage).dirty, false)
  assert.equal(harness.engine.getState().status, 'online')
})

test('autosave timer uploads dirty data after fifteen seconds', async () => {
  const timers = []
  let puts = 0
  const harness = createSyncHarness({
    client: { get: async () => null, put: async () => { puts += 1 } },
    setIntervalFn: (callback, delay) => { timers.push({ callback, delay }); return 1 },
    clearIntervalFn: () => {},
  })
  await harness.engine.start()
  markSyncDirty({ events: [harness.getData().events[0].id] }, harness.storage)
  assert.equal(timers[0].delay, 15_000)
  timers[0].callback()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(puts, 1)
  harness.engine.stop()
})

test('dirty threshold triggers an early batched save', async () => {
  let puts = 0
  const harness = createSyncHarness({ client: { get: async () => null, put: async () => { puts += 1 } } })
  for (let index = 0; index < SYNC_DIRTY_THRESHOLD; index += 1) markSyncDirty({ events: [harness.getData().events[0].id] }, harness.storage)
  harness.engine.notifyLocalChange()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(puts, 1)
})

test('parallel save calls share one request', async () => {
  let resolvePut
  let puts = 0
  const pending = new Promise((resolve) => { resolvePut = resolve })
  const harness = createSyncHarness({ client: { get: async () => null, put: async () => { puts += 1; await pending } } })
  markSyncDirty({ events: [harness.getData().events[0].id] }, harness.storage)
  const first = harness.engine.syncNow(true)
  const second = harness.engine.syncNow(true)
  assert.equal(first, second)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(puts, 1)
  resolvePut()
  assert.equal(await first, true)
})

test('changes made during an active save remain dirty for the next batch', async () => {
  let resolvePut
  const pending = new Promise((resolve) => { resolvePut = resolve })
  const harness = createSyncHarness({ client: { get: async () => null, put: async () => { await pending } } })
  const firstId = harness.getData().events[0].id
  markSyncDirty({ events: [firstId] }, harness.storage, '2026-09-25T10:00:00.000Z')
  const save = harness.engine.syncNow(true)
  await new Promise((resolve) => setImmediate(resolve))
  markSyncDirty({ events: [firstId] }, harness.storage, '2026-09-25T10:01:00.000Z')
  resolvePut()
  await save
  assert.equal(readSyncMeta(harness.storage).dirty, true)
  assert.equal(harness.engine.getState().status, 'dirty')
})

test('two devices merge independent records by stable id', () => {
  const left = normalizeSnapshot({ version: 1, updated_at: '2026-09-25T10:00:00.000Z', data: { events: [{ id: 'left', title: 'Left' }] } })
  const right = normalizeSnapshot({ version: 1, updated_at: '2026-09-25T10:01:00.000Z', data: { events: [{ id: 'right', title: 'Right' }] } })
  const merged = mergeSnapshots(left, right, '2026-09-25T10:02:00.000Z')
  assert.deepEqual(new Set(merged.data.events.map((event) => event.id)), new Set(['left', 'right']))
})

test('newer record version wins during conflict merge', () => {
  const older = normalizeSnapshot({ version: 1, updated_at: '2026-09-25T10:00:00.000Z', data: { events: [{ id: 'same', title: 'Older' }] }, record_versions: { events: { same: '2026-09-25T10:00:00.000Z' } } })
  const newer = normalizeSnapshot({ version: 1, updated_at: '2026-09-25T10:02:00.000Z', data: { events: [{ id: 'same', title: 'Newer' }] }, record_versions: { events: { same: '2026-09-25T10:02:00.000Z' } } })
  assert.equal(mergeSnapshots(older, newer).data.events[0].title, 'Newer')
  assert.equal(mergeSnapshots(newer, older).data.events[0].title, 'Newer')
})

test('a tombstone prevents deleted records from being resurrected', () => {
  const storage = new MemoryStorage()
  const data = ensureSeedData(storage)
  const id = data.events[0].id
  markDeleted('events', id, storage, '2026-09-25T11:00:00.000Z')
  const local = snapshotFromLocal({ ...data, events: data.events.filter((event) => event.id !== id) }, readSyncMeta(storage), '2026-09-25T11:01:00.000Z')
  const remote = normalizeSnapshot({ version: 1, updated_at: '2026-09-25T10:00:00.000Z', data: { events: [data.events[0]] } })
  assert.equal(mergeSnapshots(local, remote).data.events.some((event) => event.id === id), false)
})

test('409 is retried once and a second conflict pauses autosave', async () => {
  let gets = 0
  let puts = 0
  const harness = createSyncHarness({ client: {
    get: async () => { gets += 1; return { sha: `sha-${gets}`, snapshot: harness.fallbackSnapshot } },
    put: async () => { puts += 1; throw new SyncConflictError() },
  } })
  markSyncDirty({ events: [harness.getData().events[0].id] }, harness.storage)
  assert.equal(await harness.engine.syncNow(true), false)
  assert.equal(gets, 2)
  assert.equal(puts, 2)
  assert.equal(readSyncMeta(harness.storage).autosavePaused, true)
  assert.equal(harness.engine.getState().status, 'error')
})

test('legacy online JSON and legacy localStorage are migrated without data loss', () => {
  const legacyOnline = normalizeSnapshot({ events: [{ id: 'legacy-online', title: 'Old JSON' }], tasks: [] }, '2020-01-01T00:00:00.000Z')
  assert.equal(legacyOnline.version, 1)
  assert.equal(legacyOnline.data.events[0].id, 'legacy-online')
  assert.ok(legacyOnline.record_versions.events['legacy-online'])

  const storage = new MemoryStorage()
  storage.setItem(STORAGE_KEYS.schemaVersion, '2')
  storage.setItem(STORAGE_KEYS.events, JSON.stringify([{ id: 'legacy-local', title: 'Old localStorage' }]))
  assert.equal(ensureSeedData(storage).events[0].id, 'legacy-local')
})

test('sync metadata and session token never enter backups or shared JSON', () => {
  const storage = new MemoryStorage()
  const sessionStorage = new MemoryStorage()
  const data = ensureSeedData(storage)
  sessionStorage.setItem(SYNC_TOKEN_KEY, 'github_pat_secret-example')
  storage.setItem(SYNC_META_KEY, JSON.stringify({ technical: true }))
  const backup = JSON.stringify(createBackup(storage))
  const shared = JSON.stringify(snapshotFromLocal(data, readSyncMeta(storage), new Date().toISOString()))
  const committed = readFileSync(new URL('../data/eventflow-data.json', import.meta.url), 'utf8')
  for (const value of [backup, shared, committed]) {
    assert.doesNotMatch(value, /github_pat_secret-example/)
    assert.doesNotMatch(value, /eventflow\.githubToken/)
    assert.doesNotMatch(value, /eventflow\.syncMeta/)
  }
})
