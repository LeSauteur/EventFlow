import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import { usePlanningClock } from '../hooks/usePlanningClock.ts'
import { isClosed, taskRegistry, type RegistryTask } from '../services/taskRegistry.ts'
import { urgency } from '../services/planningDates.ts'
import { RegistryTaskRow, priorityLabels } from '../components/RegistryTaskRow.tsx'
import { TaskComposer } from '../components/TaskComposer.tsx'
import { FloodComposer } from '../components/FloodPanel.tsx'
import type { SavedTaskFilter } from '../types/index.ts'

const emptyFilter = { query: '', tag: '', priority: '', eventId: '', includeClosed: false }
const buckets = ['Горит', 'Просрочено', 'Сегодня', 'Жду ответа', 'Ближайшие 7 дней', 'Без срока', 'Позже', 'Завершено']
export function TodayPage() {
  const data = useEventFlowData(), now = usePlanningClock(), location = useLocation()
  const [filter, setFilter] = useState(emptyFilter)
  const [filterName, setFilterName] = useState('')
  const [showFlood, setShowFlood] = useState(false)
  const focusKey = new URLSearchParams(location.search).get('task')
  const tasks = taskRegistry(data)
  const visible = tasks.filter((t) => (!t.archived || filter.includeClosed) && (!isClosed(t) || filter.includeClosed) && (!filter.eventId || t.eventId === filter.eventId) && (!filter.priority || t.priority === filter.priority) && (!filter.tag || t.tags.includes(filter.tag)) && `${t.title} ${t.eventTitle} ${t.waitingFor ?? ''} ${t.tags.join(' ')}`.toLocaleLowerCase('ru').includes(filter.query.toLocaleLowerCase('ru')))
  const bucket = (t: RegistryTask) => {
    if (isClosed(t)) return 'Завершено'
    const due = urgency(t.deadline, now, t.timeZone)
    if (t.manualHot) return 'Горит'
    if (due === 'overdue') return 'Просрочено'
    if (due === 'today' || urgency(t.reminderAt, now, t.timeZone) === 'today' || urgency(t.reminderAt, now, t.timeZone) === 'overdue') return 'Сегодня'
    if (t.status === 'waiting') return 'Жду ответа'
    return due === 'soon' ? 'Ближайшие 7 дней' : due === 'none' ? 'Без срока' : 'Позже'
  }
  const weight = { critical: 0, high: 1, normal: 2, low: 3 }
  visible.sort((a, b) => weight[a.priority] - weight[b.priority] || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))
  const saved = data.settings.savedTaskFilters ?? []
  const saveFilter = () => {
    if (!filterName.trim()) return
    const next: SavedTaskFilter = { ...filter, id: crypto.randomUUID(), name: filterName.trim() }
    data.updateSettings({ ...data.settings, savedTaskFilters: [...saved, next] }); setFilterName('')
  }
  const focusTask = focusKey ? tasks.find((t) => t.key === focusKey) : null
  return <main className="planning-page">
    <header className="planning-heading"><div><span className="planning-eyebrow">ВАШ РАБОЧИЙ ДЕНЬ</span><h1>Сегодня</h1><p>{new Intl.DateTimeFormat('ru-RU', { dateStyle: 'full', timeZone: data.settings.timeZone ?? 'Europe/Moscow' }).format(now)}</p></div><div className="planning-links"><Link to="/calendar">Календарь</Link><button onClick={() => setShowFlood(!showFlood)}>Флуд · {data.floodEntries.filter((e) => e.status === 'new').length}</button></div></header>
    {showFlood && <section className="planning-card"><FloodComposer /><Link to="/flood">Все записи Флуда →</Link></section>}
    {data.events.some((event) => event.pinned) && <section className="planning-card pinned-events"><h2>Закреплено</h2>{data.events.filter((event) => event.pinned).map((event) => <Link key={event.id} to={`/events/${event.id}`}>📌 {event.title}</Link>)}</section>}
    <section className="planning-card"><h2>Быстрая задача</h2><TaskComposer /></section>
    <div className="planning-stats">{buckets.slice(0, 5).map((name) => <a href={`#planning-${buckets.indexOf(name)}`} onClick={(e) => { e.preventDefault(); document.getElementById(`planning-${buckets.indexOf(name)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} key={name}><span>{name}</span><strong>{visible.filter((t) => bucket(t) === name).length}</strong></a>)}</div>
    {focusTask && <section className="planning-card"><h2>Выбранная задача</h2><RegistryTaskRow task={focusTask} /></section>}
    <section className="planning-card planning-filters"><label>Поиск<input aria-label="Поиск задач" value={filter.query} onChange={(e) => setFilter({ ...filter, query: e.target.value })} placeholder="Задача, мероприятие, контакт" /></label><label>Мероприятие<select value={filter.eventId} onChange={(e) => setFilter({ ...filter, eventId: e.target.value })}><option value="">Все</option>{data.events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label><label>Метка<select value={filter.tag} onChange={(e) => setFilter({ ...filter, tag: e.target.value })}><option value="">Все метки</option>{[...new Set(tasks.flatMap((t) => t.tags))].sort().map((tag) => <option key={tag}>{tag}</option>)}</select></label><label>Важность<select value={filter.priority} onChange={(e) => setFilter({ ...filter, priority: e.target.value })}><option value="">Любая</option>{Object.entries(priorityLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className="planning-checkbox"><input type="checkbox" checked={filter.includeClosed} onChange={(e) => setFilter({ ...filter, includeClosed: e.target.checked })} />Завершённые и архив</label><button className="secondary-button" onClick={() => setFilter(emptyFilter)}>Сбросить</button>
      <div className="saved-filters"><input aria-label="Название фильтра" placeholder="Название набора фильтров" value={filterName} onChange={(e) => setFilterName(e.target.value)} /><button onClick={saveFilter} disabled={!filterName.trim()}>Сохранить фильтр</button>{saved.map((f) => <span key={f.id}><button onClick={() => setFilter(f)}>{f.name}</button><button aria-label={`Удалить фильтр ${f.name}`} onClick={() => data.updateSettings({ ...data.settings, savedTaskFilters: saved.filter((s) => s.id !== f.id) })}>×</button></span>)}</div>
    </section>
    {!visible.length && <p className="planning-empty">Задач по этим условиям нет.</p>}
    {buckets.map((name, index) => <section id={`planning-${index}`} className="planning-card task-bucket" key={name}><header><h2>{name}</h2><span>{visible.filter((t) => bucket(t) === name).length}</span></header>{visible.filter((t) => bucket(t) === name).map((task) => <RegistryTaskRow task={task} key={task.key} />)}{!visible.some((t) => bucket(t) === name) && <p className="planning-empty">Здесь пока ничего нет.</p>}</section>)}
  </main>
}
