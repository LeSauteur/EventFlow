import { CalendarDays, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import { formatCurrency, formatDate } from '../utils/format.ts'

export function EventsPage() {
  const { events } = useEventFlowData()
  const navigate = useNavigate()
  const initialQuery = new URLSearchParams(window.location.search).get('q') ?? ''
  const [query, setQuery] = useState(initialQuery)
  const filteredEvents = useMemo(() => { const normalized = query.trim().toLowerCase(); return normalized ? events.filter((event) => [event.title, event.client, event.city].some((value) => value.toLowerCase().includes(normalized))) : events }, [events, query])
  return <main className="page"><div className="page-toolbar"><div><h1>Мероприятия</h1><p>Все созданные мероприятия и их текущий статус</p></div><button className="primary-button" onClick={() => navigate('/events/new')}><Plus size={18} />Новое мероприятие</button></div><section className="card events-panel"><label className="events-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по названию, клиенту или городу" /></label>{filteredEvents.length ? <div className="events-table"><div className="events-table-head"><span>Мероприятие</span><span>Дата и город</span><span>Гости</span><span>Бюджет</span><span>Статус</span></div>{filteredEvents.map((event) => <Link className="events-table-row" to={`/events/${event.id}`} key={event.id}><div><span className="list-icon"><CalendarDays size={18} /></span><span><strong>{event.title}</strong><small>{event.client}</small></span></div><div><strong>{formatDate(event.date)}</strong><small>{event.city}</small></div><div>{event.guests}</div><div>{formatCurrency(event.budget)}</div><div><span className={`event-status status-${event.status.toLowerCase().replaceAll(' ', '-')}`}>{event.status}</span></div></Link>)}</div> : <div className="empty-state"><Search size={30} /><h2>Ничего не найдено</h2><p>Попробуйте изменить поисковый запрос.</p></div>}</section></main>
}
