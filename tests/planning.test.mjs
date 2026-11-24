import test from 'node:test'
import assert from 'node:assert/strict'
import { createNotebookEvent, createServiceInstance } from '../src/config/servicePresets.ts'
import { createBackup, deleteEventWorkspace, ensureSeedData, importBackup, loadAll, MIGRATION_BACKUP_KEY, saveAll, SCHEMA_VERSION, STORAGE_KEYS } from '../src/services/storage.ts'
import { patchRegistryTask, taskRegistry } from '../src/services/taskRegistry.ts'
import { calendarEntries, entriesOnDay } from '../src/services/planningCalendar.ts'
import { dayInZone, urgency, zonedDateTime } from '../src/services/planningDates.ts'
import { EventFlowSyncEngine, initializeSyncState, markSyncDirty, mergeSnapshots, normalizeSnapshot, readSyncMeta, snapshotFromLocal, SYNC_TOKEN_KEY } from '../src/services/sync.ts'
import { attentionEventIds, compareAttentionEvents } from '../src/services/eventAttention.ts'

class MemoryStorage {
  values = new Map()
  getItem(k) { return this.values.get(k) ?? null }
  setItem(k, v) { this.values.set(k, String(v)) }
  removeItem(k) { this.values.delete(k) }
}
function fixture() {
  const event = createNotebookEvent({ id: 'synthetic-event', title: 'Учебная конференция', dateFrom: '2026-11-20', dateTo: '2026-11-22', commonChecklist: [{ id: 'common', title: 'Смета', completed: false }], services: [createServiceInstance('synthetic-event', 'catering')], waitingItems: [{ id: 'wait', text: 'Ответ по меню', completed: false, createdAt: '2026-11-01T00:00:00Z' }], nextStep: 'Связаться с клиентом' })
  return { events: [event], checklistItems: [{ id: 'quick', eventId: event.id, title: 'Из быстрой записи', category: 'general', status: 'todo', priority: 'normal', deadline: null, completedAt: null, notes: '', createdAt: '', updatedAt: '' }], questions: [{ id: 'question', eventId: event.id, title: 'Уточнение', status: 'open', priority: 'normal', deadline: null }], tasks: [{ id: 'legacy', eventId: event.id, title: 'Старая задача', deadline: '', status: 'Сегодня', priority: 'Высокий' }], activities: [], contractors: [], templates: [], budgets: [], risks: [], floodEntries: [], settings: { userName: 'Учебный профиль', timeZone: 'Europe/Moscow' } }
}

test('registry reads every source once and never turns history or flood into tasks', () => {
  const data = fixture()
  data.activities = [{ id: 'log', type: 'checklist', entityId: 'quick', eventId: data.events[0].id }]
  data.floodEntries = [{ id: 'letter', text: 'Оплатить 50 000 до завтра', eventId: null, status: 'new' }]
  const tasks = taskRegistry(data)
  assert.deepEqual(new Set(tasks.map((t) => t.source)), new Set(['common', 'service', 'waiting', 'next', 'checklist', 'question', 'legacy']))
  assert.equal(tasks.length, new Set(tasks.map((t) => t.key)).size)
  assert.equal(tasks.filter((t) => t.sourceId === 'quick').length, 1)
  assert.equal(tasks.some((t) => t.sourceId === 'letter'), false)
  data.tasks.push({ id: 'alias', sourceKey: tasks[0].key, eventId: data.events[0].id, title: 'Alias' })
  assert.equal(taskRegistry(data).length, tasks.length)
})

test('every task can be edited through the registry without replacing siblings or changing IDs', () => {
  const original = fixture()
  for (const task of taskRegistry(original)) {
    const updated = patchRegistryTask(original, task.key, { manualHot: true, priority: 'critical', deadline: '2026-11-20', reminderAt: '2026-11-19T10:00:00Z', tags: ['Клиент'], status: 'done' })
    const next = taskRegistry(updated).find((t) => t.key === task.key)
    assert.equal(next.status, 'done', task.key)
    assert.equal(next.manualHot, true)
    assert.deepEqual(next.tags, ['Клиент'])
    assert.equal(taskRegistry(updated).length, taskRegistry(original).length)
    assert.equal(taskRegistry(original).find((t) => t.key === task.key).status === 'done', false)
    const reopened = patchRegistryTask(updated, task.key, { status: 'waiting' })
    assert.equal(taskRegistry(reopened).find((t) => t.key === task.key).status, 'waiting')
  }
})

test('importance, manual hot flag and automatic urgency are independent', () => {
  const data = fixture(), first = taskRegistry(data)[0]
  const next = patchRegistryTask(data, first.key, { manualHot: true, priority: 'low' })
  const task = taskRegistry(next)[0]
  assert.equal(task.manualHot, true)
  assert.equal(task.priority, 'low')
  assert.equal(urgency(task.deadline), 'none')
})

test('calendar includes every day of a multiday event and separate task deadlines/reminders', () => {
  const data = fixture(), key = taskRegistry(data)[0].key
  const updated = patchRegistryTask(data, key, { deadline: '2026-11-21', reminderAt: '2026-11-20T22:30:00Z' })
  const calendar = calendarEntries(updated, 'Europe/Moscow')
  for (const day of ['2026-11-20', '2026-11-21', '2026-11-22']) assert.equal(entriesOnDay(calendar, day).filter((e) => e.kind === 'event').length, 1)
  assert.equal(entriesOnDay(calendar, '2026-11-23').length, 0)
  assert.equal(calendar.filter((e) => e.taskKey === key).length, 2)
  assert.equal(calendar.find((e) => e.kind === 'reminder').startDay, '2026-11-21')
  const completed = patchRegistryTask(updated, key, { status: 'done' })
  assert.equal(calendarEntries(completed).some((e) => e.taskKey === key), false)
})

test('date-only deadlines expire at local day end; timestamps keep the actual instant', () => {
  assert.equal(urgency('2026-11-20', new Date('2026-11-20T20:59:59Z'), 'Europe/Moscow'), 'today')
  assert.equal(urgency('2026-11-20', new Date('2026-11-20T21:00:00Z'), 'Europe/Moscow'), 'overdue')
  assert.equal(urgency('2026-11-20T10:00:00Z', new Date('2026-11-20T10:00:00Z')), 'overdue')
  assert.equal(dayInZone('2026-11-20T22:30:00Z', 'Europe/Moscow'), '2026-11-21')
  assert.equal(zonedDateTime('2026-11-20T15:00', 'Europe/Moscow'), '2026-11-20T12:00:00.000Z')
  assert.equal(zonedDateTime('2026-03-08T02:30', 'America/New_York'), null)
})

test('migration is backed up, idempotent and preserves data, empty lists and new metadata', () => {
  const storage = new MemoryStorage(), data = fixture()
  data.events[0].services = []; data.events[0].commonChecklist = []; data.events[0].pinned = true
  data.floodEntries = [{ id: 'flood-1', text: 'Учебная переписка\nВторая строка', eventId: null, status: 'new', createdAt: '', updatedAt: '' }]
  saveAll(data, storage); storage.setItem(STORAGE_KEYS.schemaVersion, '6')
  const before = storage.getItem(STORAGE_KEYS.events)
  const next = ensureSeedData(storage)
  assert.equal(storage.getItem(STORAGE_KEYS.schemaVersion), SCHEMA_VERSION)
  assert.equal(JSON.parse(storage.getItem(MIGRATION_BACKUP_KEY)).records[STORAGE_KEYS.events], before)
  assert.deepEqual(JSON.parse(JSON.stringify(next)), JSON.parse(JSON.stringify(data)))
  assert.deepEqual(ensureSeedData(storage), next)
  assert.equal(readSyncMeta(storage).tombstones.events.length, 0)
  assert.equal(next.events[0].pinned, true)
})

test('failed write-ahead backup does not mutate existing storage', () => {
  const storage = new MemoryStorage(); saveAll(fixture(), storage); storage.setItem(STORAGE_KEYS.schemaVersion, '6')
  const before = [...storage.values]
  storage.setItem = () => { throw new Error('QuotaExceeded') }
  assert.throws(() => ensureSeedData(storage), /QuotaExceeded/)
  assert.deepEqual([...storage.values], before)
})

test('backup and two-device merge preserve tasks and independent flood records, including trash', () => {
  const storage = new MemoryStorage(), data = fixture()
  data.floodEntries = [{ id: 'left', text: 'Письмо', status: 'deleted', previousStatus: 'new', eventId: null, createdAt: '2026-11-20T10:00:00Z', updatedAt: '2026-11-20T10:00:00Z' }]
  const modified = patchRegistryTask(data, taskRegistry(data)[0].key, { manualHot: true, priority: 'high', tags: ['Меню'] })
  saveAll(modified, storage)
  const backup = createBackup(storage), other = new MemoryStorage()
  saveAll(fixture(), other); importBackup(backup, other)
  assert.deepEqual(loadAll(other).floodEntries, data.floodEntries)
  assert.equal(taskRegistry(loadAll(other))[0].manualHot, true)
  const left = snapshotFromLocal(modified, readSyncMeta(storage), '2026-11-20T10:00:00Z')
  const right = normalizeSnapshot({ version: 1, updated_at: '2026-11-20T11:00:00Z', data: { floodEntries: [{ id: 'right', text: 'Второе письмо', status: 'new' }] } })
  const merged = mergeSnapshots(left, right)
  assert.deepEqual(new Set(merged.data.floodEntries.map((e) => e.id)), new Set(['left', 'right']))
  assert.equal(merged.data.floodEntries.find((e) => e.id === 'left').status, 'deleted')
  assert.equal(taskRegistry({ ...modified, ...merged.data })[0].manualHot, true)
})

test('deleting an event detaches flood records without deleting their text', () => {
  const storage = new MemoryStorage(), data = fixture()
  data.floodEntries = [{ id: 'letter', text: 'Сохранить письмо', eventId: data.events[0].id, status: 'archive', createdAt: '', updatedAt: '' }]
  const next = deleteEventWorkspace(data.events[0].id, data, storage)
  assert.equal(next.floodEntries[0].eventId, null)
  assert.equal(next.floodEntries[0].text, 'Сохранить письмо')
  assert.equal(next.floodEntries[0].status, 'archive')
})

test('a first online response cannot discard edits made while it was loading', async () => {
  const storage = new MemoryStorage(), session = new MemoryStorage()
  let data = fixture(), resolveRead
  saveAll(data, storage); initializeSyncState(false, storage)
  const remote = normalizeSnapshot({ version: 1, data: { events: [createNotebookEvent({ id: 'remote', title: 'Другое мероприятие' })] } })
  const engine = new EventFlowSyncEngine({ storage, sessionStorage: session, getLocalData: () => data, applySharedData: (shared) => { data = { ...data, ...shared } }, client: { get: () => new Promise((resolve) => { resolveRead = resolve }), put: async () => {} } })
  const loading = engine.loadOnline()
  data.floodEntries = [{ id: 'typed', text: 'Написано во время загрузки', eventId: null, status: 'new' }]
  markSyncDirty({ floodEntries: ['typed'] }, storage)
  resolveRead({ sha: 'remote', snapshot: remote })
  await loading
  assert.equal(data.floodEntries[0].id, 'typed')
  assert.ok(data.events.some((e) => e.id === 'remote'))
})

test('connection errors do not show a misleading green online status', async () => {
  const storage = new MemoryStorage(), sessionStorage = new MemoryStorage(), data = fixture()
  saveAll(data, storage); sessionStorage.setItem(SYNC_TOKEN_KEY, 'synthetic-token')
  const engine = new EventFlowSyncEngine({ storage, sessionStorage, getLocalData: () => data, applySharedData: () => assert.fail('Failed fetch cannot overwrite data'), client: { get: async () => { throw new Error('GitHub API: HTTP 401') }, put: async () => {} } })
  await engine.loadOnline()
  assert.equal(engine.getState().status, 'error')
  assert.match(engine.getState().error, /401/)
  assert.equal(loadAll(storage).events[0].id, data.events[0].id)
})

test('independent task edits inside one event survive two-device synchronization', () => {
  const initial = fixture(), tasks = taskRegistry(initial)
  const left = patchRegistryTask(initial, tasks.find((t) => t.source === 'common').key, { priority: 'critical' }, '2026-11-20T10:00:00Z')
  const right = patchRegistryTask(initial, tasks.find((t) => t.source === 'service').key, { manualHot: true }, '2026-11-20T11:00:00Z')
  const a = normalizeSnapshot({ version: 1, updated_at: '2026-11-20T10:00:00Z', data: left })
  const b = normalizeSnapshot({ version: 1, updated_at: '2026-11-20T11:00:00Z', data: right })
  for (const combined of [mergeSnapshots(a, b), mergeSnapshots(b, a)]) {
    const registry = taskRegistry({ ...initial, ...combined.data })
    assert.equal(registry.find((t) => t.source === 'common').priority, 'critical')
    assert.equal(registry.find((t) => t.source === 'service').manualHot, true)
  }
  const serviceId = initial.events[0].services[0].id
  right.events[0] = { ...right.events[0], services: [], removedServices: { [serviceId]: '2099-01-01T00:00:00Z' } }
  const removed = normalizeSnapshot({ version: 1, updated_at: '2099-01-01T00:00:00Z', data: right })
  assert.equal(mergeSnapshots(a, removed).data.events[0].services.length, 0)
})

test('150 undated checklist items do not become 150 attention items or mark an event urgent', () => {
  const data = fixture()
  data.events[0].dateFrom = '2027-10-01'; data.events[0].dateTo = '2027-10-02'
  data.events[0].waitingItems = []
  data.events[0].services[0].checklist = Array.from({ length: 150 }, (_, index) => ({ id: `item-${index}`, title: `Пункт ${index}`, completed: false }))
  const before = JSON.stringify(data)
  assert.equal(attentionEventIds(data, new Date('2026-11-24T12:00:00Z')).size, 0)
  assert.equal(JSON.stringify(data), before)
  data.events[0].attentionFlags = ['important', 'hot']
  assert.deepEqual([...attentionEventIds(data, new Date('2026-11-24T12:00:00Z'))], ['synthetic-event'])
  assert.equal(data.events[0].services[0].checklist.length, 150)
})

test('event-level flags and categories survive backup and sync without altering notebook records', () => {
  const data = fixture(), storage = new MemoryStorage()
  data.events[0] = { ...data.events[0], pinned: true, attentionFlags: ['important', 'urgent', 'hot'], tags: ['VIP', 'Выездное'] }
  const checklist = structuredClone(data.events[0].services[0].checklist)
  saveAll(data, storage)
  const copy = new MemoryStorage(); saveAll(fixture(), copy); importBackup(createBackup(storage), copy)
  const event = loadAll(copy).events[0]
  assert.deepEqual(event.attentionFlags, ['important', 'urgent', 'hot'])
  assert.deepEqual(event.tags, ['VIP', 'Выездное'])
  assert.deepEqual(event.services[0].checklist, checklist)
  const shared = mergeSnapshots(snapshotFromLocal(loadAll(copy), readSyncMeta(copy), '2026-11-24T12:00:00Z'), normalizeSnapshot({ events: [] }))
  assert.deepEqual(shared.data.events[0].tags, ['VIP', 'Выездное'])
  assert.equal(compareAttentionEvents(event, { ...event, id: 'other', pinned: false }), -1)
})
