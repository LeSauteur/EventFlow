import type { EventFlowData } from './storage.ts'
import { isClosed, taskRegistry, type RegistryTask } from './taskRegistry.ts'
import { validDate, zonedDateTime } from './planningDates.ts'

/** A view of existing records: a deadline never creates a second task. */
export function eventDeadlineTasks(data: EventFlowData, eventId: string) {
  const instant = (task: RegistryTask) => Date.parse(task.deadline!.length === 10 ? zonedDateTime(`${task.deadline}T23:59`, task.timeZone) ?? `${task.deadline}T23:59:00Z` : task.deadline!)
  return taskRegistry(data).filter((task) => task.eventId === eventId && validDate(task.deadline)).sort((a, b) => instant(a) - instant(b) || a.key.localeCompare(b.key))
}

export function nearestEventDeadline(data: EventFlowData, eventId: string) {
  return eventDeadlineTasks(data, eventId).find((task) => !isClosed(task) && !task.archived)
}
