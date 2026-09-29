import type { Event } from '../types/index.ts'

export function normalizeSearch(value: unknown) {
  return String(value ?? '')
    .toLocaleLowerCase('ru-RU')
    .replaceAll('ё', 'е')
    .replace(/[^\p{L}\p{N}@._-]+/gu, ' ')
    .trim()
}

export function eventSearchText(event: Event) {
  return normalizeSearch([
    event.title,
    event.city,
    event.company,
    event.client,
    event.initiator,
    event.sector,
    event.type,
    event.date,
    event.dateFrom,
    event.dateTo,
    event.stage,
    event.status,
    event.nextStep,
    ...event.workTourNumbers,
    ...event.commonChecklist.flatMap((item) => [item.title, item.notes]),
    ...event.waitingItems.map((item) => item.text),
    ...event.timeline.map((item) => item.text),
    ...event.services.flatMap((service) => [
      service.title,
      service.providerName,
      service.providerContact,
      service.notes,
      ...service.checklist.flatMap((item) => [item.title, item.notes]),
    ]),
  ].join(' '))
}

export function eventMatchesSearch(event: Event, query: string) {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const haystack = eventSearchText(event)
  return terms.every((term) => haystack.includes(term))
}
