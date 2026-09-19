import { createChecklistForEvent } from '../config/checklistPresets.ts'
import type { AppSettings, Contractor, EventBudget, MessageTemplate, OpenQuestion } from '../types/index.ts'
import { addDays, toDateKey } from '../utils/dates.ts'
import { seedEvents } from './seed.ts'

const now = new Date()
const today = toDateKey(now)
const yesterday = toDateKey(addDays(now, -1))
const tomorrow = toDateKey(addDays(now, 1))

export const seedChecklistItems = seedEvents.flatMap((event, eventIndex) => {
  const base = createChecklistForEvent(event.id, event.type)
  const doneThreshold = [0.7, 0.45, 0.3, 0.6][eventIndex] ?? 0.2
  const doneCount = Math.round(base.length * doneThreshold)
  return base.map((item, index) => {
    if (index < doneCount) return { ...item, status: 'done' as const, completedAt: new Date().toISOString() }
    if (index === doneCount) return { ...item, status: 'overdue' as const, deadline: yesterday }
    if (index === doneCount + 1) return { ...item, status: 'waiting' as const, deadline: tomorrow }
    return item
  })
})

export const seedQuestions: OpenQuestion[] = [
  { id: 'question-1', eventId: 'event-1', title: 'Подтвердить финальное меню и стоимость', description: 'Нужна финальная версия меню с учётом сезонности.', responsibleParty: 'Ресторан', deadline: today, priority: 'critical', status: 'waiting_external', createdAt: new Date().toISOString(), resolvedAt: null },
  { id: 'question-2', eventId: 'event-1', title: 'Уточнить условия отмены', description: 'Нет письменного подтверждения условий отмены.', responsibleParty: 'Площадка', deadline: tomorrow, priority: 'high', status: 'open', createdAt: new Date().toISOString(), resolvedAt: null },
  { id: 'question-3', eventId: 'event-2', title: 'Подтверждение цен на алкоголь', description: 'Цены на сайте не подтверждены.', responsibleParty: 'Площадка', deadline: yesterday, priority: 'high', status: 'waiting_external', createdAt: new Date().toISOString(), resolvedAt: null },
  { id: 'question-4', eventId: 'event-3', title: 'Согласовать рассадку', description: 'Требуется финальная схема рассадки от клиента.', responsibleParty: 'Клиент', deadline: tomorrow, priority: 'high', status: 'waiting_client', createdAt: new Date().toISOString(), resolvedAt: null },
]

export const seedContractors: Contractor[] = [
  { id: 'contractor-1', name: 'Ресторан «Вино и Мясо»', type: 'Ресторан', city: 'Ростов-на-Дону', contactPerson: 'Иван Кузнецов', phone: '+7 928 123-45-67', email: 'i.kuznetsov@vinomiaso.ru', legalEntity: 'ООО «Вино и Мясо»', vatInfo: 'НДС 20%', serviceFee: '10%', paymentTerms: '50% предоплата, остаток за 3 дня', cancellationTerms: 'Без штрафа за 14 дней', notes: '', lastVerifiedAt: yesterday },
  { id: 'contractor-2', name: 'Radisson Blu', type: 'Отель', city: 'Москва', contactPerson: 'Дмитрий Волков', phone: '+7 863 555-12-34', email: 'd.volkov@radisson.com', legalEntity: 'ООО «Отель Сервис»', vatInfo: 'НДС 20%', serviceFee: '0%', paymentTerms: 'По счёту, 100% предоплата', cancellationTerms: 'По условиям договора', notes: '', lastVerifiedAt: toDateKey(addDays(now, -95)) },
  { id: 'contractor-3', name: 'Южный Трансфер', type: 'Трансфер', city: 'Сочи', contactPerson: 'Олег Панов', phone: '+7 918 777-42-18', email: 'booking@south-transfer.ru', legalEntity: 'ИП Панов О.В.', vatInfo: 'Без НДС', serviceFee: 'Включён', paymentTerms: 'Оплата после оказания услуг', cancellationTerms: 'За 48 часов без штрафа', notes: '', lastVerifiedAt: toDateKey(addDays(now, -12)) },
]

export const seedBudgets: EventBudget[] = seedEvents.map((event, index) => ({
  eventId: event.id,
  clientLimit: event.budget,
  baseCost: index === 0 ? 0 : Math.round(event.budget * .05),
  venue: Math.round(event.budget * .22),
  catering: Math.round(event.budget * .46),
  equipment: Math.round(event.budget * .08),
  accommodation: event.type === 'Проживание' ? Math.round(event.budget * .35) : 0,
  transfer: Math.round(event.budget * .05),
  other: Math.round(event.budget * .03),
  serviceFeePercent: 10,
  commissionPercent: 0,
  vatPercent: 20,
  comment: '',
  updatedAt: new Date().toISOString(),
}))

export const seedTemplates: MessageTemplate[] = [
  { id: 'template-1', name: 'Первичный запрос площадке', category: 'Работа с площадками', subject: 'Запрос коммерческого предложения на {{event.date}}', body: 'Здравствуйте!\n\nПланируем мероприятие в городе {{event.city}} на {{event.date}} для {{event.guests}} гостей. Просим направить стоимость и актуальные условия.\n\nПожалуйста, уточните:\n— стоимость аренды и срок действия цен;\n— ставку НДС;\n— сервисный сбор или комиссию;\n— условия оплаты;\n— условия отмены;\n— доступность площадки.\n\nБудем благодарны за ответ до {{deadline}}.\n\nС уважением,\nАнастасия\nEventFlow', requiredTopics: ['price', 'vat', 'serviceFee', 'payment', 'priceValidity', 'cancellation', 'deadline'], custom: false, updatedAt: new Date().toISOString() },
  { id: 'template-2', name: 'Запрос меню', category: 'Работа с площадками', subject: 'Запрос меню для {{event.title}}', body: 'Здравствуйте! Просим направить актуальное меню и цены для мероприятия {{event.title}} на {{event.guests}} гостей. Также просим указать НДС и сервисный сбор.', requiredTopics: ['price', 'vat', 'serviceFee', 'priceValidity'], custom: false, updatedAt: new Date().toISOString() },
  { id: 'template-3', name: 'Уточнение НДС', category: 'Документы и финансы', subject: 'Уточнение НДС по мероприятию {{event.title}}', body: 'Здравствуйте! Подтвердите, пожалуйста, применяется ли НДС, его ставка и включён ли он в указанную стоимость.', requiredTopics: ['vat', 'price'], custom: false, updatedAt: new Date().toISOString() },
  { id: 'template-4', name: 'Уточнение сервисного сбора', category: 'Документы и финансы', subject: 'Сервисный сбор — {{event.title}}', body: 'Здравствуйте! Уточните, пожалуйста, размер сервисного сбора или комиссии и порядок его расчёта.', requiredTopics: ['serviceFee'], custom: false, updatedAt: new Date().toISOString() },
  { id: 'template-5', name: 'Напоминание об ответе', category: 'Служебные', subject: 'Напоминание по запросу — {{event.title}}', body: 'Здравствуйте! Напоминаем о нашем запросе по мероприятию {{event.title}}. Будем благодарны за ответ до {{deadline}}.', requiredTopics: ['deadline'], custom: false, updatedAt: new Date().toISOString() },
  { id: 'template-6', name: 'Напоминание о счёте', category: 'Документы и финансы', subject: 'Счёт по мероприятию {{event.title}}', body: 'Здравствуйте! Просим направить счёт по мероприятию {{event.title}} до {{deadline}}.', requiredTopics: ['deadline'], custom: false, updatedAt: new Date().toISOString() },
  { id: 'template-7', name: 'Запрос договора', category: 'Документы и финансы', subject: 'Договор — {{event.title}}', body: 'Здравствуйте! Просим направить проект договора и перечень необходимых реквизитов по мероприятию {{event.title}}.', requiredTopics: [], custom: false, updatedAt: new Date().toISOString() },
  { id: 'template-8', name: 'Запрос закрывающих документов', category: 'Документы и финансы', subject: 'Закрывающие документы — {{event.title}}', body: 'Здравствуйте! Просим направить акт, УПД и счёт-фактуру, если она применяется, по мероприятию {{event.title}}.', requiredTopics: [], custom: false, updatedAt: new Date().toISOString() },
  { id: 'template-9', name: 'Сообщение клиенту об изменении стоимости', category: 'Коммуникации с клиентами', subject: 'Изменение стоимости — {{event.title}}', body: 'Здравствуйте! По мероприятию {{event.title}} изменилась стоимость предложения. Актуальный лимит: {{budget.limit}}. Просим подтвердить согласование.', requiredTopics: ['price'], custom: false, updatedAt: new Date().toISOString() },
  { id: 'template-10', name: 'Подтверждение трансфера', category: 'Логистика и трансфер', subject: 'Подтверждение трансфера — {{event.date}}', body: 'Здравствуйте! Подтверждаем трансфер на {{event.date}} в городе {{event.city}}. Просим направить контакт водителя и финальные данные автомобиля.', requiredTopics: [], custom: false, updatedAt: new Date().toISOString() },
]

export const seedSettings: AppSettings = { userName: 'Анастасия', workdayStart: '09:00', workdayEnd: '17:00', dateFormat: 'DD.MM.YYYY', lastBackupAt: null }
