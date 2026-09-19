import type { ChecklistCategory, ChecklistItem, Priority } from '../types/index.ts'

export const checklistCategoryLabels: Record<ChecklistCategory, string> = {
  general: 'Общее',
  venue: 'Площадка',
  catering: 'Питание',
  equipment: 'Оборудование',
  logistics: 'Логистика / трансфер',
  accommodation: 'Проживание',
  documents: 'Документы',
}

export const checklistCategoryOrder: ChecklistCategory[] = ['general', 'venue', 'catering', 'equipment', 'logistics', 'accommodation', 'documents']

interface PresetItem { title: string; priority?: Priority; description?: string }

const presetItems: Record<ChecklistCategory, PresetItem[]> = {
  general: [
    { title: 'Подтверждена дата', priority: 'critical' },
    { title: 'Подтверждено количество гостей', priority: 'high' },
    { title: 'Подтверждён бюджет', priority: 'critical' },
    { title: 'Определён плательщик' },
    { title: 'Получены реквизиты' },
    { title: 'Получено финальное подтверждение клиента', priority: 'high' },
  ],
  venue: [
    { title: 'Подтверждена доступность', priority: 'critical' },
    { title: 'Получена стоимость', priority: 'high' },
    { title: 'Получено коммерческое предложение' },
    { title: 'Уточнён НДС', priority: 'high' },
    { title: 'Уточнён сервисный сбор / комиссия', priority: 'high' },
    { title: 'Подтверждены условия оплаты' },
    { title: 'Подтверждены условия отмены', priority: 'high' },
    { title: 'Получен договор', priority: 'high' },
    { title: 'Получен счёт', priority: 'high' },
    { title: 'Подтверждено бронирование', priority: 'critical' },
  ],
  catering: [
    { title: 'Получено актуальное меню', priority: 'high' },
    { title: 'Подтверждена актуальность цен', priority: 'high' },
    { title: 'Рассчитана стоимость на человека' },
    { title: 'Проверен сервисный сбор', priority: 'high' },
    { title: 'Учтён НДС', priority: 'high' },
    { title: 'Согласовано меню с клиентом', priority: 'critical' },
    { title: 'Подтверждены специальные требования гостей' },
  ],
  equipment: [
    { title: 'Подтверждён экран' }, { title: 'Подтверждён проектор' }, { title: 'Подтверждён звук' },
    { title: 'Подтверждены микрофоны' }, { title: 'Проверен Wi‑Fi' }, { title: 'Согласовано время монтажа' }, { title: 'Согласован доступ подрядчиков' },
  ],
  logistics: [
    { title: 'Согласован маршрут' }, { title: 'Подтверждено количество участников' }, { title: 'Подтверждён транспорт', priority: 'high' },
    { title: 'Согласовано время подачи' }, { title: 'Получены контакты водителя' }, { title: 'Получено финальное подтверждение', priority: 'high' },
  ],
  accommodation: [
    { title: 'Подтверждено количество номеров' }, { title: 'Согласованы категории номеров' }, { title: 'Подтверждены даты проживания' },
    { title: 'Уточнён ранний заезд' }, { title: 'Уточнён поздний выезд' }, { title: 'Получены списки гостей' }, { title: 'Подтверждено бронирование', priority: 'critical' },
  ],
  documents: [
    { title: 'Получен договор', priority: 'high' }, { title: 'Получен счёт', priority: 'high' }, { title: 'Получен акт' },
    { title: 'Получен УПД' }, { title: 'Получен счёт-фактура, если требуется' }, { title: 'Получены закрывающие документы' },
  ],
}

const typeCategories: Record<string, ChecklistCategory[]> = {
  Ужин: ['general', 'venue', 'catering', 'documents'],
  Обед: ['general', 'venue', 'catering', 'documents'],
  Конференция: ['general', 'venue', 'catering', 'equipment', 'documents'],
  Тимбилдинг: ['general', 'venue', 'catering', 'equipment', 'logistics', 'documents'],
  Проживание: ['general', 'accommodation', 'logistics', 'documents'],
  'Комплексное мероприятие': checklistCategoryOrder,
}

export function createChecklistForEvent(eventId: string, eventType: string, createdAt = new Date().toISOString()): ChecklistItem[] {
  const categories = typeCategories[eventType] ?? typeCategories['Комплексное мероприятие']
  return categories.flatMap((category) => presetItems[category].map((item, index) => ({
    id: `check-${eventId}-${category}-${index + 1}`,
    eventId,
    category,
    title: item.title,
    description: item.description ?? '',
    status: 'todo',
    priority: item.priority ?? 'normal',
    deadline: null,
    completedAt: null,
    notes: '',
    createdAt,
    updatedAt: createdAt,
  })))
}

export function calculateChecklistProgress(items: ChecklistItem[]) {
  const applicable = items.filter((item) => item.status !== 'not_applicable')
  if (!applicable.length) return 0
  const done = applicable.filter((item) => item.status === 'done').length
  return Math.round((done / applicable.length) * 100)
}
