import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import { usePlanningClock } from '../hooks/usePlanningClock.ts'
import { addCalendarDays, dayInZone, displayPlanningDate, weekStart } from '../services/planningDates.ts'
import { calendarEntries, entriesOnDay } from '../services/planningCalendar.ts'
import { isClosed, taskRegistry } from '../services/taskRegistry.ts'
import { RegistryTaskRow } from '../components/RegistryTaskRow.tsx'
import { TaskComposer } from '../components/TaskComposer.tsx'

const kindLabels = { event: 'Мероприятие', deadline: 'Срок задачи', reminder: 'Напоминание' }
export function CalendarPage() {
  const data = useEventFlowData(), now = usePlanningClock()
  const [zone, setZone] = useState(data.settings.calendarTimeZone ?? data.settings.timeZone ?? 'Europe/Moscow')
  const [view, setView] = useState<'month' | 'week' | 'agenda'>('month')
  const [selected, setSelected] = useState(dayInZone(now, zone))
  const [kinds, setKinds] = useState(['event', 'deadline', 'reminder'])
  const [eventId, setEventId] = useState('')
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const start = view === 'month' ? weekStart(selected.slice(0, 7) + '-01') : view === 'week' ? weekStart(selected) : selected
  const days = Array.from({ length: view === 'month' ? 42 : view === 'week' ? 7 : 14 }, (_, i) => addCalendarDays(start, i))
  const entries = calendarEntries(data, zone).filter((entry) => kinds.includes(entry.kind) && (!eventId || entry.eventId === eventId))
  const tasks = taskRegistry(data)
  const unscheduled = tasks.filter((t) => !t.deadline && !t.reminderAt && !isClosed(t) && !t.archived && (!eventId || t.eventId === eventId))
  const move = (direction: number) => {
    if (view !== 'month') { setSelected(addCalendarDays(selected, direction * (view === 'week' ? 7 : 14))); return }
    const date = new Date(`${selected.slice(0, 7)}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + direction); setSelected(date.toISOString().slice(0, 10))
  }
  const agendaDays = view === 'month' ? [selected] : days
  const focusTask = tasks.find((t) => t.key === focusKey)
  return <main className="planning-page">
    <header className="planning-heading"><div><span className="planning-eyebrow">ДАТЫ И СЛЕДУЮЩИЕ ДЕЙСТВИЯ</span><h1>Календарь</h1><p>Мероприятия, сроки и напоминания в одном плане</p></div><Link to="/today">К задачам на сегодня →</Link></header>
    <section className="planning-card calendar-controls"><div className="planning-segments">{Object.entries({ month: 'Месяц', week: 'Неделя', agenda: 'Расписание' }).map(([id, label]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id as typeof view)}>{label}</button>)}</div><label>Часовой пояс<select aria-label="Часовой пояс календаря" value={zone} onChange={(e) => { setZone(e.target.value); data.updateSettings({ ...data.settings, calendarTimeZone: e.target.value }) }}>{['Europe/Moscow', 'Europe/Kaliningrad', 'Europe/Samara', 'Asia/Yekaterinburg', 'Asia/Novosibirsk', 'Asia/Vladivostok', 'UTC'].map((z) => <option key={z}>{z}</option>)}</select></label><label>Мероприятие<select aria-label="Мероприятие календаря" value={eventId} onChange={(e) => setEventId(e.target.value)}><option value="">Все</option>{data.events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label><div className="calendar-kinds">{Object.entries(kindLabels).map(([id, label]) => <label key={id}><input type="checkbox" checked={kinds.includes(id)} onChange={() => setKinds(kinds.includes(id) ? kinds.filter((k) => k !== id) : [...kinds, id])} /><i className={`cal-${id}`} />{label}</label>)}</div></section>
    <section className="planning-card"><div className="calendar-period"><button aria-label="Предыдущий период" onClick={() => move(-1)}>←</button><h2>{view === 'month' ? new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${selected}T12:00:00Z`)) : `${displayPlanningDate(start)} — ${displayPlanningDate(days.at(-1)!)}`}</h2><button aria-label="Следующий период" onClick={() => move(1)}>→</button><button onClick={() => setSelected(dayInZone(now, zone))}>Сегодня</button></div>
      {view !== 'agenda' && <><div className="planning-weekdays">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => <span key={day}>{day}</span>)}</div><div className="planning-calendar-grid">{days.map((day) => {
        const items = entriesOnDay(entries, day)
        return <button key={day} className={`${day === selected ? 'selected' : ''} ${day === dayInZone(now, zone) ? 'is-today' : ''}`} aria-label={`${day}, записей: ${items.length}`} aria-pressed={day === selected} onClick={() => setSelected(day)}><strong>{Number(day.slice(8))}</strong><div>{items.slice(0, 3).map((e) => <span className={`cal-${e.kind}`} key={e.id}><i /> <b>{e.title}</b></span>)}{items.length > 3 && <small>+{items.length - 3}</small>}</div></button>
      })}</div></>}
    </section>
    <section className="planning-card"><h2>Новая задача на {displayPlanningDate(selected)}</h2><TaskComposer deadline={selected} eventId={eventId || undefined} /></section>
    {focusTask && <section className="planning-card"><header className="flood-actions"><h2>Задача</h2><button onClick={() => setFocusKey(null)}>Закрыть</button></header><RegistryTaskRow task={focusTask} /></section>}
    <div className="calendar-agenda">{agendaDays.map((day) => <section className="planning-card" key={day}><h2>{displayPlanningDate(day)}</h2>{entriesOnDay(entries, day).map((entry) => <div className={`calendar-agenda-item cal-${entry.kind}`} key={entry.id}><span>{kindLabels[entry.kind]}{entry.at && entry.at.length > 10 ? ` · ${displayPlanningDate(entry.at, zone)}` : ''}</span>{entry.taskKey ? <button onClick={() => setFocusKey(entry.taskKey!)}>{entry.title}</button> : <Link to={`/events/${entry.eventId}`}>{entry.title}</Link>}{entry.eventId && <small>{data.events.find((e) => e.id === entry.eventId)?.title}</small>}</div>)}{!entriesOnDay(entries, day).length && <p className="planning-empty">На этот день записей нет.</p>}</section>)}</div>
    <details className="planning-card"><summary>Без даты · {unscheduled.length}</summary><p className="planning-empty">Эти задачи видны в «Сегодня». Укажите срок или напоминание, чтобы разместить их в календаре.</p>{unscheduled.map((task) => <RegistryTaskRow key={task.key} task={task} />)}</details>
  </main>
}
