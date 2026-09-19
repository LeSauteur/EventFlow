export type DeadlineState = 'today' | 'tomorrow' | 'overdue' | 'future' | 'none'

export function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(date: Date, amount: number) {
  const result = new Date(date)
  result.setHours(12, 0, 0, 0)
  result.setDate(result.getDate() + amount)
  return result
}

export function getDeadlineState(deadline: string | null, now = new Date()): DeadlineState {
  if (!deadline) return 'none'
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const target = new Date(`${deadline}T00:00:00`)
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return 'future'
}

export function deadlineLabel(deadline: string | null, now = new Date()) {
  const state = getDeadlineState(deadline, now)
  if (state === 'none') return 'Без срока'
  if (state === 'overdue') return 'Просрочено'
  if (state === 'today') return 'Сегодня'
  if (state === 'tomorrow') return 'Завтра'
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(`${deadline}T12:00:00`))
}
