import { createContext, type ReactNode, useContext, useMemo, useState } from 'react'
import { calculateChecklistProgress, createChecklistForEvent } from '../config/checklistPresets.ts'
import { ensureSeedData, saveActivities, saveBudgets, saveChecklistItems, saveContractors, saveEvents, saveQuestions, saveSettings, saveTemplates, STORAGE_KEYS, type EventFlowData } from '../services/storage.ts'
import { initializeSyncState, markSyncDirty } from '../services/sync.ts'
import type { Activity, AppSettings, ChecklistItem, Contractor, Event, EventBudget, MessageTemplate, OpenQuestion } from '../types/index.ts'

type ActivityInput = Omit<Activity, 'id' | 'timestamp'>

interface EventFlowContextValue extends EventFlowData {
  addEvent: (event: Event) => void
  updateEvent: (event: Event) => void
  updateChecklistItem: (item: ChecklistItem) => void
  addChecklistItem: (item: ChecklistItem) => void
  addQuestion: (question: OpenQuestion) => void
  updateQuestion: (question: OpenQuestion) => void
  saveBudget: (budget: EventBudget) => void
  addExpense: (eventId: string, amount: number, description: string) => void
  saveContractor: (contractor: Contractor) => void
  saveTemplate: (template: MessageTemplate) => void
  updateSettings: (settings: AppSettings) => void
  logActivity: (activity: ActivityInput) => void
  reloadData: () => void
}

const EventFlowContext = createContext<EventFlowContextValue | null>(null)

function makeActivity(input: ActivityInput): Activity {
  return { ...input, id: `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`, timestamp: new Date().toISOString() }
}

export function EventFlowProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(() => {
    const hadLocalData = window.localStorage.getItem(STORAGE_KEYS.schemaVersion) !== null
    const initial = ensureSeedData()
    initializeSyncState(hadLocalData)
    return initial
  })
  const reloadData = () => setData(ensureSeedData())

  const value = useMemo<EventFlowContextValue>(() => ({
    ...data,
    reloadData,
    addEvent: (event) => setData((current) => {
      const now = new Date().toISOString()
      const nextEvent = { ...event, createdAt: event.createdAt ?? now, updatedAt: now }
      const events = [nextEvent, ...current.events]
      const checklistItems = [...createChecklistForEvent(event.id, event.type, now), ...current.checklistItems]
      const budgets = [{ eventId: event.id, clientLimit: event.budget, baseCost: 0, venue: 0, catering: 0, equipment: 0, accommodation: 0, transfer: 0, other: 0, serviceFeePercent: 0, commissionPercent: 0, vatPercent: 0, comment: '', updatedAt: now }, ...current.budgets]
      const activity = makeActivity({ eventId: event.id, type: 'event', title: 'Создано мероприятие', description: event.title })
      const activities = [activity, ...current.activities]
      saveEvents(events); saveChecklistItems(checklistItems); saveBudgets(budgets); saveActivities(activities)
      markSyncDirty({ events: [event.id], checklistItems: checklistItems.filter((item) => item.eventId === event.id).map((item) => item.id), budgets: [event.id], activities: [activity.id] }, undefined, now)
      return { ...current, events, checklistItems, budgets, activities }
    }),
    updateEvent: (event) => setData((current) => {
      const now = new Date().toISOString()
      const nextEvent = { ...event, updatedAt: now }
      const events = current.events.map((item) => item.id === event.id ? nextEvent : item)
      const activity = makeActivity({ eventId: event.id, type: 'event', title: 'Обновлены данные мероприятия', description: event.title })
      const activities = [activity, ...current.activities]
      saveEvents(events); saveActivities(activities)
      markSyncDirty({ events: [event.id], activities: [activity.id] }, undefined, now)
      return { ...current, events, activities }
    }),
    updateChecklistItem: (item) => setData((current) => {
      const now = new Date().toISOString()
      const updated = { ...item, updatedAt: now, completedAt: item.status === 'done' ? item.completedAt ?? now : null }
      const checklistItems = current.checklistItems.map((entry) => entry.id === item.id ? updated : entry)
      const eventItems = checklistItems.filter((entry) => entry.eventId === item.eventId)
      const progress = calculateChecklistProgress(eventItems)
      const events = current.events.map((event) => event.id === item.eventId ? { ...event, progress, updatedAt: now } : event)
      const activity = makeActivity({ eventId: item.eventId, type: 'checklist', title: item.status === 'done' ? 'Выполнен пункт чек-листа' : 'Изменён пункт чек-листа', description: item.title })
      const activities = [activity, ...current.activities]
      saveChecklistItems(checklistItems); saveEvents(events); saveActivities(activities)
      markSyncDirty({ checklistItems: [item.id], events: [item.eventId], activities: [activity.id] }, undefined, now)
      return { ...current, checklistItems, events, activities }
    }),
    addChecklistItem: (item) => setData((current) => {
      const now = new Date().toISOString()
      const checklistItems = [item, ...current.checklistItems]
      const eventItems = checklistItems.filter((entry) => entry.eventId === item.eventId)
      const progress = calculateChecklistProgress(eventItems)
      const events = current.events.map((event) => event.id === item.eventId ? { ...event, progress, updatedAt: now } : event)
      const activity = makeActivity({ eventId: item.eventId, type: 'checklist', entityId: item.id, title: 'Создана задача', description: item.title })
      const activities = [activity, ...current.activities]
      saveChecklistItems(checklistItems); saveEvents(events); saveActivities(activities)
      markSyncDirty({ checklistItems: [item.id], events: [item.eventId], activities: [activity.id] }, undefined, now)
      return { ...current, checklistItems, events, activities }
    }),
    addQuestion: (question) => setData((current) => {
      const questions = [question, ...current.questions]
      const activity = makeActivity({ eventId: question.eventId, type: 'question', title: 'Создан открытый вопрос', description: question.title })
      const activities = [activity, ...current.activities]
      saveQuestions(questions); saveActivities(activities)
      markSyncDirty({ questions: [question.id], activities: [activity.id] })
      return { ...current, questions, activities }
    }),
    updateQuestion: (question) => setData((current) => {
      const questions = current.questions.map((item) => item.id === question.id ? question : item)
      const activity = makeActivity({ eventId: question.eventId, type: 'question', title: question.status === 'resolved' ? 'Закрыт вопрос' : 'Изменён открытый вопрос', description: question.title })
      const activities = [activity, ...current.activities]
      saveQuestions(questions); saveActivities(activities)
      markSyncDirty({ questions: [question.id], activities: [activity.id] })
      return { ...current, questions, activities }
    }),
    saveBudget: (budget) => setData((current) => {
      const budgets = current.budgets.some((item) => item.eventId === budget.eventId) ? current.budgets.map((item) => item.eventId === budget.eventId ? budget : item) : [budget, ...current.budgets]
      const activity = makeActivity({ eventId: budget.eventId, type: 'budget', title: 'Изменён бюджет', description: 'Обновлён локальный расчёт' })
      const activities = [activity, ...current.activities]
      saveBudgets(budgets); saveActivities(activities)
      markSyncDirty({ budgets: [budget.eventId], activities: [activity.id] })
      return { ...current, budgets, activities }
    }),
    addExpense: (eventId, amount, description) => setData((current) => {
      const budgets = current.budgets.map((budget) => budget.eventId === eventId ? { ...budget, other: budget.other + amount, updatedAt: new Date().toISOString() } : budget)
      const activity = makeActivity({ eventId, type: 'budget', entityId: eventId, amount, title: 'Добавлен расход', description })
      const activities = [activity, ...current.activities]
      saveBudgets(budgets); saveActivities(activities)
      markSyncDirty({ budgets: [eventId], activities: [activity.id] })
      return { ...current, budgets, activities }
    }),
    saveContractor: (contractor) => setData((current) => {
      const exists = current.contractors.some((item) => item.id === contractor.id)
      const contractors = exists ? current.contractors.map((item) => item.id === contractor.id ? contractor : item) : [contractor, ...current.contractors]
      const activity = makeActivity({ eventId: '', type: 'contractor', title: exists ? 'Обновлён контрагент' : 'Добавлен контрагент', description: contractor.name })
      const activities = [activity, ...current.activities]
      saveContractors(contractors); saveActivities(activities)
      markSyncDirty({ contractors: [contractor.id], activities: [activity.id] })
      return { ...current, contractors, activities }
    }),
    saveTemplate: (template) => setData((current) => {
      const templates = current.templates.some((item) => item.id === template.id) ? current.templates.map((item) => item.id === template.id ? template : item) : [template, ...current.templates]
      saveTemplates(templates)
      markSyncDirty({ templates: [template.id] })
      return { ...current, templates }
    }),
    updateSettings: (settings) => setData((current) => { saveSettings(settings); return { ...current, settings } }),
    logActivity: (input) => setData((current) => {
      const activities = [makeActivity(input), ...current.activities]
      saveActivities(activities)
      markSyncDirty({ activities: [activities[0].id] })
      return { ...current, activities }
    }),
  }), [data])

  return <EventFlowContext.Provider value={value}>{children}</EventFlowContext.Provider>
}

export function useEventFlowData() {
  const value = useContext(EventFlowContext)
  if (!value) throw new Error('useEventFlowData must be used inside EventFlowProvider')
  return value
}
