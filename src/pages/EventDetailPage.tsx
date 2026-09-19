import { AlertTriangle, ArrowLeft, CalendarDays, Check, CheckSquare2, ChevronDown, CircleDollarSign, Clock3, ContactRound, Edit3, Ellipsis, FileText, History, Mail, MapPin, MessageCircle, NotebookPen, Save, Settings2, Share2, Users, WalletCards, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { checklistCategoryLabels, checklistCategoryOrder } from '../config/checklistPresets.ts'
import { calculateEventRisks } from '../config/riskRules.ts'
import { QuickCapture } from '../components/QuickCapture.tsx'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import { useToast } from '../hooks/useToast.tsx'
import { calculateBudget } from '../services/budget.ts'
import type { Activity, ChecklistItem, ChecklistStatus, Contractor, Event, EventStatus } from '../types/index.ts'
import { deadlineLabel, getDeadlineState } from '../utils/dates.ts'
import { formatCurrency, formatDate } from '../utils/format.ts'

type EventTab = 'feed' | 'tasks' | 'budget' | 'documents' | 'details'
const tabs: { id: EventTab; label: string; icon: typeof History }[] = [
  { id: 'feed', label: 'Лента', icon: History }, { id: 'tasks', label: 'Задачи', icon: CheckSquare2 }, { id: 'budget', label: 'Бюджет', icon: WalletCards }, { id: 'documents', label: 'Документы', icon: FileText }, { id: 'details', label: 'Подробнее', icon: Settings2 },
]
const statusLabels: Record<ChecklistStatus, string> = { todo: 'Не начато', in_progress: 'В работе', waiting: 'Ожидаем', done: 'Выполнено', overdue: 'Просрочено', not_applicable: 'Не применимо' }
interface FeedEntry { id: string; timestamp: string; type: Activity['type']; title: string; description: string; amount?: number; fileName?: string; deadline?: string | null }

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const data = useEventFlowData()
  const { showToast } = useToast()
  const event = data.events.find((item) => item.id === id)
  const [tab, setTab] = useState<EventTab>('feed')
  const [editing, setEditing] = useState(false)
  if (!event) return <main className="page"><div className="card placeholder"><AlertTriangle size={30} /><h2>Мероприятие не найдено</h2><button className="secondary-button" onClick={() => navigate('/events')}><ArrowLeft size={17} />К списку</button></div></main>

  const items = data.checklistItems.filter((item) => item.eventId === event.id)
  const budget = data.budgets.find((entry) => entry.eventId === event.id)
  const questions = data.questions.filter((item) => item.eventId === event.id)
  const activities = data.activities.filter((item) => item.eventId === event.id)
  const budgetSummary = budget ? calculateBudget(budget, event.guests) : null
  const risks = calculateEventRisks({ event, checklistItems: items, questions, budget })
  const contacts = getEventContacts(event, data.contractors)
  const important = items.filter((item) => item.status !== 'done' && item.status !== 'not_applicable').sort((a, b) => priorityWeight(a) - priorityWeight(b) || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')).slice(0, 4)

  return <main className="page notebook-event-page">
    <div className="event-breadcrumb"><button onClick={() => navigate('/events')}><ArrowLeft size={16} />К списку мероприятий</button></div>
    <div className="notebook-event-title"><div><div className="title-line"><h1>{event.title}</h1><span className="event-live-status">● {event.status}</span></div><p>{formatDate(event.date)} <b>•</b> {event.city} <b>•</b> Клиент: {event.client}</p></div><div><button className="icon-button title-more"><Ellipsis size={20} /></button><button className="primary-button share-button"><Share2 size={17} />Поделиться</button><button className="secondary-button edit-event-button" onClick={() => setEditing(true)}><Edit3 size={17} />Редактировать</button></div></div>
    {editing && <EventEditPanel event={event} contractors={data.contractors} onCancel={() => setEditing(false)} onSave={(updated) => { data.updateEvent(updated); setEditing(false); showToast('Данные сохранены') }} />}
    <nav className="event-tabs" aria-label="Разделы мероприятия">{tabs.map(({ id: tabId, label, icon: Icon }) => <button key={tabId} className={tab === tabId ? 'active' : ''} onClick={() => setTab(tabId)}><Icon size={17} />{label}</button>)}</nav>
    <section className="event-notebook-summary"><Summary icon={<CalendarDays />} label="Дата проведения" value={formatDate(event.date)} /><Summary icon={<MapPin />} label="Город / площадка" value={event.city} /><Summary icon={<Users />} label="Гости" value={`${event.guests} человек`} /><Summary icon={<CircleDollarSign />} label="Бюджет" value={formatCurrency(event.budget)} /><Summary icon={<Clock3 />} label="Статус" value={event.status} /></section>
    {tab === 'feed' && <div className="event-workspace"><div className="event-workspace-main"><QuickCapture eventId={event.id} title="Рабочая лента" /><EventFeed activities={activities} items={items} /></div><EventContextAside event={event} important={important} contacts={contacts} updateItem={data.updateChecklistItem} setTab={setTab} /></div>}
    {tab === 'tasks' && <div className="event-workspace single"><ChecklistView items={items} progress={event.progress} updateItem={data.updateChecklistItem} /></div>}
    {tab === 'budget' && <div className="event-workspace single"><BudgetView event={event} budget={budget} /></div>}
    {tab === 'documents' && <div className="event-workspace single"><DocumentsView eventId={event.id} activities={activities} /></div>}
    {tab === 'details' && <DetailsView event={event} items={items} questions={questions} risks={risks} activities={activities} budgetSummary={budgetSummary} updateItem={data.updateChecklistItem} />}
  </main>
}

function Summary({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <article className="card notebook-summary"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>
}

function EventFeed({ activities, items }: { activities: Activity[]; items: ChecklistItem[] }) {
  const feed = useMemo(() => {
    const activityEntries: FeedEntry[] = activities.map((activity) => ({ id: activity.id, timestamp: activity.timestamp, type: activity.type, title: activity.title, description: activity.entityId && activity.type === 'checklist' ? items.find((item) => item.id === activity.entityId)?.title ?? activity.description : activity.description, amount: activity.amount, fileName: activity.fileName }))
    const existingTaskIds = new Set(activities.filter((activity) => activity.type === 'checklist').map((activity) => activity.entityId))
    const taskEntries: FeedEntry[] = items.filter((item) => !existingTaskIds.has(item.id)).slice(0, 5).map((item) => ({ id: `task-${item.id}`, timestamp: item.updatedAt, type: 'checklist', title: item.status === 'done' ? 'Задача выполнена' : 'Задача', description: item.title, deadline: item.deadline }))
    return [...activityEntries, ...taskEntries].sort((a, b) => timeValue(b.timestamp) - timeValue(a.timestamp)).slice(0, 12)
  }, [activities, items])
  return <section className="card event-feed"><div className="feed-list">{feed.map((entry) => <article className="feed-entry" key={entry.id}><span className="feed-line-dot" /><span className={`feed-type-icon ${entry.type}`}>{feedIcon(entry.type)}</span><div className="feed-body"><div className="feed-meta"><strong>{feedTypeLabel(entry.type)}</strong><time>{formatActivityTime(entry.timestamp)} · Анастасия</time></div><p>{entry.description}</p>{entry.amount ? <b className="feed-amount">{formatCurrency(entry.amount)}</b> : null}{entry.deadline ? <span className={`feed-deadline ${getDeadlineState(entry.deadline)}`}>{deadlineLabel(entry.deadline)}</span> : null}{entry.fileName ? <span className="feed-file">📎 {entry.fileName}</span> : null}</div><button className="task-more"><Ellipsis size={18} /></button></article>)}{feed.length === 0 && <div className="today-empty"><NotebookPen size={26} /><strong>Лента пока пуста</strong><span>Добавьте первую запись выше.</span></div>}</div></section>
}

function EventContextAside({ event, important, contacts, updateItem, setTab }: { event: Event; important: ChecklistItem[]; contacts: Contractor[]; updateItem: (item: ChecklistItem) => void; setTab: (tab: EventTab) => void }) {
  return <aside className="event-context-aside"><section className="card context-card"><header><h2>Что сейчас важно</h2><button onClick={() => setTab('tasks')}>Все задачи →</button></header>{important.map((item) => <div className="important-row" key={item.id}><button className="task-checkbox" onClick={() => updateItem({ ...item, status: 'done' })} aria-label="Выполнить задачу" /><strong>{item.title}</strong><span className={getDeadlineState(item.deadline)}>{deadlineLabel(item.deadline)}</span></div>)}</section>
    <section className="card context-card"><header><h2>Контакты</h2><button onClick={() => setTab('details')}>Все контакты →</button></header>{contacts.map((contact) => <div className="contact-row" key={contact.id}><span>{contact.contactPerson.slice(0, 1) || contact.name.slice(0, 1)}</span><div><strong>{contact.contactPerson || contact.name}</strong><small>{contact.name}</small></div><a href={contact.phone ? `tel:${contact.phone}` : undefined}>☎</a><a href={contact.email ? `mailto:${contact.email}` : undefined}>✉</a></div>)}</section>
    <section className="card quick-actions-card"><h2>Быстрые действия</h2><div><Link to={`/templates?event=${event.id}`}><Mail size={18} /><span><strong>Письмо площадке</strong><small>Открыть шаблон</small></span></Link><button onClick={() => setTab('budget')}><CircleDollarSign size={18} /><span><strong>Смета</strong><small>Перейти к бюджету</small></span></button><button onClick={() => setTab('documents')}><FileText size={18} /><span><strong>Документы</strong><small>Записи и файлы</small></span></button><button onClick={() => setTab('details')}><Settings2 size={18} /><span><strong>Подробнее</strong><small>Все данные</small></span></button></div></section>
  </aside>
}

function ChecklistView({ items, progress, updateItem }: { items: ChecklistItem[]; progress: number; updateItem: (item: ChecklistItem) => void }) {
  return <section className="card notebook-checklist"><header><div><h2>Задачи и чек-лист</h2><p>{items.filter((item) => item.status === 'done').length} из {items.filter((item) => item.status !== 'not_applicable').length} выполнено</p></div><strong>{progress}%</strong></header><div className="progress-track"><span style={{ width: `${progress}%` }} /></div>{checklistCategoryOrder.map((category, index) => { const group = items.filter((item) => item.category === category); if (!group.length) return null; return <details key={category} open={index === 0}><summary><span><ChevronDown size={16} />{checklistCategoryLabels[category]}</span><strong>{group.filter((item) => item.status === 'done').length} из {group.length}</strong></summary>{group.map((item) => <ChecklistRow item={item} key={item.id} updateItem={updateItem} />)}</details> })}</section>
}

function ChecklistRow({ item, updateItem }: { item: ChecklistItem; updateItem: (item: ChecklistItem) => void }) {
  return <div className={`notebook-check-row ${item.status === 'done' ? 'done' : ''}`}><button className={`task-checkbox ${item.status === 'done' ? 'checked' : ''}`} onClick={() => updateItem({ ...item, status: item.status === 'done' ? 'todo' : 'done' })}>{item.status === 'done' && <Check size={13} />}</button><strong>{item.title}</strong><span className={getDeadlineState(item.deadline)}>{deadlineLabel(item.deadline)}</span><select value={item.status} onChange={(e) => updateItem({ ...item, status: e.target.value as ChecklistStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
}

function BudgetView({ event, budget }: { event: Event; budget: ReturnType<typeof useEventFlowData>['budgets'][number] | undefined }) {
  const summary = budget ? calculateBudget(budget, event.guests) : null
  return <section className="card notebook-budget"><header><div><h2>Бюджет мероприятия</h2><p>Структурированный расчёт остаётся связан с записями из ленты.</p></div><Link className="primary-button" to={`/budget?event=${event.id}`}>Открыть расчёт</Link></header>{summary && <div className="notebook-budget-grid"><div><span>Лимит клиента</span><strong>{formatCurrency(budget!.clientLimit)}</strong></div><div><span>Текущий расчёт</span><strong>{formatCurrency(summary.total)}</strong></div><div><span>На человека</span><strong>{formatCurrency(summary.perGuest)}</strong></div><div className={summary.status}><span>{summary.overage ? 'Превышение' : 'Остаток'}</span><strong>{formatCurrency(summary.overage || summary.remaining)}</strong></div></div>}</section>
}

function DocumentsView({ eventId, activities }: { eventId: string; activities: Activity[] }) {
  const documents = activities.filter((item) => item.type === 'document')
  return <div className="documents-tab"><QuickCapture eventId={eventId} title="Добавить документ или запись" /><section className="card document-list"><h2>Документы</h2>{documents.map((document) => <article key={document.id}><FileText size={20} /><div><strong>{document.fileName ?? document.description}</strong><small>{formatActivityTime(document.timestamp)}</small></div></article>)}{documents.length === 0 && <p>Документов пока нет. Укажите название файла в быстрой записи и выберите тип «Документ».</p>}</section></div>
}

function DetailsView({ event, items, questions, risks, activities, budgetSummary, updateItem }: { event: Event; items: ChecklistItem[]; questions: ReturnType<typeof useEventFlowData>['questions']; risks: ReturnType<typeof calculateEventRisks>; activities: Activity[]; budgetSummary: ReturnType<typeof calculateBudget> | null; updateItem: (item: ChecklistItem) => void }) {
  return <div className="details-layout"><div><ChecklistView items={items} progress={event.progress} updateItem={updateItem} /><section className="card detail-budget"><header><h2>Бюджет и лимиты</h2>{budgetSummary?.overage ? <span>Превышение на {formatCurrency(budgetSummary.overage)}</span> : null}</header>{budgetSummary && <div><p><span>Лимит клиента</span><strong>{formatCurrency(event.budget)}</strong></p><p><span>Текущий расчёт</span><strong>{formatCurrency(budgetSummary.total)}</strong></p><p><span>Доступно</span><strong>{formatCurrency(budgetSummary.remaining)}</strong></p></div>}</section></div><aside><section className="card detail-side"><header><h2>Открытые вопросы</h2><span>{questions.filter((item) => item.status !== 'resolved').length}</span></header>{questions.filter((item) => item.status !== 'resolved').map((item) => <article key={item.id}><MessageCircle size={18} /><div><strong>{item.title}</strong><small>{item.responsibleParty} · {deadlineLabel(item.deadline)}</small></div></article>)}</section><section className="card detail-side"><header><h2>Риски и предупреждения</h2><span>{risks.length}</span></header>{risks.slice(0, 5).map((risk) => <article key={risk.id}><AlertTriangle size={18} /><div><strong>{risk.title}</strong><small>{risk.description}</small></div></article>)}</section><section className="card detail-side"><header><h2>Последние действия</h2></header>{activities.slice(0, 5).map((activity) => <article key={activity.id}><History size={18} /><div><strong>{activity.title}</strong><small>{formatActivityTime(activity.timestamp)}</small></div></article>)}</section></aside></div>
}

function EventEditPanel({ event, contractors, onCancel, onSave }: { event: Event; contractors: Contractor[]; onCancel: () => void; onSave: (event: Event) => void }) {
  const [form, setForm] = useState(event)
  return <section className="card inline-edit-panel"><div className="section-title"><div><Edit3 size={19} /><h2>Основные данные</h2></div><button className="icon-button" onClick={onCancel}><X size={18} /></button></div><div className="inline-edit-grid"><label><span>Название</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label><span>Клиент</span><input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} /></label><label><span>Город</span><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label><label><span>Дата</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label><label><span>Гости</span><input type="number" value={form.guests} onChange={(e) => setForm({ ...form, guests: Number(e.target.value) })} /></label><label><span>Статус</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as EventStatus })}><option>В подготовке</option><option>В работе</option><option>Согласование</option></select></label><label><span>Контрагент</span><select value={form.contractorId ?? ''} onChange={(e) => setForm({ ...form, contractorId: e.target.value || undefined })}><option value="">Не выбран</option>{contractors.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div><div className="form-actions"><button className="secondary-button" onClick={onCancel}><X size={16} />Отмена</button><button className="primary-button" onClick={() => onSave(form)}><Save size={16} />Сохранить</button></div></section>
}

function getEventContacts(event: Event, contractors: Contractor[]) {
  const selected = contractors.find((item) => item.id === event.contractorId)
  return [selected, ...contractors.filter((item) => item.id !== selected?.id && (item.city === event.city || contractors.length <= 3))].filter(Boolean).slice(0, 3) as Contractor[]
}
function priorityWeight(item: ChecklistItem) { return ({ critical: 0, high: 1, normal: 2, low: 3 })[item.priority] }
function timeValue(value: string) { const result = new Date(value).getTime(); return Number.isNaN(result) ? 0 : result }
function formatActivityTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date) }
function feedTypeLabel(type: Activity['type']) { return ({ budget: 'Расход', document: 'Документ', message: 'Сообщение', note: 'Заметка', status: 'Статус', event: 'Событие', checklist: 'Задача', question: 'Вопрос', contractor: 'Контакт', backup: 'Система' })[type] }
function feedIcon(type: Activity['type']) { if (type === 'budget') return <CircleDollarSign size={19} />; if (type === 'document') return <FileText size={19} />; if (type === 'message') return <MessageCircle size={19} />; if (type === 'contractor') return <ContactRound size={19} />; if (type === 'checklist') return <CheckSquare2 size={19} />; return <NotebookPen size={19} /> }
