import { CalendarDays, Check, Clock3, Ellipsis, FileText, History, NotebookPen, TriangleAlert } from 'lucide-react'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { QuickCapture } from '../components/QuickCapture.tsx'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import type { ChecklistItem } from '../types/index.ts'
import { deadlineLabel, getDeadlineState } from '../utils/dates.ts'

const colors = ['#19b879', '#1677f3', '#7447ea', '#ef9d23']

function isOpen(item: ChecklistItem) { return item.status !== 'done' && item.status !== 'not_applicable' }

export function DashboardPage() {
  const data = useEventFlowData()
  const now = new Date()
  const openItems = data.checklistItems.filter(isOpen)
  const overdue = openItems.filter((item) => getDeadlineState(item.deadline, now) === 'overdue')
  const today = openItems.filter((item) => getDeadlineState(item.deadline, now) === 'today')
  const waiting = data.questions.filter((item) => item.status === 'waiting_external' || item.status === 'waiting_client').length + openItems.filter((item) => item.status === 'waiting').length
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7)
  const thisWeek = openItems.filter((item) => item.deadline && new Date(`${item.deadline}T12:00:00`) >= now && new Date(`${item.deadline}T12:00:00`) <= weekEnd).length
  const focusItems = useMemo(() => openItems.filter((item) => ['overdue', 'today', 'tomorrow'].includes(getDeadlineState(item.deadline, now))).sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')).slice(0, 12), [data.checklistItems])
  const groups = data.events.map((event, index) => ({ event, color: colors[index % colors.length], items: focusItems.filter((item) => item.eventId === event.id) })).filter((group) => group.items.length)
  const dateText = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)

  return <main className="page today-page">
    <div className="today-heading"><div><h1>Сегодня</h1><p>Что требует внимания прямо сейчас</p></div><div><span>{dateText}</span><strong>☀️ Хорошего дня, {data.settings.userName}!</strong></div></div>
    <div className="today-layout"><div className="today-main">
      <section className="today-kpis">
        <Kpi icon={<TriangleAlert size={20} />} tone="red" label="Просрочено" value={overdue.length} caption="требуют внимания" />
        <Kpi icon={<CalendarDays size={20} />} tone="blue" label="На сегодня" value={today.length} caption="задач в плане" />
        <Kpi icon={<Clock3 size={20} />} tone="amber" label="Ждём ответа" value={waiting} caption="запроса у контрагентов" />
        <Kpi icon={<History size={20} />} tone="green" label="На этой неделе" value={thisWeek} caption="задач всего" />
      </section>
      <section className="card today-tasks"><header><h2>Задачи на сегодня</h2><div><button className="active">Все <span>{focusItems.length}</span></button><button>Мои <span>{focusItems.length}</span></button><button>По мероприятиям⌄</button></div></header>
        <div className="task-groups">{groups.map(({ event, items, color }) => <div className="today-event-group" key={event.id}><div className="today-event-head"><Link to={`/events/${event.id}`}><span style={{ background: color }} />{event.title}</Link><small>{event.city} · {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(`${event.date}T12:00:00`))}</small><strong>{items.length} {items.length === 1 ? 'задача' : 'задачи'}</strong></div>{items.map((item) => <TodayTask key={item.id} item={item} onToggle={() => data.updateChecklistItem({ ...item, status: 'done' })} />)}</div>)}{groups.length === 0 && <div className="today-empty"><Check size={26} /><strong>На сегодня всё спокойно</strong><span>Ближайшие задачи появятся здесь автоматически.</span></div>}</div>
        <Link className="today-add-task" to={data.events[0] ? `/events/${data.events[0].id}` : '/events/new'}>＋ Добавить задачу</Link>
      </section>
    </div><aside className="today-aside"><QuickCapture compact />
      <section className="card recent-updates"><header><h2>Последние обновления</h2><Link to="/events">Все события →</Link></header>{data.activities.slice(0, 5).map((activity) => <div className="recent-item" key={activity.id}><span className={`recent-icon recent-type-${activity.type}`}>{activity.type === 'document' ? <FileText size={16} /> : activity.type === 'note' ? <NotebookPen size={16} /> : <History size={16} />}</span><div><strong>{activity.title}</strong><small>{data.events.find((event) => event.id === activity.eventId)?.title ?? activity.description} · {formatTime(activity.timestamp)}</small></div></div>)}</section>
    </aside></div>
  </main>
}

function Kpi({ icon, tone, label, value, caption }: { icon: ReactNode; tone: string; label: string; value: number; caption: string }) {
  return <article className="card today-kpi"><span className={tone}>{icon}</span><div><strong>{label}</strong><b>{value}</b><small>{caption}</small></div></article>
}

function TodayTask({ item, onToggle }: { item: ChecklistItem; onToggle: () => void }) {
  const state = getDeadlineState(item.deadline)
  return <div className="today-task"><button className="task-checkbox" onClick={onToggle} aria-label={`Выполнить задачу: ${item.title}`} /><strong>{item.title}</strong><span className={`task-deadline ${state}`}><Clock3 size={13} />{deadlineLabel(item.deadline)}</span><span className="task-category">{categoryLabel(item.category)}</span><button className="task-more" aria-label="Действия"><Ellipsis size={18} /></button></div>
}

function categoryLabel(value: ChecklistItem['category']) {
  return { general: 'Общее', venue: 'Площадка', catering: 'Питание', equipment: 'Техника', logistics: 'Логистика', accommodation: 'Отель', documents: 'Документы' }[value]
}

function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}
