export const DEFAULT_ZONE = 'Europe/Moscow'
export function validZone(zone = DEFAULT_ZONE) { try { new Intl.DateTimeFormat('en', { timeZone: zone }); return zone } catch { return DEFAULT_ZONE } }
export function dayInZone(at: Date | string = new Date(), zone = DEFAULT_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: validZone(zone), year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(at))
  const p = Object.fromEntries(parts.map((i) => [i.type, i.value]))
  return `${p.year}-${p.month}-${p.day}`
}
export function addCalendarDays(day: string, count: number) { const at = new Date(`${day}T12:00:00Z`); at.setUTCDate(at.getUTCDate() + count); return at.toISOString().slice(0, 10) }
export function weekStart(day: string) { return addCalendarDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7)) }
export function validDate(value?: string | null) { return !!value && (/^\d{4}-\d{2}-\d{2}$/.test(value) ? !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value : /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value))) }
export function dateDay(value: string, zone = DEFAULT_ZONE) { return value.length === 10 ? value : dayInZone(value, zone) }
export function urgency(deadline?: string | null, now = new Date(), zone = DEFAULT_ZONE): 'none' | 'overdue' | 'today' | 'soon' | 'later' {
  if (!validDate(deadline)) return 'none'
  const day = dateDay(deadline!, zone), today = dayInZone(now, zone)
  if (deadline!.length > 10 && Date.parse(deadline!) <= +now || day < today) return 'overdue'
  if (day === today) return 'today'
  return day <= addCalendarDays(today, 7) ? 'soon' : 'later'
}
export function displayPlanningDate(value: string, zone = DEFAULT_ZONE) {
  if (!validDate(value)) return 'Без срока'
  return new Intl.DateTimeFormat('ru-RU', { timeZone: value.length === 10 ? 'UTC' : validZone(zone), day: 'numeric', month: 'short', ...(value.length > 10 ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value))
}
export function localDateTime(value: string, zone = DEFAULT_ZONE) {
  if (!validDate(value) || value.length === 10) return ''
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: validZone(zone), year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)).map((p) => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}
export function zonedDateTime(value: string, zone = DEFAULT_ZONE) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  let at = Date.parse(`${value}:00Z`)
  for (let n = 0; n < 3; n++) {
    const shown = localDateTime(new Date(at).toISOString(), zone)
    const diff = Date.parse(`${value}:00Z`) - Date.parse(`${shown}:00Z`)
    if (!diff) return new Date(at).toISOString()
    at += diff
  }
  return null // A nonexistent local time during a daylight-saving transition.
}
