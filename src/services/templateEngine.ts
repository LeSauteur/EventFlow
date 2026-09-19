import type { Contractor, Event, EventBudget, MessageTemplate, TemplateTopic } from '../types/index.ts'
import { formatCurrency, formatDate } from '../utils/format.ts'

export interface TemplateContext { event?: Event; contractor?: Contractor; deadline?: string; budget?: EventBudget }

export const templateTopics: TemplateTopic[] = [
  { id: 'price', label: 'Запрошена стоимость', patterns: ['стоимост', 'цен'] },
  { id: 'vat', label: 'Упомянут НДС', patterns: ['ндс'] },
  { id: 'serviceFee', label: 'Упомянут сервисный сбор', patterns: ['сервисн', 'комисси'] },
  { id: 'payment', label: 'Условия оплаты', patterns: ['условия оплаты', 'предоплат'] },
  { id: 'priceValidity', label: 'Актуальность цен', patterns: ['срок действия цен', 'актуальн'] },
  { id: 'cancellation', label: 'Условия отмены', patterns: ['условия отмены', 'отмен'] },
  { id: 'deadline', label: 'Срок ответа', patterns: ['ответ до', '{{deadline}}'] },
]

const getVariable = (key: string, context: TemplateContext) => {
  const values: Record<string, string> = {
    'event.title': context.event?.title ?? '—', 'event.date': context.event ? formatDate(context.event.date) : '—',
    'event.city': context.event?.city ?? '—', 'event.guests': context.event ? String(context.event.guests) : '—',
    'client.name': context.event?.client ?? '—', 'contractor.name': context.contractor?.name ?? '—',
    deadline: context.deadline ? formatDate(context.deadline) : '—', 'budget.limit': context.budget ? formatCurrency(context.budget.clientLimit) : '—',
  }
  return values[key] ?? `{{${key}}}`
}

export function renderTemplate(source: string, context: TemplateContext) {
  return source.replace(/{{\s*([\w.]+)\s*}}/g, (_, key: string) => getVariable(key, context))
}

export function checkTemplateCoverage(template: MessageTemplate, body: string) {
  const lower = body.toLowerCase()
  const checks = template.requiredTopics.map((id) => {
    const topic = templateTopics.find((item) => item.id === id)
    const covered = !!topic && topic.patterns.some((pattern) => lower.includes(pattern.toLowerCase()))
    return { id, label: topic?.label ?? id, covered }
  })
  return { checks, covered: checks.filter((item) => item.covered).length, total: checks.length }
}
