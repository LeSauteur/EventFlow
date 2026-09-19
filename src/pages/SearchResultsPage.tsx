import { Building2, CalendarDays, MapPin, Search, Users } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import { formatDate } from '../utils/format.ts'

export function SearchResultsPage() {
  const { search } = useLocation()
  const { events, contractors } = useEventFlowData()
  const query = new URLSearchParams(search).get('q')?.trim() ?? ''
  const normalized = query.toLowerCase()
  const foundEvents = normalized ? events.filter((event) => `${event.title} ${event.client} ${event.city}`.toLowerCase().includes(normalized)) : []
  const foundContractors = normalized ? contractors.filter((contractor) => `${contractor.name} ${contractor.type} ${contractor.city} ${contractor.contactPerson}`.toLowerCase().includes(normalized)) : []
  const total = foundEvents.length + foundContractors.length
  return <main className="page"><div className="page-toolbar"><div><h1>Поиск</h1><p>{query ? `По запросу «${query}» найдено: ${total}` : 'Введите запрос в верхней строке поиска'}</p></div></div>{query && <div className="search-results-grid"><section className="card search-result-card"><div className="section-title"><div><CalendarDays className="section-blue" size={22} /><h2>Мероприятия</h2></div><span className="completion-count">{foundEvents.length}</span></div>{foundEvents.map((event) => <Link className="search-result-row" to={`/events/${event.id}`} key={event.id}><span className="list-icon"><CalendarDays size={17} /></span><div><strong>{event.title}</strong><small>{event.client} · {event.city} · {formatDate(event.date)}</small></div></Link>)}{!foundEvents.length && <p className="empty-inline">Совпадений нет.</p>}</section><section className="card search-result-card"><div className="section-title"><div><Building2 className="section-blue" size={22} /><h2>Контрагенты</h2></div><span className="completion-count">{foundContractors.length}</span></div>{foundContractors.map((contractor) => <Link className="search-result-row" to="/contractors" key={contractor.id}><span className="list-icon"><Building2 size={17} /></span><div><strong>{contractor.name}</strong><small><MapPin size={12} />{contractor.city} · <Users size={12} />{contractor.contactPerson || contractor.type}</small></div></Link>)}{!foundContractors.length && <p className="empty-inline">Совпадений нет.</p>}</section></div>}{!query && <div className="card placeholder"><span className="placeholder-icon"><Search size={28} /></span><h2>Найдите нужное за несколько секунд</h2><p>Поиск работает по мероприятиям, клиентам, городам и контрагентам.</p></div>}</main>
}
