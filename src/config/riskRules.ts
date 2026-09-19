import { calculateBudget } from '../services/budget.ts'
import type { ChecklistItem, Event, EventBudget, OpenQuestion, Risk } from '../types/index.ts'
import { getDeadlineState } from '../utils/dates.ts'

interface RiskRuleContext { event: Event; checklistItems: ChecklistItem[]; questions: OpenQuestion[]; budget?: EventBudget }
interface RiskRule { id: string; title: string; severity: Risk['severity']; description: string; check: (context: RiskRuleContext) => boolean }

function incomplete(items: ChecklistItem[], text: string) {
  const item = items.find((entry) => entry.title.toLowerCase().includes(text.toLowerCase()))
  return !!item && !['done', 'not_applicable'].includes(item.status)
}

export const riskRules: RiskRule[] = [
  { id: 'vat', title: 'Не указан НДС площадки', severity: 'Высокий', description: 'Влияет на финальный бюджет', check: ({ checklistItems }) => incomplete(checklistItems, 'уточнён НДС') || incomplete(checklistItems, 'учтён НДС') },
  { id: 'service-fee', title: 'Не подтверждён сервисный сбор', severity: 'Высокий', description: 'Итоговая стоимость может измениться', check: ({ checklistItems }) => incomplete(checklistItems, 'сервисный сбор') },
  { id: 'contract', title: 'Нет договора', severity: 'Высокий', description: 'Договор ещё не закрыт по чек-листу', check: ({ checklistItems }) => incomplete(checklistItems, 'получен договор') },
  { id: 'invoice', title: 'Нет счёта', severity: 'Средний', description: 'Счёт ещё не получен', check: ({ checklistItems }) => incomplete(checklistItems, 'получен счёт') },
  { id: 'booking', title: 'Бронирование не подтверждено', severity: 'Высокий', description: 'Дата мероприятия приближается', check: ({ event, checklistItems }) => { const diff = (new Date(`${event.date}T12:00:00`).getTime() - Date.now()) / 86_400_000; return diff <= 14 && diff >= 0 && incomplete(checklistItems, 'подтверждено бронирование') } },
  { id: 'budget', title: 'Превышен лимит бюджета', severity: 'Высокий', description: 'Расчётная стоимость выше лимита клиента', check: ({ event, budget }) => !!budget && calculateBudget(budget, event.guests).overage > 0 },
  { id: 'prices', title: 'Не подтверждена актуальность цен', severity: 'Средний', description: 'Цены могут измениться', check: ({ checklistItems }) => incomplete(checklistItems, 'актуальность цен') },
  { id: 'cancellation', title: 'Нет подтверждённых условий отмены', severity: 'Средний', description: 'Условия отмены не зафиксированы', check: ({ checklistItems }) => incomplete(checklistItems, 'условия отмены') },
  { id: 'critical-overdue', title: 'Просрочен критичный пункт', severity: 'Высокий', description: 'Нужна немедленная реакция', check: ({ checklistItems }) => checklistItems.some((item) => item.priority === 'critical' && item.status !== 'done' && getDeadlineState(item.deadline) === 'overdue') },
  { id: 'open-load', title: 'Много важных открытых вопросов', severity: 'Средний', description: 'Требуется расставить приоритеты', check: ({ questions }) => questions.filter((question) => question.status !== 'resolved' && ['critical', 'high'].includes(question.priority)).length >= 3 },
]

export function calculateEventRisks(context: RiskRuleContext): Risk[] {
  return riskRules.filter((rule) => rule.check(context)).map((rule) => ({ id: `${context.event.id}-${rule.id}`, eventId: context.event.id, title: rule.title, severity: rule.severity, description: rule.description }))
}
