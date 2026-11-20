import type { EventFlowData } from './storage.ts'
import { isClosed, taskRegistry } from './taskRegistry.ts'
import { dateDay, validDate } from './planningDates.ts'

export interface CalendarEntry { id: string; kind: 'event' | 'deadline' | 'reminder'; title: string; eventId: string; taskKey?: string; startDay: string; endDay: string; at?: string; timeZone: string }
export function calendarEntries(data: EventFlowData, zone = 'Europe/Moscow'): CalendarEntry[] {
  const entries: CalendarEntry[] = data.events.filter((e) => e.stage !== 'ARCHIVE' && validDate(e.dateFrom || e.date)).map((e) => {
    const start = dateDay(e.dateFrom || e.date, zone)
    return { id: `event:${e.id}`, kind: 'event', title: e.title, eventId: e.id, startDay: start, endDay: validDate(e.dateTo) && e.dateTo >= start ? e.dateTo : start, timeZone: e.timeZone ?? zone }
  })
  for (const task of taskRegistry(data).filter((t) => !isClosed(t) && !t.archived)) for (const [kind, at] of [['deadline', task.deadline], ['reminder', task.reminderAt]] as const) {
    if (!validDate(at)) continue
    const day = dateDay(at!, zone)
    entries.push({ id: `${task.key}:${kind}`, kind, title: task.title, eventId: task.eventId, taskKey: task.key, startDay: day, endDay: day, at: at!, timeZone: task.timeZone })
  }
  return entries.sort((a, b) => a.startDay.localeCompare(b.startDay) || (a.at ?? '').localeCompare(b.at ?? '') || a.id.localeCompare(b.id))
}
export const entriesOnDay = (entries: CalendarEntry[], day: string) => entries.filter((e) => e.startDay <= day && e.endDay >= day)
