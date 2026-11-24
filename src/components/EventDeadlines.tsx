import { CalendarClock, Check, Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import { usePlanningClock } from '../hooks/usePlanningClock.ts'
import { eventDeadlineTasks, nearestEventDeadline } from '../services/eventDeadlines.ts'
import { dateDay, displayPlanningDate, urgency, validDate } from '../services/planningDates.ts'
import { isClosed, taskKey, type RegistryTask } from '../services/taskRegistry.ts'
import type { Event } from '../types/index.ts'

export function EventDeadlineSummary({ eventId }: { eventId: string }) {
  const data = useEventFlowData(), now = usePlanningClock()
  const task = nearestEventDeadline(data, eventId)
  if (!task) return null
  const state = urgency(task.deadline, now, task.timeZone)
  return <Link className={`event-deadline-summary deadline-${state}`} to={`/events/${eventId}?task=${encodeURIComponent(task.key)}`}>
    <CalendarClock size={16} /><span><b>{state === 'overdue' ? 'Просрочено' : 'Ближайший срок'} · {displayPlanningDate(task.deadline!, task.timeZone)}</b><span>{task.title}</span></span>
  </Link>
}

export function EventDeadlines({ event }: { event: Event }) {
  const data = useEventFlowData()
  const [adding, setAdding] = useState(false)
  const [showDeadlines, setShowDeadlines] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [cleared, setCleared] = useState<{ key: string; deadline: string } | null>(null)
  const zone = event.nextStepTask?.timeZone ?? event.timeZone ?? data.settings.timeZone ?? 'Europe/Moscow'
  const deadline = event.nextStepTask?.deadline
  const done = event.nextStepTask?.taskStatus === 'done'
  const key = taskKey('next', event.id, 'next-step')
  const changeNextDate = (value: string) => data.updateEvent({ ...event, nextStepTask: { ...event.nextStepTask, deadline: value || null, updatedAt: new Date().toISOString() } })
  const setDeadline = (taskKey: string, value: string) => taskKey === key ? changeNextDate(value) : data.updateTask(taskKey, { deadline: value || null })
  const clearDate = (taskKey: string, value: string) => {
    setCleared({ key: taskKey, deadline: value })
    setDeadline(taskKey, '')
  }
  const tasks = eventDeadlineTasks(data, event.id).filter((task) => task.source !== 'next' && task.status !== 'cancelled')
  const create = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !date) return
    const now = new Date().toISOString()
    data.addChecklistItem({ id: crypto.randomUUID(), eventId: event.id, title: title.trim(), deadline: date, description: '', category: 'general', status: 'todo', priority: 'normal', completedAt: null, notes: '', createdAt: now, updatedAt: now })
    setTitle(''); setDate(''); setAdding(false); setShowDeadlines(true)
  }
  return <div className="event-deadlines">
    <div className="next-step-deadline">
      <label><span>Сделать до</span><input aria-label="Сделать до" type="date" value={validDate(deadline) ? dateDay(deadline!, zone) : ''} onChange={(e) => changeNextDate(e.target.value)} /></label>
      {deadline && <><button type="button" className={done ? 'deadline-done' : ''} aria-label="Выполнить следующий шаг" aria-pressed={done} onClick={() => data.updateTask(key, { status: done ? 'todo' : 'done' })}><Check size={15} />{done ? 'Выполнено' : 'Готово'}</button><button type="button" className="deadline-clear" aria-label="Очистить срок следующего шага" title="Убрать только срок" onClick={() => clearDate(key, deadline)}><X size={15} /></button></>}
    </div>
    <small className="deadline-hint">{deadline && deadline.length > 10 ? `Точный срок: ${displayPlanningDate(deadline, zone)}. ` : ''}{done ? 'Выполненный шаг убран из календаря.' : 'Срок появится в календаре отдельно от дат мероприятия.'}</small>
    {tasks.length > 0 && <details className="additional-deadlines" open={showDeadlines} onToggle={(e) => setShowDeadlines(e.currentTarget.open)}><summary>Другие рабочие сроки · {tasks.filter((task) => !isClosed(task)).length}</summary>
      {tasks.filter((task) => !isClosed(task)).map((task) => <DeadlineTaskRow key={task.key} task={task} onClear={() => clearDate(task.key, task.deadline!)} />)}
      {tasks.some((task) => task.status === 'done') && <details className="completed-deadlines"><summary>Выполненные сроки · {tasks.filter((task) => task.status === 'done').length}</summary>{tasks.filter((task) => task.status === 'done').map((task) => <DeadlineTaskRow key={task.key} task={task} onClear={() => clearDate(task.key, task.deadline!)} />)}</details>}
    </details>}
    {cleared && <button type="button" className="notebook-undo" onClick={() => { setDeadline(cleared.key, cleared.deadline); setCleared(null) }}>Вернуть очищенный срок</button>}
    <button type="button" className="add-deadline-button" aria-expanded={adding} onClick={() => setAdding(!adding)}><Plus size={15} />Добавить срок</button>
    {adding && <form className="deadline-compose" onSubmit={create}><input aria-label="Действие для дополнительного срока" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Что нужно сделать?" required /><input aria-label="Дата дополнительного срока" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /><button type="submit" disabled={!title.trim() || !date}>Добавить</button></form>}
  </div>
}

function DeadlineTaskRow({ task, onClear }: { task: RegistryTask; onClear: () => void }) {
  const { updateTask } = useEventFlowData()
  return <div className={`event-deadline-row ${task.status === 'done' ? 'is-done' : ''}`} data-task-key={task.key}>
    <button type="button" className="deadline-check" aria-label={`Выполнить срок: ${task.title}`} aria-pressed={task.status === 'done'} onClick={() => updateTask(task.key, { status: task.status === 'done' ? 'todo' : 'done' })}><Check size={15} /></button>
    <input aria-label="Название действия со сроком" key={task.title} defaultValue={task.title} onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== task.title) updateTask(task.key, { title: e.target.value.trim() }) }} />
    <input aria-label={`Сделать до: ${task.title}`} type="date" value={dateDay(task.deadline!, task.timeZone)} onChange={(e) => e.target.value ? updateTask(task.key, { deadline: e.target.value }) : onClear()} />
    <button type="button" className="deadline-clear" aria-label={`Очистить срок: ${task.title}`} title="Убрать только срок" onClick={onClear}><X size={15} /></button>
    {task.deadline!.length > 10 && <small className="deadline-exact">{displayPlanningDate(task.deadline!, task.timeZone)}</small>}
  </div>
}
