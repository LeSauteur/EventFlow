import { Archive, Check, ChevronDown, CirclePlus, Clock3, History, Plus, Trash2, UserRound, X } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { COMMON_CHECKLIST_TITLES, createWorkChecklist, createServiceInstance, SERVICE_PRESETS, serviceProviderLabel, stageToStatus, STAGES } from '../config/servicePresets.ts'
import { FloodPanel } from '../components/FloodPanel.tsx'
import { EventFlags, EventMarks } from '../components/EventFlags.tsx'
import { EventDeadlines, EventDeadlineSummary } from '../components/EventDeadlines.tsx'
import { CompactTaskRow } from '../components/CompactTaskRow.tsx'
import { taskRegistry } from '../services/taskRegistry.ts'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import type { Event, ServiceInstance, ServiceType, TimelineEntry, WorkChecklistItem } from '../types/index.ts'

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`

function formatEventDate(event: Event) {
  const format = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
  if (!event.dateTo || event.dateTo === event.dateFrom) return format(event.dateFrom)
  return `${format(event.dateFrom)} — ${format(event.dateTo)}`
}

function formatTimelineDate(value: string) {
  const parsed = new Date(value)
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(parsed)
}

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const data = useEventFlowData()
  const { events, updateEvent, deleteEvent } = data
  const location = useLocation()
  const navigate = useNavigate()
  const event = events.find((item) => item.id === id)
  const [tourDraft, setTourDraft] = useState('')
  const [waitingDraft, setWaitingDraft] = useState('')
  const [timelineDraft, setTimelineDraft] = useState('')
  const [serviceType, setServiceType] = useState<ServiceType>('accommodation')
  const [customServiceTitle, setCustomServiceTitle] = useState('')
  const [taskDrafts, setTaskDrafts] = useState<Record<string, string>>({})
  const [showAllTimeline, setShowAllTimeline] = useState(false)
  const [view, setView] = useState<'work' | 'flood'>('work')
  const [commonDraft, setCommonDraft] = useState('')
  const [undoWaiting, setUndoWaiting] = useState<Event['waitingItems'][number] | null>(null)
  useEffect(() => { setView('work'); setUndoWaiting(null) }, [id])
  useEffect(() => {
    const key = new URLSearchParams(location.search).get('task')
    if (!key) return
    setView('work')
    requestAnimationFrame(() => {
      const element = document.querySelector(`[data-task-key="${CSS.escape(key)}"]`)
      let parent = element?.parentElement
      while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement }
      element?.scrollIntoView({ block: 'center' })
    })
  }, [id, location.search])

  if (!event) return <main className="event-page missing-event"><h1>Мероприятие не найдено</h1><button className="secondary-button" onClick={() => navigate('/events')}>К списку</button></main>

  const save = (next: Event, timelineText?: string) => {
    const timeline = timelineText ? [{ id: uid('timeline'), eventId: next.id, text: timelineText, timestamp: new Date().toISOString(), source: 'system' as const }, ...next.timeline] : next.timeline
    updateEvent({ ...next, timeline })
  }

  const patchPassport = (field: keyof Event, value: string | number) => {
    const next = { ...event, [field]: value }
    if (field === 'dateFrom') next.date = String(value)
    if (field === 'company') next.client = String(value)
    if (field === 'participants') next.guests = Number(value)
    if (field === 'sector') next.type = String(value)
    save(next)
  }

  const toggleCommon = (index: number) => {
    const checklist = event.commonChecklist.map((item, itemIndex) => itemIndex === index ? { ...item, completed: !item.completed, completedAt: !item.completed ? new Date().toISOString() : null, taskStatus: !item.completed ? 'done' as const : 'todo' as const, updatedAt: new Date().toISOString() } : item)
    const changed = checklist[index]
    save({ ...event, commonChecklist: checklist }, `${changed.title}: ${changed.completed ? 'готово' : 'снова в работе'}`)
  }

  const addTour = (e: FormEvent) => {
    e.preventDefault()
    const value = tourDraft.trim()
    if (!value || event.workTourNumbers.includes(value)) return
    setTourDraft('')
    save({ ...event, workTourNumbers: [...event.workTourNumbers, value] }, `Добавлен номер тура ${value}`)
  }

  const addWaiting = (e: FormEvent) => {
    e.preventDefault()
    const text = waitingDraft.trim()
    if (!text) return
    setWaitingDraft('')
    save({ ...event, waitingItems: [...event.waitingItems, { id: uid('waiting'), text, completed: false, createdAt: new Date().toISOString() }] })
  }

  const updateService = (service: ServiceInstance) => save({ ...event, services: event.services.map((item) => item.id === service.id ? { ...service, updatedAt: new Date().toISOString() } : item) })
  const removeService = (service: ServiceInstance) => {
    if (!window.confirm(`Удалить блок «${service.title}» из этого мероприятия?`)) return
    save({ ...event, services: event.services.filter((item) => item.id !== service.id), removedServices: { ...event.removedServices, [service.id]: new Date().toISOString() } }, `Удалена услуга «${service.title}»`)
  }

  const addService = (e: FormEvent) => {
    e.preventDefault()
    const title = serviceType === 'custom' ? customServiceTitle.trim() : undefined
    if (serviceType === 'custom' && !title) return
    const service = createServiceInstance(event.id, serviceType, title)
    service.checklist = []
    setCustomServiceTitle('')
    save({ ...event, services: [...event.services, service] }, `Добавлена услуга «${service.title}»`)
  }

  const addServiceTask = (service: ServiceInstance, e: FormEvent) => {
    e.preventDefault()
    const title = (taskDrafts[service.id] ?? '').trim()
    if (!title) return
    setTaskDrafts((current) => ({ ...current, [service.id]: '' }))
    updateService({ ...service, checklist: [...service.checklist, { id: uid('service-task'), title, completed: false, completedAt: null, updatedAt: new Date().toISOString() }] })
  }

  const addTimeline = (e: FormEvent) => {
    e.preventDefault()
    const text = timelineDraft.trim()
    if (!text) return
    setTimelineDraft('')
    const entry: TimelineEntry = { id: uid('timeline'), eventId: event.id, text, timestamp: new Date().toISOString(), source: 'user' }
    save({ ...event, timeline: [entry, ...event.timeline] })
  }

  const removeEvent = () => {
    if (!window.confirm(`Удалить мероприятие «${event.title}» полностью?\n\nКарточка и все связанные данные будут удалены на всех устройствах после синхронизации.`)) return
    deleteEvent(event.id)
    navigate('/events')
  }

  return <main className="event-page">
    <div className="event-planning-nav"><button aria-pressed={view === 'work'} onClick={() => setView('work')}>Работа</button><button aria-pressed={view === 'flood'} onClick={() => setView('flood')}>Флуд · {data.floodEntries.filter((entry) => entry.eventId === id && entry.status === 'new').length}</button></div>
    {view === 'flood' ? <><h1>{event.title} · Флуд</h1><FloodPanel eventId={event.id} /></> : <>
    <header className="event-page-header">
      <div><p>{formatEventDate(event)}</p><div className="event-detail-name"><input className="event-title-input" key={`${event.id}-title`} defaultValue={event.title} onBlur={(e) => e.target.value.trim() && patchPassport('title', e.target.value.trim())} aria-label="Название мероприятия" /><EventMarks event={event} /></div></div>
      <div className="event-header-actions"><div className="stage-and-progress"><label><span>Стадия</span><select value={event.stage} onChange={(e) => { const stage = e.target.value as Event['stage']; save({ ...event, stage, status: stageToStatus(stage) }, `Стадия изменена: ${STAGES.find((item) => item.value === stage)?.label}`) }}>{STAGES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label></div><button className="delete-event-button" onClick={removeEvent} aria-label="Удалить мероприятие"><Trash2 size={16} />Удалить</button></div>
    </header>
    <EventFlags event={event} />
    <EventDeadlineSummary eventId={event.id} />

    <section className="passport-section">
      <div className="section-kicker"><UserRound size={17} /><h2>Паспорт</h2><span>Изменения сохраняются после выхода из поля</span></div>
      <div className="passport-grid">
        <NotebookField label="Дата начала" type="date" value={event.dateFrom} onCommit={(value) => patchPassport('dateFrom', value)} />
        <NotebookField label="Дата окончания" type="date" value={event.dateTo} onCommit={(value) => patchPassport('dateTo', value)} />
        <NotebookField label="Сектор" value={event.sector} onCommit={(value) => patchPassport('sector', value)} />
        <NotebookField label="Город" value={event.city} onCommit={(value) => patchPassport('city', value)} />
        <NotebookField label="Компания" value={event.company} onCommit={(value) => patchPassport('company', value)} />
        <NotebookField label="Инициатор / контакт" value={event.initiator} placeholder="Введите ФИО" onCommit={(value) => patchPassport('initiator', value)} />
        <NotebookField label="Участников" type="number" value={String(event.participants || '')} onCommit={(value) => patchPassport('participants', Number(value))} />
        <label className="notebook-field event-categories-field"><span>Категории (любые, через запятую)</span><input aria-label="Категории мероприятия" key={event.tags?.join(',')} defaultValue={event.tags?.join(', ') ?? ''} placeholder="Например: VIP, Выездное, Логистика" onBlur={(e) => { const tags = [...new Set(e.target.value.split(',').map((value) => value.trim()).filter(Boolean))]; if (JSON.stringify(tags) !== JSON.stringify(event.tags ?? [])) save({ ...event, tags }) }} /></label>
      </div>
      <div className="service-tags">{event.services.map((service) => <span key={service.id}>{service.title}</span>)}{!event.services.length && <em>Услуги пока не добавлены</em>}</div>
    </section>

    <div className="focus-grid">
      <section className="focus-block waiting-block"><div className="section-kicker"><Clock3 size={17} /><h2>Жду</h2></div>
        <div className="waiting-list">{event.waitingItems.filter((item) => item.taskStatus !== 'cancelled').map((item) => <div className={item.completed ? 'done' : ''} key={item.id}><button className={`notebook-checkbox ${item.completed ? 'checked' : ''}`} aria-label={`Готово: ${item.text}`} onClick={() => save({ ...event, waitingItems: event.waitingItems.map((entry) => entry.id === item.id ? { ...entry, completed: !entry.completed, completedAt: !entry.completed ? new Date().toISOString() : null, taskStatus: entry.completed ? 'waiting' : 'done', updatedAt: new Date().toISOString() } : entry) })}>{item.completed && <Check size={13} />}</button><textarea rows={1} key={item.text} defaultValue={item.text} aria-label="Текст ожидания" onBlur={(e) => { if (e.target.value !== item.text) save({ ...event, waitingItems: event.waitingItems.map((entry) => entry.id === item.id ? { ...entry, text: e.target.value, updatedAt: new Date().toISOString() } : entry) }) }} /><button className="quiet-icon" onClick={() => { setUndoWaiting(item); save({ ...event, waitingItems: event.waitingItems.map((entry) => entry.id === item.id ? { ...entry, taskStatus: 'cancelled', updatedAt: new Date().toISOString() } : entry) }) }} aria-label="Убрать ожидание"><X size={15} /></button></div>)}</div>
        {undoWaiting && <button className="notebook-undo" onClick={() => { save({ ...event, waitingItems: event.waitingItems.map((entry) => entry.id === undoWaiting.id ? { ...undoWaiting, updatedAt: new Date().toISOString() } : entry) }); setUndoWaiting(null) }}>Отменить удаление</button>}
        <form className="inline-add" onSubmit={addWaiting}><input value={waitingDraft} onChange={(e) => setWaitingDraft(e.target.value)} placeholder="Добавить ожидание…" /><button aria-label="Добавить"><Plus size={17} /></button></form>
      </section>
      <section className="focus-block next-step-block" data-task-key={`next:${encodeURIComponent(event.id)}:next-step`}><div className="section-kicker"><CirclePlus size={17} /><h2>Следующий шаг</h2></div><p>Свободная рабочая запись. Сохраняется после выхода из поля.</p><textarea key={`${event.id}-next-${event.nextStep}`} defaultValue={event.nextStep} aria-label="Следующий шаг" onBlur={(e) => { if (e.target.value !== event.nextStep) save({ ...event, nextStep: e.target.value, nextStepTask: { ...event.nextStepTask, taskStatus: 'todo', updatedAt: new Date().toISOString() } }) }} placeholder="Что нужно сделать дальше?" /><EventDeadlines event={event} key={event.id} /></section>
    </div>

    <section className="common-section">
      <details className="optional-checklist common-optional"><summary>Общий чек-лист · {event.commonChecklist.filter((item) => item.taskStatus !== 'cancelled').length}</summary><div className="common-list">{event.commonChecklist.map((item, index) => item.taskStatus !== 'cancelled' && <div className={item.completed ? 'done' : ''} key={item.id} data-task-key={`common:${encodeURIComponent(event.id)}:${encodeURIComponent(item.id)}`}><button className={`notebook-checkbox ${item.completed ? 'checked' : ''}`} aria-label={`Готово: ${item.title}`} onClick={() => toggleCommon(index)}>{item.completed && <Check size={13} />}</button><input key={item.title} defaultValue={item.title} onBlur={(e) => { if (e.target.value !== item.title) save({ ...event, commonChecklist: event.commonChecklist.map((entry) => entry.id === item.id ? { ...entry, title: e.target.value, updatedAt: new Date().toISOString() } : entry) }) }} aria-label="Название этапа" />{item.title === 'Смета в WORK' && <span className="work-badge">WORK</span>}</div>)}</div><form className="inline-add" onSubmit={(e) => { e.preventDefault(); if (commonDraft.trim()) { save({ ...event, commonChecklist: [...event.commonChecklist, { id: uid('common'), title: commonDraft.trim(), completed: false, updatedAt: new Date().toISOString() }] }); setCommonDraft('') } }}><input aria-label="Новый пункт общего чек-листа" value={commonDraft} onChange={(e) => setCommonDraft(e.target.value)} placeholder="Добавить свой пункт" /><button><Plus size={16} />Добавить</button></form>{!event.commonChecklist.length && <button className="notebook-undo" onClick={() => save({ ...event, commonChecklist: createWorkChecklist(COMMON_CHECKLIST_TITLES, 'common') })}>Добавить типовой чек-лист</button>}</details>
      <div className="tour-numbers"><strong>Номера туров WORK</strong><div>{event.workTourNumbers.map((number) => <span key={number}>{number}<button onClick={() => save({ ...event, workTourNumbers: event.workTourNumbers.filter((item) => item !== number) })}><X size={13} /></button></span>)}</div><form className="inline-add" onSubmit={addTour}><input value={tourDraft} onChange={(e) => setTourDraft(e.target.value)} placeholder="Номер тура" /><button><Plus size={17} />Добавить номер</button></form></div>
    </section>

    <section className="services-section">
      <div className="services-heading"><div><span>Услуги</span><h2>Рабочие блоки</h2></div><form onSubmit={addService}><select value={serviceType} onChange={(e) => setServiceType(e.target.value as ServiceType)}>{SERVICE_PRESETS.map((preset) => <option value={preset.type} key={preset.type}>{preset.title}</option>)}</select>{serviceType === 'custom' && <input value={customServiceTitle} onChange={(e) => setCustomServiceTitle(e.target.value)} placeholder="Название услуги" />}<button className="secondary-button"><Plus size={16} />Добавить услугу</button></form></div>
      <div className="service-blocks">{event.services.map((service) => <ServiceBlock key={service.id} service={service} taskDraft={taskDrafts[service.id] ?? ''} setTaskDraft={(value) => setTaskDrafts((current) => ({ ...current, [service.id]: value }))} onChange={updateService} onRemove={() => removeService(service)} onAddTask={(e) => addServiceTask(service, e)} />)}</div>
      {!event.services.length && <div className="empty-services">При необходимости добавьте услугу для контактов и свободных рабочих заметок.</div>}
    </section>
    {taskRegistry(data).some((task) => task.eventId === event.id && !task.deadline && ['checklist', 'question', 'legacy'].includes(task.source)) && <details className="optional-checklist additional-tasks"><summary>Отдельно добавленные задачи</summary>{taskRegistry(data).filter((task) => task.eventId === event.id && !task.deadline && ['checklist', 'question', 'legacy'].includes(task.source)).map((task) => <CompactTaskRow task={task} key={task.key} />)}</details>}
    <section className="timeline-section">
      <div className="section-kicker"><History size={17} /><h2>Рабочие записи</h2><span>Дата и время добавятся автоматически</span></div>
      <form className="timeline-compose" onSubmit={addTimeline}><textarea value={timelineDraft} onChange={(e) => setTimelineDraft(e.target.value)} placeholder="Что произошло?" /><button className="primary-button">Добавить запись</button></form>
      <div className="timeline-list">{event.timeline.slice(0, showAllTimeline ? undefined : 8).map((entry) => <article key={entry.id}><time>{formatTimelineDate(entry.timestamp)}</time><div><p>{entry.text}</p>{entry.source === 'system' && <span>системная запись</span>}</div></article>)}</div>
      {event.timeline.length > 8 && <button className="show-more" onClick={() => setShowAllTimeline((value) => !value)}>{showAllTimeline ? 'Свернуть' : `Показать все записи (${event.timeline.length})`}</button>}
    </section>
    </>}
  </main>
}

function NotebookField({ label, value, type = 'text', placeholder, onCommit }: { label: string; value: string; type?: string; placeholder?: string; onCommit: (value: string) => void }) {
  return <label className="notebook-field"><span>{label}</span><input key={value} type={type} defaultValue={value} placeholder={placeholder} onBlur={(e) => onCommit(e.target.value)} /></label>
}

function ServiceBlock({ service, taskDraft, setTaskDraft, onChange, onRemove, onAddTask }: { service: ServiceInstance; taskDraft: string; setTaskDraft: (value: string) => void; onChange: (service: ServiceInstance) => void; onRemove: () => void; onAddTask: (event: FormEvent) => void }) {
  const [undoTask, setUndoTask] = useState<WorkChecklistItem | null>(null)
  const updateTask = (task: WorkChecklistItem) => onChange({ ...service, checklist: service.checklist.map((item) => item.id === task.id ? { ...task, updatedAt: new Date().toISOString() } : item) })
  return <details className="service-block" open>
    <summary><span><ChevronDown size={17} /><span><strong>{service.title}</strong><small>{service.providerName || serviceProviderLabel(service.type)}</small></span></span></summary>
    <div className="service-content">
      <div className="service-fields"><NotebookField label={serviceProviderLabel(service.type)} value={service.providerName} placeholder="Добавить" onCommit={(value) => onChange({ ...service, providerName: value })} /><NotebookField label="Контакт" value={service.providerContact} placeholder="Телефон, email или ФИО" onCommit={(value) => onChange({ ...service, providerContact: value })} /></div>
      <label className="service-notes"><span>Комментарий</span><textarea key={service.notes} aria-label={`Рабочая заметка: ${service.title}`} defaultValue={service.notes} onBlur={(e) => { if (e.target.value !== service.notes) onChange({ ...service, notes: e.target.value }) }} placeholder="Свободная рабочая заметка: договорённости, вопросы, что важно учесть" /></label>
      <details className="optional-checklist service-optional"><summary>Чек-лист (по желанию) · {service.checklist.filter((item) => item.taskStatus !== 'cancelled').length}</summary><div className="service-checklist">{service.checklist.filter((task) => task.taskStatus !== 'cancelled').map((task) => <div className={task.completed ? 'done' : ''} key={task.id} data-task-key={`service:${encodeURIComponent(service.eventId)}:${encodeURIComponent(service.id)}:${encodeURIComponent(task.id)}`}><button className={`notebook-checkbox ${task.completed ? 'checked' : ''}`} aria-label={`Готово: ${task.title}`} onClick={() => updateTask({ ...task, completed: !task.completed, taskStatus: task.completed ? 'todo' : 'done', completedAt: !task.completed ? new Date().toISOString() : null })}>{task.completed && <Check size={13} />}</button><input key={task.title} defaultValue={task.title} aria-label="Текст пункта услуги" onBlur={(e) => { if (e.target.value !== task.title) updateTask({ ...task, title: e.target.value }) }} /><button className="quiet-icon" onClick={() => { setUndoTask(task); updateTask({ ...task, taskStatus: 'cancelled' }) }} aria-label="Убрать пункт"><X size={14} /></button></div>)}</div><form className="inline-add service-task-add" onSubmit={onAddTask}><input aria-label="Новый пункт услуги" value={taskDraft} onChange={(e) => setTaskDraft(e.target.value)} placeholder="Добавить свой пункт…" /><button><Plus size={16} />Добавить</button></form>{!service.checklist.length && <button className="notebook-undo" onClick={() => onChange({ ...service, checklist: createWorkChecklist(SERVICE_PRESETS.find((preset) => preset.type === service.type)?.checklist ?? [], 'service') })}>Добавить типовой чек-лист</button>}</details>
      {undoTask && <button className="notebook-undo" onClick={() => { updateTask(undoTask); setUndoTask(null) }}>Отменить удаление</button>}
      <button className="remove-service" onClick={onRemove}><Trash2 size={15} />Удалить услугу</button>
    </div>
  </details>
}
