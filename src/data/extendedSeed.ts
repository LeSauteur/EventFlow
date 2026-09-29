import type { AppSettings, ChecklistItem, Contractor, EventBudget, MessageTemplate, OpenQuestion } from '../types/index.ts'

export const seedChecklistItems: ChecklistItem[] = []

export const seedQuestions: OpenQuestion[] = []

export const seedContractors: Contractor[] = []

export const seedBudgets: EventBudget[] = []

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
