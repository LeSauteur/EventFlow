import type { Activity, DashboardStats, Event, Risk, Task } from '../types/index.ts'
import { addDays, toDateKey } from '../utils/dates.ts'

const demoToday = new Date()

export const dashboardStats: DashboardStats = {
  activeEvents: 7,
  criticalQuestions: 9,
  awaitingResponse: 14,
  thisWeek: 3,
}

export const seedEvents: Event[] = [
  { id: 'event-1', title: 'J&J Иваново', client: 'Johnson & Johnson', city: 'Иваново', date: toDateKey(addDays(demoToday, 12)), guests: 120, budget: 1_200_000, type: 'Корпоративное мероприятие', status: 'В работе', progress: 50, contractorId: 'contractor-1' },
  { id: 'event-2', title: 'Kenvue Москва', client: 'Kenvue', city: 'Москва', date: toDateKey(addDays(demoToday, 28)), guests: 106, budget: 3_500_000, type: 'Конференция', status: 'В работе', progress: 45, contractorId: 'contractor-2' },
  { id: 'event-3', title: 'Новосибирск', client: 'AstraZeneca', city: 'Новосибирск', date: toDateKey(addDays(demoToday, 48)), guests: 80, budget: 1_800_000, type: 'Конференция', status: 'Согласование', progress: 30 },
  { id: 'event-4', title: 'Регата Сочи', client: 'Bayer', city: 'Сочи', date: toDateKey(addDays(demoToday, 65)), guests: 50, budget: 2_000_000, type: 'Тимбилдинг', status: 'В подготовке', progress: 60 },
]

export const seedTasks: Task[] = [
  { id: 'task-1', eventId: 'event-1', eventName: 'J&J Иваново', title: 'Подтвердить финальное меню с отелем', deadline: 'Сегодня, 16:00', status: 'Просрочено', priority: 'Критичный' },
  { id: 'task-2', eventId: 'event-2', eventName: 'Kenvue Москва', title: 'Ждём подтверждение меню от клиента', deadline: 'Сегодня, 14:00', status: 'Сегодня', priority: 'Высокий' },
  { id: 'task-3', eventId: 'event-3', eventName: 'Новосибирск', title: 'Запросить КП у подрядчиков', deadline: 'Срочно', status: 'Ожидаем', priority: 'Высокий' },
]

export const seedRisks: Risk[] = [
  { id: 'risk-1', eventId: 'event-1', title: 'Не указан НДС площадки', severity: 'Высокий', description: 'J&J Ростов / Ужин · Влияет на финальный бюджет' },
  { id: 'risk-2', eventId: 'event-2', title: 'Не подтверждена актуальность цен', severity: 'Средний', description: 'Kenvue Москва / Конференция · Цены могут измениться' },
  { id: 'risk-3', eventId: 'event-4', title: 'Нет счёта от отеля', severity: 'Средний', description: 'Регата / Тимбилдинг · Есть риск срыва бронирования' },
]

export const seedActivities: Activity[] = [
  { id: 'activity-1', eventId: 'event-2', type: 'budget', title: 'Изменена смета', description: 'Kenvue Москва / Конференция', timestamp: '11:24' },
  { id: 'activity-2', eventId: 'event-1', type: 'document', title: 'Добавлен документ', description: 'Договор с площадкой.pdf', timestamp: '10:17' },
  { id: 'activity-3', eventId: 'event-1', type: 'message', title: 'Новое сообщение от контрагента', description: 'Ресторан «Причал»', timestamp: '09:42' },
  { id: 'activity-4', eventId: 'event-3', type: 'status', title: 'Обновлён статус мероприятия', description: 'Махачкала / Обед', timestamp: 'Вчера 18:23' },
]

export const attentionTasks = seedTasks
