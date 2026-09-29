import type { Event, EventStage, ServiceInstance, ServiceType, WorkChecklistItem } from '../types/index.ts'

export interface ServicePreset {
  type: ServiceType
  title: string
  providerLabel: string
  checklist: string[]
}

export const COMMON_CHECKLIST_TITLES = [
  'Смета предварительная направлена',
  'PO получено',
  'Смета в WORK',
  'Предварительный счёт',
]

export const SERVICE_PRESETS: ServicePreset[] = [
  { type: 'accommodation', title: 'Проживание', providerLabel: 'Отель / поставщик', checklist: ['Запрос направлен', 'Предложение получено', 'Подтверждение получено', 'Счёт получен', 'Ваучер получен / отправлен'] },
  { type: 'transfer', title: 'Трансфер', providerLabel: 'Поставщик', checklist: ['Данные пассажиров получены', 'Запрос направлен', 'Предложение / подтверждение', 'ССЗ получено', 'Счёт получен', 'Ваучер получен / отправлен'] },
  { type: 'logistics', title: 'Логистика', providerLabel: 'Поставщик', checklist: ['Маршрут согласован', 'Данные участников получены', 'Запрос направлен', 'Подтверждение получено', 'Документы отправлены'] },
  { type: 'catering', title: 'Кейтеринг / питание', providerLabel: 'Поставщик', checklist: ['Запрос направлен', 'Меню получено', 'Меню направлено на согласование', 'Меню согласовано', 'Счёт получен'] },
  { type: 'venue', title: 'Конференц-зал / площадка', providerLabel: 'Площадка', checklist: ['Запрос направлен', 'Предложение получено', 'Подтверждение', 'Счёт получен'] },
  { type: 'equipment', title: 'Оборудование', providerLabel: 'Поставщик', checklist: ['Запрос направлен', 'Предложение получено', 'Подтверждение', 'Счёт получен'] },
  { type: 'flights', title: 'Авиабилеты', providerLabel: 'Поставщик', checklist: ['Данные пассажиров получены', 'Варианты получены', 'Согласовано', 'Билеты оформлены', 'Билеты / ваучеры отправлены'] },
  { type: 'rail', title: 'ЖД билеты', providerLabel: 'Поставщик', checklist: ['Данные пассажиров получены', 'Варианты получены', 'Согласовано', 'Билеты оформлены', 'Билеты отправлены'] },
  { type: 'visa', title: 'Виза', providerLabel: 'Поставщик', checklist: ['Данные получены', 'Запрос направлен', 'Счёт получен', 'Виза оформлена'] },
  { type: 'coordination', title: 'Сопровождение / координатор', providerLabel: 'Исполнитель', checklist: ['Запрос направлен', 'Предложение получено', 'Подтверждено', 'Счёт получен'] },
  { type: 'direct', title: 'ССЗ / прямое взаимодействие', providerLabel: 'Контакт', checklist: ['Данные получены', 'ССЗ получено', 'Подтверждение получено'] },
  { type: 'event', title: 'Мероприятие', providerLabel: 'Поставщик', checklist: ['Программа согласована', 'Подтверждение получено', 'Документы готовы'] },
  { type: 'custom', title: 'Другое', providerLabel: 'Поставщик', checklist: [] },
]

export const STAGES: { value: EventStage; label: string }[] = [
  { value: 'WORKING', label: 'В работе' },
  { value: 'PO', label: 'PO' },
  { value: 'PROCESSING', label: 'Процессинг' },
  { value: 'ARCHIVE', label: 'Архив' },
]

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createWorkChecklist(titles: string[], prefix = 'item'): WorkChecklistItem[] {
  return titles.map((title, index) => ({ id: `${makeId(prefix)}-${index}`, title, completed: false, completedAt: null }))
}

export function createServiceInstance(eventId: string, type: ServiceType, customTitle?: string): ServiceInstance {
  const preset = SERVICE_PRESETS.find((item) => item.type === type) ?? SERVICE_PRESETS[SERVICE_PRESETS.length - 1]
  return {
    id: makeId('service'), eventId, type,
    title: customTitle?.trim() || preset.title,
    providerName: '', providerContact: '', notes: '',
    checklist: createWorkChecklist(preset.checklist, `service-${type}`),
  }
}

export function createNotebookEvent(input: Partial<Event> & Pick<Event, 'id' | 'title'>): Event {
  const now = new Date().toISOString()
  const dateFrom = input.dateFrom || input.date || ''
  const dateTo = input.dateTo || dateFrom
  const stage = input.stage ?? statusToStage(input.status)
  return {
    id: input.id,
    title: input.title,
    client: input.client ?? input.company ?? '',
    city: input.city ?? '',
    date: input.date ?? dateFrom,
    guests: Number(input.guests ?? input.participants ?? 0),
    budget: Number(input.budget ?? 0),
    type: input.type ?? 'Мероприятие',
    status: stageToStatus(stage),
    progress: Number(input.progress ?? 0),
    contractorId: input.contractorId,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    dateFrom,
    dateTo,
    sector: input.sector ?? input.type ?? '',
    company: input.company ?? input.client ?? '',
    initiator: input.initiator ?? '',
    participants: Number(input.participants ?? input.guests ?? 0),
    stage,
    services: Array.isArray(input.services) ? input.services : [],
    commonChecklist: Array.isArray(input.commonChecklist) && input.commonChecklist.length ? input.commonChecklist : createWorkChecklist(COMMON_CHECKLIST_TITLES, 'common'),
    workTourNumbers: Array.isArray(input.workTourNumbers) ? input.workTourNumbers : [],
    waitingItems: Array.isArray(input.waitingItems) ? input.waitingItems : [],
    nextStep: input.nextStep ?? '',
    timeline: Array.isArray(input.timeline) ? input.timeline : [],
  }
}

export function stageToStatus(stage: EventStage): Event['status'] {
  return ({ WORKING: 'В работе', PO: 'PO', PROCESSING: 'Процессинг', ARCHIVE: 'Архив' } as const)[stage]
}

export function statusToStage(status?: Event['status']): EventStage {
  if (status === 'PO') return 'PO'
  if (status === 'Процессинг' || status === 'Согласование') return 'PROCESSING'
  if (status === 'Архив') return 'ARCHIVE'
  return 'WORKING'
}

export function serviceProviderLabel(type: ServiceType) {
  return SERVICE_PRESETS.find((item) => item.type === type)?.providerLabel ?? 'Поставщик'
}

export function inferServiceTypes(value = ''): ServiceType[] {
  const text = value.toLocaleLowerCase('ru-RU')
  const matches: ServiceType[] = []
  const add = (type: ServiceType, words: string[]) => { if (words.some((word) => text.includes(word))) matches.push(type) }
  add('accommodation', ['прожив', 'отел'])
  add('transfer', ['трансфер'])
  add('logistics', ['логист'])
  add('catering', ['кейтер', 'питан', 'обед', 'ужин', 'кофе'])
  add('venue', ['конференц', 'площад', 'зал'])
  add('equipment', ['оборуд'])
  add('flights', ['авиа'])
  add('rail', ['жд', 'железнодорож'])
  add('visa', ['виз'])
  add('coordination', ['сопровожд', 'координатор'])
  return [...new Set(matches)]
}
