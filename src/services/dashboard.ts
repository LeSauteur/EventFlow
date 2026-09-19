import { calculateEventRisks } from '../config/riskRules.ts'
import type { ChecklistItem, Event, EventBudget, OpenQuestion, Priority, Risk } from '../types/index.ts'
import { getDeadlineState } from '../utils/dates.ts'

export interface AttentionItem {
  id: string
  eventId: string
  eventName: string
  title: string
  deadline: string | null
  priority: Priority
  source: 'checklist' | 'question'
  statusLabel: string
}

interface DashboardSource { events: Event[]; checklistItems: ChecklistItem[]; questions: OpenQuestion[]; budgets: EventBudget[] }

export function calculateDashboard(source: DashboardSource, now = new Date()) {
  const activeQuestions = source.questions.filter((question) => question.status !== 'resolved')
  const waitingChecklist = source.checklistItems.filter((item) => item.status === 'waiting')
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7)
  const stats = {
    activeEvents: source.events.length,
    criticalQuestions: activeQuestions.filter((question) => question.priority === 'critical').length,
    awaitingResponse: activeQuestions.filter((question) => ['waiting_external', 'waiting_client'].includes(question.status)).length + waitingChecklist.length,
    thisWeek: source.events.filter((event) => { const date = new Date(`${event.date}T12:00:00`); return date >= now && date <= weekEnd }).length,
  }

  const eventTitle = (eventId: string) => source.events.find((event) => event.id === eventId)?.title ?? 'Без мероприятия'
  const checklistAttention: AttentionItem[] = source.checklistItems.filter((item) => {
    const deadline = getDeadlineState(item.deadline, now)
    return item.status !== 'done' && item.status !== 'not_applicable' && (deadline === 'today' || deadline === 'overdue' || item.priority === 'critical')
  }).map((item) => ({ id: item.id, eventId: item.eventId, eventName: eventTitle(item.eventId), title: item.title, deadline: item.deadline, priority: item.priority, source: 'checklist', statusLabel: item.status === 'waiting' ? 'Ожидаем' : getDeadlineState(item.deadline, now) === 'overdue' ? 'Просрочено' : 'В работе' }))
  const questionAttention: AttentionItem[] = activeQuestions.filter((question) => {
    const deadline = getDeadlineState(question.deadline, now)
    return deadline === 'today' || deadline === 'overdue' || question.priority === 'critical'
  }).map((question) => ({ id: question.id, eventId: question.eventId, eventName: eventTitle(question.eventId), title: question.title, deadline: question.deadline, priority: question.priority, source: 'question', statusLabel: question.status === 'waiting_client' ? 'Ждём клиента' : question.status === 'waiting_external' ? 'Ожидаем' : getDeadlineState(question.deadline, now) === 'overdue' ? 'Просрочено' : 'Открыт' }))
  const weight: Record<Priority, number> = { critical: 0, high: 1, normal: 2, low: 3 }
  const attention = [...checklistAttention, ...questionAttention].sort((a, b) => weight[a.priority] - weight[b.priority] || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))

  const risks: Risk[] = source.events.flatMap((event) => calculateEventRisks({ event, checklistItems: source.checklistItems.filter((item) => item.eventId === event.id), questions: source.questions.filter((question) => question.eventId === event.id), budget: source.budgets.find((budget) => budget.eventId === event.id) }).map((risk) => ({ ...risk, description: `${event.title} · ${risk.description}` })))
  return { stats, attention, risks }
}
