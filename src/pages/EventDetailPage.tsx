import { Archive, Check, ChevronDown, CirclePlus, Clock3, History, Plus, Trash2, UserRound, X } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createServiceInstance, SERVICE_PRESETS, serviceProviderLabel, stageToStatus, STAGES } from '../config/servicePresets.ts'
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
  const { events, updateEvent, deleteEvent } = useEventFlowData()
  const navigate = useNavigate()
  const event = events.find((item) => item.id === id)
  const [tourDraft, setTourDraft] = useState('')
  const [waitingDraft, setWaitingDraft] = useState('')
  const [timelineDraft, setTimelineDraft] = useState('')
  const [serviceType, setServiceType] = useState<ServiceType>('accommodation')
  const [customServiceTitle, setCustomServiceTitle] = useState('')
  const [taskDrafts, setTaskDrafts] = useState<Record<string, string>>({})
  const [showAllTimeline, setShowAllTimeline] = useState(false)

  const completion = useMemo(() => {
    if (!event) return { done: 0, total: 0, percent: 0 }
    const all = [...event.commonChecklist, ...event.services.flatMap((service) => service.checklist)]
    const done = all.filter((item) => item.completed).length
    return { done, total: all.length, percent: all.length ? Math.round(done / all.length * 100) : 0 }
  }, [event])

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
    const checklist = event.commonChecklist.map((item, itemIndex) => itemIndex === index ? { ...item, completed: !item.completed, completedAt: !item.completed ? new Date().toISOString() : null } : item)
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

  const updateService = (service: ServiceInstance) => save({ ...event, services: event.services.map((item) => item.id === service.id ? service : item) })
  const removeService = (service: ServiceInstance) => {
    if (!window.confirm(`Удалить блок «${service.title}» из этого мероприятия?`)) return
    save({ ...event, services: event.services.filter((item) => item.id !== service.id) }, `Удалена услуга «${service.title}»`)
  }

  const addService = (e: FormEvent) => {
    e.preventDefault()
    const title = serviceType === 'custom' ? customServiceTitle.trim() : undefined
    if (serviceType === 'custom' && !title) return
    const service = createServiceInstance(event.id, serviceType, title)
    setCustomServiceTitle('')
    save({ ...event, services: [...event.services, service] }, `Добавлена услуга «${service.title}»`)
  }

  const addServiceTask = (service: ServiceInstance, e: FormEvent) => {
    e.preventDefault()
    const title = (taskDrafts[service.id] ?? '').trim()
    if (!title) return
    setTaskDrafts((current) => ({ ...current, [service.id]: '' }))
    updateService({ ...service, checklist: [...service.checklist, { id: uid('service-task'), title, completed: false, completedAt: null }] })
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
    <header className="event-page-header">
      <div><p>{formatEventDate(event)}</p><input className="event-title-input" key={`${event.id}-title`} defaultValue={event.title} onBlur={(e) => e.target.value.trim() && patchPassport('title', e.target.value.trim())} aria-label="Название мероприятия" /></div>
      <div className="event-header-actions"><div className="stage-and-progress"><label><span>Стадия</span><select value={event.stage} onChange={(e) => { const stage = e.target.value as Event['stage']; save({ ...event, stage, status: stageToStatus(stage) }, `Стадия изменена: ${STAGES.find((item) => item.value === stage)?.label}`) }}>{STAGES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label><div className="event-progress"><span><strong>{completion.percent}%</strong> · {completion.done} из {completion.total}</span><i><b style={{ width: `${completion.percent}%` }} /></i></div></div><button className="delete-event-button" onClick={removeEvent} aria-label="Удалить мероприятие"><Trash2 size={16} />Удалить</button></div>
    </header>

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
      </div>
      <div className="service-tags">{event.services.map((service) => <span key={service.id}>{service.title}</span>)}{!event.services.length && <em>Услуги пока не добавлены</em>}</div>
    </section>

    <div className="focus-grid">
      <section className="focus-block waiting-block"><div className="section-kicker"><Clock3 size={17} /><h2>Жду</h2></div>
        <div className="waiting-list">{event.waitingItems.map((item) => <div className={item.completed ? 'done' : ''} key={item.id}><button className={`notebook-checkbox ${item.completed ? 'checked' : ''}`} onClick={() => save({ ...event, waitingItems: event.waitingItems.map((entry) => entry.id === item.id ? { ...entry, completed: !entry.completed, completedAt: !entry.completed ? new Date().toISOString() : null } : entry) })}>{item.completed && <Check size={13} />}</button><span>{item.text}</span><button className="quiet-icon" onClick={() => save({ ...event, waitingItems: event.waitingItems.filter((entry) => entry.id !== item.id) })} aria-label="Удалить"><X size={15} /></button></div>)}</div>
        <form className="inline-add" onSubmit={addWaiting}><input value={waitingDraft} onChange={(e) => setWaitingDraft(e.target.value)} placeholder="Добавить ожидание…" /><button aria-label="Добавить"><Plus size={17} /></button></form>
      </section>
      <section className="focus-block next-step-block"><div className="section-kicker"><CirclePlus size={17} /><h2>Следующий шаг</h2></div><p>Одна главная текущая задача. Напишите её свободным текстом — поле сохранится автоматически, когда вы перейдёте в другое место.</p><textarea key={`${event.id}-next`} defaultValue={event.nextStep} onBlur={(e) => save({ ...event, nextStep: e.target.value })} placeholder="Например: получить PO" /></section>
    </div>

    <section className="common-section">
      <div className="section-kicker"><Check size={17} /><h2>Общее</h2></div>
      <div className="common-list">{event.commonChecklist.map((item, index) => <div className={item.completed ? 'done' : ''} key={item.id}><button className={`notebook-checkbox ${item.completed ? 'checked' : ''}`} onClick={() => toggleCommon(index)}>{item.completed && <Check size={13} />}</button><input defaultValue={item.title} onBlur={(e) => save({ ...event, commonChecklist: event.commonChecklist.map((entry) => entry.id === item.id ? { ...entry, title: e.target.value } : entry) })} aria-label="Название этапа" />{item.title === 'Смета в WORK' && <span className="work-badge">WORK</span>}</div>)}</div>
      <div className="tour-numbers"><strong>Номера туров WORK</strong><div>{event.workTourNumbers.map((number) => <span key={number}>{number}<button onClick={() => save({ ...event, workTourNumbers: event.workTourNumbers.filter((item) => item !== number) })}><X size={13} /></button></span>)}</div><form className="inline-add" onSubmit={addTour}><input value={tourDraft} onChange={(e) => setTourDraft(e.target.value)} placeholder="Номер тура" /><button><Plus size={17} />Добавить номер</button></form></div>
    </section>

    <section className="services-section">
      <div className="services-heading"><div><span>Услуги</span><h2>Рабочие блоки</h2></div><form onSubmit={addService}><select value={serviceType} onChange={(e) => setServiceType(e.target.value as ServiceType)}>{SERVICE_PRESETS.map((preset) => <option value={preset.type} key={preset.type}>{preset.title}</option>)}</select>{serviceType === 'custom' && <input value={customServiceTitle} onChange={(e) => setCustomServiceTitle(e.target.value)} placeholder="Название услуги" />}<button className="secondary-button"><Plus size={16} />Добавить услугу</button></form></div>
      <div className="service-blocks">{event.services.map((service) => <ServiceBlock key={service.id} service={service} taskDraft={taskDrafts[service.id] ?? ''} setTaskDraft={(value) => setTaskDrafts((current) => ({ ...current, [service.id]: value }))} onChange={updateService} onRemove={() => removeService(service)} onAddTask={(e) => addServiceTask(service, e)} />)}</div>
      {!event.services.length && <div className="empty-services">Добавьте первую услугу — EventFlow развернёт её рабочий чек-лист.</div>}
    </section>

    <section className="timeline-section">
      <div className="section-kicker"><History size={17} /><h2>Рабочие записи</h2><span>Дата и время добавятся автоматически</span></div>
      <form className="timeline-compose" onSubmit={addTimeline}><textarea value={timelineDraft} onChange={(e) => setTimelineDraft(e.target.value)} placeholder="Что произошло?" /><button className="primary-button">Добавить запись</button></form>
      <div className="timeline-list">{event.timeline.slice(0, showAllTimeline ? undefined : 8).map((entry) => <article key={entry.id}><time>{formatTimelineDate(entry.timestamp)}</time><div><p>{entry.text}</p>{entry.source === 'system' && <span>системная запись</span>}</div></article>)}</div>
      {event.timeline.length > 8 && <button className="show-more" onClick={() => setShowAllTimeline((value) => !value)}>{showAllTimeline ? 'Свернуть' : `Показать все записи (${event.timeline.length})`}</button>}
    </section>
  </main>
}

function NotebookField({ label, value, type = 'text', placeholder, onCommit }: { label: string; value: string; type?: string; placeholder?: string; onCommit: (value: string) => void }) {
  return <label className="notebook-field"><span>{label}</span><input key={value} type={type} defaultValue={value} placeholder={placeholder} onBlur={(e) => onCommit(e.target.value)} /></label>
}

function ServiceBlock({ service, taskDraft, setTaskDraft, onChange, onRemove, onAddTask }: { service: ServiceInstance; taskDraft: string; setTaskDraft: (value: string) => void; onChange: (service: ServiceInstance) => void; onRemove: () => void; onAddTask: (event: FormEvent) => void }) {
  const done = service.checklist.filter((item) => item.completed).length
  const finished = service.checklist.length > 0 && done === service.checklist.length
  const updateTask = (task: WorkChecklistItem) => onChange({ ...service, checklist: service.checklist.map((item) => item.id === task.id ? task : item) })
  return <details className={`service-block ${finished ? 'finished' : ''}`} open={!finished}>
    <summary><span><ChevronDown size={17} /><span><strong>{service.title}</strong><small>{service.providerName || serviceProviderLabel(service.type)}</small></span></span><span><b>{done}/{service.checklist.length}</b><i><em style={{ width: `${service.checklist.length ? done / service.checklist.length * 100 : 0}%` }} /></i></span></summary>
    <div className="service-content">
      <div className="service-fields"><NotebookField label={serviceProviderLabel(service.type)} value={service.providerName} placeholder="Добавить" onCommit={(value) => onChange({ ...service, providerName: value })} /><NotebookField label="Контакт" value={service.providerContact} placeholder="Телефон, email или ФИО" onCommit={(value) => onChange({ ...service, providerContact: value })} /></div>
      <div className="service-checklist">{service.checklist.map((task) => <div className={task.completed ? 'done' : ''} key={task.id}><button className={`notebook-checkbox ${task.completed ? 'checked' : ''}`} onClick={() => updateTask({ ...task, completed: !task.completed, completedAt: !task.completed ? new Date().toISOString() : null })}>{task.completed && <Check size={13} />}</button><input defaultValue={task.title} onBlur={(e) => updateTask({ ...task, title: e.target.value })} /><button className="quiet-icon" onClick={() => onChange({ ...service, checklist: service.checklist.filter((item) => item.id !== task.id) })} aria-label="Удалить пункт"><X size={14} /></button></div>)}</div>
      <form className="inline-add service-task-add" onSubmit={onAddTask}><input value={taskDraft} onChange={(e) => setTaskDraft(e.target.value)} placeholder="Добавить свой пункт…" /><button><Plus size={16} />Добавить</button></form>
      <label className="service-notes"><span>Комментарий</span><textarea key={service.notes} defaultValue={service.notes} onBlur={(e) => onChange({ ...service, notes: e.target.value })} placeholder="Свободная рабочая заметка" /></label>
      <button className="remove-service" onClick={onRemove}><Trash2 size={15} />Удалить услугу</button>
    </div>
  </details>
}
