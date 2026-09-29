import { seedBudgets, seedChecklistItems, seedContractors, seedQuestions, seedSettings, seedTemplates } from '../data/extendedSeed.ts'
import { seedActivities, seedEvents, seedRisks, seedTasks } from '../data/seed.ts'
import { createNotebookEvent, createServiceInstance, inferServiceTypes } from '../config/servicePresets.ts'
import { markDeleted, markSyncDirty, type SharedCollection } from './sync.ts'
import type { Activity, AppSettings, BackupPayload, ChecklistItem, Contractor, Event, EventBudget, MessageTemplate, OpenQuestion, Risk, Task } from '../types/index.ts'

export const STORAGE_KEYS = {
  schemaVersion: 'eventflow.schemaVersion',
  events: 'eventflow.events',
  tasks: 'eventflow.tasks',
  risks: 'eventflow.risks',
  activities: 'eventflow.activities',
  checklistItems: 'eventflow.checklistItems',
  questions: 'eventflow.questions',
  contractors: 'eventflow.contractors',
  templates: 'eventflow.templates',
  budgets: 'eventflow.budgets',
  settings: 'eventflow.settings',
} as const

export const SCHEMA_VERSION = '6'

const WORKSPACE_COLLECTIONS: SharedCollection[] = ['events', 'tasks', 'risks', 'activities', 'checklistItems', 'questions', 'contractors', 'budgets']

export interface EventFlowData {
  events: Event[]
  tasks: Task[]
  risks: Risk[]
  activities: Activity[]
  checklistItems: ChecklistItem[]
  questions: OpenQuestion[]
  contractors: Contractor[]
  templates: MessageTemplate[]
  budgets: EventBudget[]
  settings: AppSettings
}

const seedData: EventFlowData = {
  events: seedEvents,
  tasks: seedTasks,
  risks: seedRisks,
  activities: seedActivities,
  checklistItems: seedChecklistItems,
  questions: seedQuestions,
  contractors: seedContractors,
  templates: seedTemplates,
  budgets: seedBudgets,
  settings: seedSettings,
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function read<T>(storage: Storage, key: string, fallback: T): T {
  const raw = storage.getItem(key)
  if (!raw) return clone(fallback)
  try { return JSON.parse(raw) as T } catch { return clone(fallback) }
}
function write<T>(storage: Storage, key: string, value: T) { storage.setItem(key, JSON.stringify(value)) }

function markSeedDataForSync(storage: Storage, timestamp: string) {
  markSyncDirty({
    events: seedData.events.map((item) => item.id),
    tasks: seedData.tasks.map((item) => item.id),
    risks: seedData.risks.map((item) => item.id),
    activities: seedData.activities.map((item) => item.id),
    checklistItems: seedData.checklistItems.map((item) => item.id),
    questions: seedData.questions.map((item) => item.id),
    contractors: seedData.contractors.map((item) => item.id),
    templates: seedData.templates.map((item) => item.id),
    budgets: seedData.budgets.map((item) => item.eventId),
  }, storage, timestamp)
}

export function saveAll(data: EventFlowData, storage: Storage = window.localStorage) {
  write(storage, STORAGE_KEYS.events, data.events)
  write(storage, STORAGE_KEYS.tasks, data.tasks)
  write(storage, STORAGE_KEYS.risks, data.risks)
  write(storage, STORAGE_KEYS.activities, data.activities)
  write(storage, STORAGE_KEYS.checklistItems, data.checklistItems)
  write(storage, STORAGE_KEYS.questions, data.questions)
  write(storage, STORAGE_KEYS.contractors, data.contractors)
  write(storage, STORAGE_KEYS.templates, data.templates)
  write(storage, STORAGE_KEYS.budgets, data.budgets)
  write(storage, STORAGE_KEYS.settings, data.settings)
  storage.setItem(STORAGE_KEYS.schemaVersion, SCHEMA_VERSION)
}

export function deleteEventWorkspace(eventId: string, data: EventFlowData, storage: Storage = window.localStorage, timestamp = new Date().toISOString()) {
  const removed = {
    events: data.events.filter((item) => item.id === eventId),
    tasks: data.tasks.filter((item) => item.eventId === eventId),
    risks: data.risks.filter((item) => item.eventId === eventId),
    activities: data.activities.filter((item) => item.eventId === eventId),
    checklistItems: data.checklistItems.filter((item) => item.eventId === eventId),
    questions: data.questions.filter((item) => item.eventId === eventId),
    budgets: data.budgets.filter((item) => item.eventId === eventId),
  }
  const next: EventFlowData = {
    ...data,
    events: data.events.filter((item) => item.id !== eventId),
    tasks: data.tasks.filter((item) => item.eventId !== eventId),
    risks: data.risks.filter((item) => item.eventId !== eventId),
    activities: data.activities.filter((item) => item.eventId !== eventId),
    checklistItems: data.checklistItems.filter((item) => item.eventId !== eventId),
    questions: data.questions.filter((item) => item.eventId !== eventId),
    budgets: data.budgets.filter((item) => item.eventId !== eventId),
  }
  saveAll(next, storage)
  for (const event of removed.events) markDeleted('events', event.id, storage, timestamp)
  for (const task of removed.tasks) markDeleted('tasks', task.id, storage, timestamp)
  for (const risk of removed.risks) markDeleted('risks', risk.id, storage, timestamp)
  for (const activity of removed.activities) markDeleted('activities', activity.id, storage, timestamp)
  for (const item of removed.checklistItems) markDeleted('checklistItems', item.id, storage, timestamp)
  for (const question of removed.questions) markDeleted('questions', question.id, storage, timestamp)
  for (const budget of removed.budgets) markDeleted('budgets', budget.eventId, storage, timestamp)
  return next
}

export function ensureSeedData(storage: Storage = window.localStorage): EventFlowData {
  const version = storage.getItem(STORAGE_KEYS.schemaVersion)
  if (!version) {
    saveAll(seedData, storage)
    markSeedDataForSync(storage, new Date().toISOString())
  }
  else if (version !== SCHEMA_VERSION) {
    const existing = loadAll(storage)
    const timestamp = new Date().toISOString()
    for (const collection of WORKSPACE_COLLECTIONS) {
      for (const item of existing[collection]) {
        const record = item as unknown as Record<string, unknown>
        const id = String(collection === 'budgets' ? record.eventId ?? '' : record.id ?? '')
        if (id) markDeleted(collection, id, storage, timestamp)
      }
    }
    saveAll(seedData, storage)
    markSeedDataForSync(storage, timestamp)
  } else {
    for (const [name, key] of Object.entries(STORAGE_KEYS)) {
      if (name !== 'schemaVersion' && storage.getItem(key) === null) {
        const fallback = seedData[name as keyof EventFlowData]
        if (fallback !== undefined) write(storage, key, fallback)
      }
    }
  }
  const loaded = loadAll(storage)
  const normalizedEvents = loaded.events.map((event) => migrateEvent(event))
  if (JSON.stringify(normalizedEvents) !== JSON.stringify(loaded.events)) {
    loaded.events = normalizedEvents
    saveEvents(normalizedEvents, storage)
  }
  return loaded
}

export function migrateEvent(raw: Event): Event {
  const event = createNotebookEvent(raw)
  if (!event.services.length) {
    const types = inferServiceTypes(`${raw.type ?? ''} ${raw.title ?? ''}`)
    event.services = types.map((type) => createServiceInstance(event.id, type))
  }
  return event
}

export function loadAll(storage: Storage = window.localStorage): EventFlowData {
  return {
    events: loadEvents(storage), tasks: loadTasks(storage), risks: loadRisks(storage), activities: loadActivities(storage),
    checklistItems: loadChecklistItems(storage), questions: loadQuestions(storage), contractors: loadContractors(storage),
    templates: loadTemplates(storage), budgets: loadBudgets(storage), settings: loadSettings(storage),
  }
}

export function resetToDemo(storage: Storage = window.localStorage) { saveAll(seedData, storage); return loadAll(storage) }

export function createBackup(storage: Storage = window.localStorage): BackupPayload {
  const data = loadAll(storage)
  return { format: 'eventflow-backup', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: { events: data.events, checklistItems: data.checklistItems, questions: data.questions, contractors: data.contractors, templates: data.templates, budgets: data.budgets, activities: data.activities, tasks: data.tasks, risks: data.risks, settings: data.settings } }
}

export function validateBackup(value: unknown): value is BackupPayload {
  if (!value || typeof value !== 'object') return false
  const backup = value as Partial<BackupPayload>
  if (backup.format !== 'eventflow-backup' || !backup.data || typeof backup.data !== 'object') return false
  const data = backup.data as Partial<BackupPayload['data']>
  return ['events', 'checklistItems', 'questions', 'contractors', 'templates', 'budgets', 'activities', 'tasks'].every((key) => Array.isArray(data[key as keyof typeof data])) && !!data.settings && typeof data.settings === 'object'
}

export function importBackup(backup: BackupPayload, storage: Storage = window.localStorage) {
  if (!validateBackup(backup)) throw new Error('Некорректная структура резервной копии')
  const current = loadAll(storage)
  const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]) => {
    const merged = new Map(existing.map((item) => [item.id, item]))
    for (const item of incoming) merged.set(item.id, clone(item))
    return [...merged.values()]
  }
  const mergeBudgets = (existing: EventBudget[], incoming: EventBudget[]) => {
    const merged = new Map(existing.map((item) => [item.eventId, item]))
    for (const item of incoming) merged.set(item.eventId, clone(item))
    return [...merged.values()]
  }
  saveAll({
    ...current,
    events: mergeById(current.events, backup.data.events).map(migrateEvent),
    tasks: mergeById(current.tasks, backup.data.tasks),
    risks: mergeById(current.risks, backup.data.risks ?? []),
    activities: mergeById(current.activities, backup.data.activities),
    checklistItems: mergeById(current.checklistItems, backup.data.checklistItems),
    questions: mergeById(current.questions, backup.data.questions),
    contractors: mergeById(current.contractors, backup.data.contractors),
    templates: mergeById(current.templates, backup.data.templates),
    budgets: mergeBudgets(current.budgets, backup.data.budgets),
    settings: { ...current.settings, ...clone(backup.data.settings) },
  }, storage)
  return loadAll(storage)
}

export const loadEvents = (storage: Storage = window.localStorage) => read<Event[]>(storage, STORAGE_KEYS.events, seedEvents)
export const saveEvents = (value: Event[], storage: Storage = window.localStorage) => write(storage, STORAGE_KEYS.events, value)
export const loadTasks = (storage: Storage = window.localStorage) => read<Task[]>(storage, STORAGE_KEYS.tasks, seedTasks)
export const saveTasks = (value: Task[], storage: Storage = window.localStorage) => write(storage, STORAGE_KEYS.tasks, value)
export const loadRisks = (storage: Storage = window.localStorage) => read<Risk[]>(storage, STORAGE_KEYS.risks, seedRisks)
export const saveRisks = (value: Risk[], storage: Storage = window.localStorage) => write(storage, STORAGE_KEYS.risks, value)
export const loadActivities = (storage: Storage = window.localStorage) => read<Activity[]>(storage, STORAGE_KEYS.activities, seedActivities)
export const saveActivities = (value: Activity[], storage: Storage = window.localStorage) => write(storage, STORAGE_KEYS.activities, value)
export const loadChecklistItems = (storage: Storage = window.localStorage) => read<ChecklistItem[]>(storage, STORAGE_KEYS.checklistItems, seedChecklistItems)
export const saveChecklistItems = (value: ChecklistItem[], storage: Storage = window.localStorage) => write(storage, STORAGE_KEYS.checklistItems, value)
export const loadQuestions = (storage: Storage = window.localStorage) => read<OpenQuestion[]>(storage, STORAGE_KEYS.questions, seedQuestions)
export const saveQuestions = (value: OpenQuestion[], storage: Storage = window.localStorage) => write(storage, STORAGE_KEYS.questions, value)
export const loadContractors = (storage: Storage = window.localStorage) => read<Contractor[]>(storage, STORAGE_KEYS.contractors, seedContractors)
export const saveContractors = (value: Contractor[], storage: Storage = window.localStorage) => write(storage, STORAGE_KEYS.contractors, value)
export const loadTemplates = (storage: Storage = window.localStorage) => read<MessageTemplate[]>(storage, STORAGE_KEYS.templates, seedTemplates)
export const saveTemplates = (value: MessageTemplate[], storage: Storage = window.localStorage) => write(storage, STORAGE_KEYS.templates, value)
export const loadBudgets = (storage: Storage = window.localStorage) => read<EventBudget[]>(storage, STORAGE_KEYS.budgets, seedBudgets)
export const saveBudgets = (value: EventBudget[], storage: Storage = window.localStorage) => write(storage, STORAGE_KEYS.budgets, value)
export const loadSettings = (storage: Storage = window.localStorage) => read<AppSettings>(storage, STORAGE_KEYS.settings, seedSettings)
export const saveSettings = (value: AppSettings, storage: Storage = window.localStorage) => write(storage, STORAGE_KEYS.settings, value)
