import type { EventFlowData } from './storage.ts'
import { taskRegistry, isClosed } from './taskRegistry.ts'
import { addCalendarDays, dayInZone, urgency } from './planningDates.ts'
import type { Event, EventAttention } from '../types/index.ts'

export function toggleEventAttention(flags: EventAttention[], flag: EventAttention): EventAttention[] {
  if (flags.includes(flag)) return flags.filter((value) => value !== flag)
  return flag === 'ready' ? ['ready'] : [...flags.filter((value) => value !== 'ready'), flag]
}

/** Aggregate real attention signals, never count every preset checkbox as urgent work. */
export function attentionEventIds(data: EventFlowData, now = new Date()) {
  const zone = data.settings.timeZone ?? 'Europe/Moscow', today = dayInZone(now, zone), end = addCalendarDays(today, 7)
  const ids = new Set(data.events.filter((event) => event.stage !== 'ARCHIVE' && (event.pinned || event.attentionFlags?.length || ((event.dateFrom || event.date) <= end && (event.dateTo || event.dateFrom || event.date) >= today) || event.waitingItems.some((item) => !item.completed && item.taskStatus !== 'cancelled'))).map((event) => event.id))
  for (const task of taskRegistry(data)) if (!isClosed(task) && !task.archived && task.eventId && (task.manualHot || ['overdue', 'today', 'soon'].includes(urgency(task.deadline, now, task.timeZone)) || ['overdue', 'today'].includes(urgency(task.reminderAt, now, task.timeZone)))) ids.add(task.eventId)
  return ids
}
export function compareAttentionEvents(a: Event, b: Event) {
  const rank = (event: Event) => event.attentionFlags?.includes('hot') ? 0 : event.attentionFlags?.includes('urgent') ? 1 : event.attentionFlags?.includes('important') ? 2 : 3
  return Number(!!b.pinned) - Number(!!a.pinned) || rank(a) - rank(b) || (a.dateFrom || a.date).localeCompare(b.dateFrom || b.date)
}
