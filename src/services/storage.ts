import { seedBudgets, seedChecklistItems, seedContractors, seedQuestions, seedSettings, seedTemplates } from '../data/extendedSeed.ts'
import { seedActivities, seedEvents, seedRisks, seedTasks } from '../data/seed.ts'
import { createChecklistForEvent } from '../config/checklistPresets.ts'
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

export const SCHEMA_VERSION = '3'

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

export function ensureSeedData(storage: Storage = window.localStorage): EventFlowData {
  const version = storage.getItem(STORAGE_KEYS.schemaVersion)
  if (!version) saveAll(seedData, storage)
  else if (version !== SCHEMA_VERSION) {
    const existing = loadAll(storage)
    const events = existing.events
    const checklistItems = existing.checklistItems
    const budgets = existing.budgets
    for (const event of events) {
      if (!checklistItems.some((item) => item.eventId === event.id)) checklistItems.push(...createChecklistForEvent(event.id, event.type))
      if (!budgets.some((item) => item.eventId === event.id)) budgets.push({ eventId: event.id, clientLimit: event.budget, baseCost: 0, venue: 0, catering: 0, equipment: 0, accommodation: 0, transfer: 0, other: 0, serviceFeePercent: 0, commissionPercent: 0, vatPercent: 0, comment: '', updatedAt: new Date().toISOString() })
    }
    const migrated: EventFlowData = { ...existing, events, checklistItems, budgets }
    saveAll(migrated, storage)
  } else {
    for (const [name, key] of Object.entries(STORAGE_KEYS)) {
      if (name !== 'schemaVersion' && storage.getItem(key) === null) {
        const fallback = seedData[name as keyof EventFlowData]
        if (fallback !== undefined) write(storage, key, fallback)
      }
    }
  }
  return loadAll(storage)
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
    events: mergeById(current.events, backup.data.events),
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
