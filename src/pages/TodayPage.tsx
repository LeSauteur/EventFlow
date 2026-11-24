import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import { usePlanningClock } from '../hooks/usePlanningClock.ts'
import { attentionEventIds, compareAttentionEvents } from '../services/eventAttention.ts'
import { eventMatchesSearch } from '../services/eventSearch.ts'
import { displayPlanningDate } from '../services/planningDates.ts'
import { EventFlags, attentionLabels } from '../components/EventFlags.tsx'
import { FloodComposer } from '../components/FloodPanel.tsx'
import { CompactTaskRow } from '../components/CompactTaskRow.tsx'
import { isClosed, taskRegistry } from '../services/taskRegistry.ts'

export function TodayPage() {
  const data = useEventFlowData(), now = usePlanningClock()
  const [view, setView] = useState('attention')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [flag, setFlag] = useState('')
  const [showFlood, setShowFlood] = useState(false)
  const attention = attentionEventIds(data, now)
  const active = data.events.filter((event) => event.stage !== 'ARCHIVE')
  const events = active.filter((event) => (view === 'all' || (view === 'pinned' ? event.pinned : attention.has(event.id))) && (!category || event.tags?.includes(category)) && (!flag || event.attentionFlags?.includes(flag as keyof typeof attentionLabels)) && eventMatchesSearch(event, query)).sort(compareAttentionEvents)
  const looseTasks = taskRegistry(data).filter((task) => !task.eventId && !isClosed(task))
  return <main className="planning-page notebook-today">
    <header className="planning-heading"><div><span className="planning-eyebrow">РАБОЧИЙ БЛОКНОТ</span><h1>Сегодня</h1><p>{new Intl.DateTimeFormat('ru-RU', { dateStyle: 'full', timeZone: data.settings.timeZone ?? 'Europe/Moscow' }).format(now)}</p></div><div className="planning-links"><Link to="/calendar">Календарь</Link><button onClick={() => setShowFlood(!showFlood)}>Флуд · {data.floodEntries.filter((entry) => entry.status === 'new').length}</button></div></header>
    {showFlood && <section className="planning-card"><FloodComposer /><Link to="/flood">Все записи Флуда →</Link></section>}
    <div className="event-overview-toolbar">
      <div className="planning-segments">{[['attention', 'Требуют внимания'], ['all', 'Все мероприятия'], ['pinned', 'Закреплённые']].map(([id, label]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{label} <small>{id === 'all' ? active.length : id === 'pinned' ? active.filter((event) => event.pinned).length : active.filter((event) => attention.has(event.id)).length}</small></button>)}</div>
      <div className="event-overview-filters"><input aria-label="Поиск мероприятий" placeholder="Найти мероприятие или запись" value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Категория мероприятий" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Все категории</option>{[...new Set(active.flatMap((event) => event.tags ?? []))].sort().map((tag) => <option key={tag}>{tag}</option>)}</select><select aria-label="Отметка мероприятий" value={flag} onChange={(e) => setFlag(e.target.value)}><option value="">Все отметки</option>{Object.entries(attentionLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></div>
    </div>
    <section className="event-overview-list" aria-label="Мероприятия">
      {events.map((event) => <article className="planning-card event-overview-card" data-event-id={event.id} key={event.id}>
        <div className="event-overview-title"><div><Link to={`/events/${event.id}`}>{event.title}</Link><p>{displayPlanningDate(event.dateFrom || event.date)}{event.dateTo && event.dateTo !== (event.dateFrom || event.date) ? ` — ${displayPlanningDate(event.dateTo)}` : ''}{event.city ? ` · ${event.city}` : ''}{event.company ? ` · ${event.company}` : ''}</p></div><span>{event.status}</span></div>
        {event.nextStep && <p className="event-overview-note"><b>Следующий шаг:</b> {event.nextStep}</p>}
        {event.waitingItems.some((item) => !item.completed && item.taskStatus !== 'cancelled') && <p className="event-overview-note"><b>Жду:</b> {event.waitingItems.filter((item) => !item.completed && item.taskStatus !== 'cancelled').map((item) => item.text).join('; ')}</p>}
        {!!event.tags?.length && <div className="event-category-tags">{event.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
        <EventFlags event={event} />
      </article>)}
      {!events.length && <div className="planning-card"><h2>{view === 'attention' ? 'Сейчас нет мероприятий, требующих внимания' : 'Мероприятий по этим условиям нет'}</h2><p className="planning-empty">Можно открыть все мероприятия или отметить нужное как важное, срочное или горящее.</p><button onClick={() => { setView('all'); setQuery(''); setCategory(''); setFlag('') }}>Показать все мероприятия</button></div>}
    </section>
    {looseTasks.length > 0 && <details className="planning-card optional-checklist"><summary>Отдельные задачи без мероприятия · {looseTasks.length}</summary>{looseTasks.map((task) => <CompactTaskRow key={task.key} task={task} />)}</details>}
  </main>
}
