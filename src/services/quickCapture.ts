export interface CaptureSuggestion {
  id: string
  kind: 'money' | 'task'
  title: string
  detail: string
  amount?: number
  deadline?: string | null
}

const months: Record<string, number> = { января: 0, февраля: 1, марта: 2, апреля: 3, мая: 4, июня: 5, июля: 6, августа: 7, сентября: 8, октября: 9, ноября: 10, декабря: 11 }

function localDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseCaptureDate(text: string, now = new Date()) {
  if (/(?:^|\s)сегодня(?=$|\s|[.,!?])/i.test(text)) return localDate(now.getFullYear(), now.getMonth(), now.getDate())
  if (/(?:^|\s)завтра(?=$|\s|[.,!?])/i.test(text)) { const date = new Date(now); date.setDate(date.getDate() + 1); return localDate(date.getFullYear(), date.getMonth(), date.getDate()) }
  const numeric = text.match(/\b(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\b/)
  if (numeric) { const year = numeric[3] ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]) : now.getFullYear(); return localDate(year, Number(numeric[2]) - 1, Number(numeric[1])) }
  const verbal = text.match(/(?:^|\s)(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?=$|\s|[.,!?])/i)
  if (verbal) return localDate(now.getFullYear(), months[verbal[2].toLowerCase()], Number(verbal[1]))
  return null
}

export function parseQuickCapture(text: string, now = new Date()): CaptureSuggestion[] {
  const suggestions: CaptureSuggestion[] = []
  const money = text.match(/(?:оплатили|аванс|плат[её]ж|сч[её]т|расход)[^\d]{0,24}(\d[\d\s]*(?:[.,]\d+)?)\s*(тыс(?:яч[аи]?)?|₽|руб(?:\.|лей)?)/i)
  if (money) {
    let amount = Number(money[1].replace(/\s/g, '').replace(',', '.'))
    if (/тыс/i.test(money[2])) amount *= 1000
    suggestions.push({ id: 'money', kind: 'money', title: `Платёж ${new Intl.NumberFormat('ru-RU').format(amount)} ₽`, detail: 'Добавить сумму в статью «Прочее»', amount })
  }
  const taskVerb = text.match(/(?:нужно\s+)?(получить|запросить|подтвердить|согласовать|отправить|проверить)\s+([^.!?\n]+)/i)
  if (taskVerb) {
    const deadline = parseCaptureDate(taskVerb[0], now) ?? parseCaptureDate(text, now)
    const raw = `${taskVerb[1]} ${taskVerb[2]}`.replace(/\s+(?:до\s+)?(?:сегодня|завтра|\d{1,2}[.\s]\d{1,2}.*)$/i, '').trim()
    suggestions.push({ id: 'task', kind: 'task', title: raw[0].toUpperCase() + raw.slice(1), detail: deadline ? `Срок: ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(`${deadline}T12:00:00`))}` : 'Без срока', deadline })
  }
  return suggestions
}
