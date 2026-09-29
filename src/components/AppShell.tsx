import { CalendarPlus, ChevronRight, FileText, Search, Settings } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { STAGES } from '../config/servicePresets.ts'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import { useSync } from '../hooks/useSync.tsx'
import { eventMatchesSearch } from '../services/eventSearch.ts'
import type { EventStage } from '../types/index.ts'
import { Brand } from './Brand.tsx'

function eventDate(event: ReturnType<typeof useEventFlowData>['events'][number]) {
  const start = event.dateFrom || event.date
  const end = event.dateTo && event.dateTo !== start ? event.dateTo : ''
  const format = (value: string) => {
    const parsed = new Date(`${value}T12:00:00`)
    return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(parsed)
  }
  return end ? `${format(start)}–${format(end)}` : format(start)
}

export function AppShell({ children }: { children: ReactNode }) {
  const { events } = useEventFlowData()
  const sync = useSync()
  const location = useLocation()
  const navigate = useNavigate()
  const [stage, setStage] = useState<EventStage>('WORKING')
  const [query, setQuery] = useState('')
  const eventId = location.pathname.match(/^\/events\/([^/]+)$/)?.[1]
  const selectedEvent = events.find((event) => event.id === eventId)

  useEffect(() => { if (selectedEvent) setStage(selectedEvent.stage) }, [selectedEvent?.id, selectedEvent?.stage])

  const searching = query.trim().length > 0
  const visibleEvents = useMemo(() => events
    .filter((event) => searching ? eventMatchesSearch(event, query) : event.stage === stage)
    .sort((a, b) => (a.dateFrom || a.date).localeCompare(b.dateFrom || b.date)), [events, query, searching, stage])

  const chooseStage = (value: EventStage) => {
    setQuery('')
    setStage(value)
    const first = events.filter((event) => event.stage === value).sort((a, b) => (a.dateFrom || a.date).localeCompare(b.dateFrom || b.date))[0]
    navigate(first ? `/events/${first.id}` : '/events')
  }

  return <div className="notebook-shell">
    <aside className="notebook-nav">
      <div className="notebook-brand"><Brand /><span>рабочий блокнот</span></div>
      <Link className="new-event-button" to="/events/new"><CalendarPlus size={18} />Новое мероприятие</Link>
      <nav className="stage-nav" aria-label="Стадии мероприятий">
        {STAGES.map((item) => <button key={item.value} className={stage === item.value ? 'active' : ''} onClick={() => chooseStage(item.value)}><span>{item.label}</span><strong>{events.filter((event) => event.stage === item.value).length}</strong></button>)}
      </nav>
      <div className={`notebook-save-state ${sync.status}`}><i /><span>{sync.status === 'syncing' ? 'Сохраняем в GitHub…' : sync.status === 'error' ? 'Ошибка онлайн-сохранения' : sync.hasToken && sync.status === 'online' ? 'Сохранено в GitHub' : sync.hasToken && sync.dirty ? 'Локально сохранено · ждёт GitHub' : 'Автосохранение на этом устройстве'}</span></div>
      <div className="notebook-secondary-nav">
        <Link to="/templates"><FileText size={17} />Шаблоны сообщений</Link>
        <Link to="/settings"><Settings size={17} />Настройки и данные</Link>
      </div>
    </aside>

    <aside className="event-index">
      <header><strong>{searching ? 'Поиск по всем стадиям' : STAGES.find((item) => item.value === stage)?.label}</strong><span>{visibleEvents.length}</span></header>
      <label className="event-index-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Любое слово или контакт" aria-label="Сквозной поиск" /></label>
      <div className="event-index-list">
        {visibleEvents.map((event) => <Link key={event.id} to={`/events/${event.id}`} className={event.id === eventId ? 'active' : ''}>
          <span className="event-index-date">{eventDate(event)}</span>
          <span><strong>{event.title}</strong><small>{searching && <b className="event-index-stage">{STAGES.find((item) => item.value === event.stage)?.label}</b>}{event.city}{event.initiator ? ` · ${event.initiator}` : ''}</small></span>
          <ChevronRight size={15} />
        </Link>)}
        {!visibleEvents.length && <div className="event-index-empty"><span>{searching ? 'Ничего не найдено. Попробуйте другое слово.' : 'В этой стадии пока нет мероприятий.'}</span>{!searching && <Link to="/events/new">Создать первое</Link>}</div>}
      </div>
    </aside>

    <div className="notebook-workspace">{children}</div>
  </div>
}
