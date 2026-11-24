import type { EventFlowData } from './storage.ts'
import type { TaskFields, WorkTaskStatus } from '../types/index.ts'

export type TaskSource = 'common' | 'service' | 'waiting' | 'checklist' | 'question' | 'legacy' | 'next'
export interface RegistryTask extends TaskFields {
  key: string
  source: TaskSource
  sourceId: string
  serviceId?: string
  eventId: string
  eventTitle: string
  sourceLabel: string
  title: string
  status: WorkTaskStatus
  priority: NonNullable<TaskFields['priority']>
  manualHot: boolean
  tags: string[]
  archived: boolean
  timeZone: string
}
export type TaskPatch = TaskFields & { title?: string; status?: WorkTaskStatus }
export const taskKey = (source: TaskSource, ...ids: string[]) => [source, ...ids.map(encodeURIComponent)].join(':')
export const isClosed = (task: Pick<RegistryTask, 'status'>) => task.status === 'done' || task.status === 'cancelled'

/** Read-through registry: no copied tasks and no title-based deduplication. */
export function taskRegistry(data: Pick<EventFlowData, 'events' | 'checklistItems' | 'questions' | 'tasks' | 'settings'>): RegistryTask[] {
  const result: RegistryTask[] = []
  const emit = (source: TaskSource, id: string, eventId: string, title: string, fields: TaskFields, status: WorkTaskStatus, label: string, serviceId?: string) => {
    const event = data.events.find((e) => e.id === eventId)
    result.push({ ...fields, key: taskKey(source, eventId, ...(serviceId ? [serviceId] : []), id), source, sourceId: id, serviceId, eventId, eventTitle: event?.title ?? 'Без мероприятия', sourceLabel: label, title, status, priority: fields.priority ?? 'normal', manualHot: fields.manualHot ?? false, tags: fields.tags ?? [], archived: event?.stage === 'ARCHIVE', timeZone: fields.timeZone ?? event?.timeZone ?? data.settings.timeZone ?? 'Europe/Moscow' })
  }
  const workStatus = (item: { completed: boolean; taskStatus?: WorkTaskStatus }, waiting = false): WorkTaskStatus => item.completed ? 'done' : item.taskStatus === 'done' ? (waiting ? 'waiting' : 'todo') : item.taskStatus ?? (waiting ? 'waiting' : 'todo')
  for (const e of data.events) {
    for (const item of e.commonChecklist ?? []) emit('common', item.id, e.id, item.title, item, workStatus(item), 'Общее')
    for (const service of e.services ?? []) for (const item of service.checklist) emit('service', item.id, e.id, item.title, item, workStatus(item), service.title, service.id)
    for (const item of e.waitingItems ?? []) emit('waiting', item.id, e.id, item.text, item, workStatus(item, true), 'Жду ответа')
    if (e.nextStep?.trim() || e.nextStepTask?.deadline) emit('next', 'next-step', e.id, e.nextStep.trim() || 'Следующий шаг', e.nextStepTask ?? {}, e.nextStepTask?.taskStatus ?? 'todo', 'Следующий шаг')
  }
  for (const item of data.checklistItems) emit('checklist', item.id, item.eventId, item.title, item, item.status === 'not_applicable' ? 'cancelled' : item.status === 'overdue' ? 'todo' : item.status, 'Задача / чек-лист')
  for (const item of data.questions) emit('question', item.id, item.eventId, item.title, { ...item, waitingFor: item.waitingFor || item.responsibleParty }, item.status === 'resolved' ? 'done' : item.taskStatus ?? (item.status.startsWith('waiting') ? 'waiting' : 'todo'), 'Открытый вопрос')
  for (const item of data.tasks) {
    // Explicit aliases only. Similar titles can be genuinely different work.
    if (item.sourceKey && result.some((task) => task.key === item.sourceKey)) continue
    if (result.some((task) => task.sourceId === item.id && task.eventId === item.eventId)) continue
    emit('legacy', item.id, item.eventId, item.title, { priority: item.priority === 'Критичный' ? 'critical' : 'high', deadline: item.deadline, ...item.details }, item.details?.taskStatus ?? (item.status === 'Ожидаем' ? 'waiting' : 'todo'), 'Задача')
  }
  return result
}

/** Patch the original entity, preserving its unknown fields and siblings. */
export function patchRegistryTask(data: EventFlowData, key: string, patch: TaskPatch, now = new Date().toISOString()): EventFlowData {
  const task = taskRegistry(data).find((t) => t.key === key)
  if (!task) return data
  const { title, status, ...metadata } = patch
  const fields = { ...metadata, ...(status ? { taskStatus: status } : {}), updatedAt: now }
  const work = <T extends { id: string; completed: boolean; title?: string; text?: string }>(item: T): T => ({ ...item, ...fields, ...(title === undefined ? {} : 'text' in item ? { text: title } : { title }), ...(status ? { completed: status === 'done', completedAt: status === 'done' ? now : null } : {}) })
  if (['common', 'service', 'waiting', 'next'].includes(task.source)) {
    return { ...data, events: data.events.map((e) => e.id !== task.eventId ? e : {
      ...e, updatedAt: now,
      ...(task.source === 'common' ? { commonChecklist: e.commonChecklist.map((i) => i.id === task.sourceId ? work(i) : i) } : {}),
      ...(task.source === 'service' ? { services: e.services.map((s) => s.id !== task.serviceId ? s : { ...s, checklist: s.checklist.map((i) => i.id === task.sourceId ? work(i) : i) }) } : {}),
      ...(task.source === 'waiting' ? { waitingItems: e.waitingItems.map((i) => i.id === task.sourceId ? work(i) : i) } : {}),
      ...(task.source === 'next' ? { nextStep: title ?? e.nextStep, nextStepTask: { ...e.nextStepTask, ...fields } } : {}),
    }) }
  }
  if (task.source === 'checklist') return { ...data, checklistItems: data.checklistItems.map((i) => i.id !== task.sourceId ? i : { ...i, ...fields, title: title ?? i.title, status: status === 'cancelled' ? 'not_applicable' : status ?? i.status, completedAt: status ? status === 'done' ? now : null : i.completedAt }) }
  if (task.source === 'question') return { ...data, questions: data.questions.map((i) => i.id !== task.sourceId ? i : { ...i, ...fields, title: title ?? i.title, status: status ? status === 'done' || status === 'cancelled' ? 'resolved' : status === 'waiting' ? 'waiting_external' : 'open' : i.status, resolvedAt: status ? status === 'done' || status === 'cancelled' ? now : null : i.resolvedAt }) }
  return { ...data, tasks: data.tasks.map((i) => i.id !== task.sourceId ? i : { ...i, title: title ?? i.title, details: { ...i.details, ...fields } }) }
}
