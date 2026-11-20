import { Check, Flame, SlidersHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import { displayPlanningDate, localDateTime, urgency, zonedDateTime } from '../services/planningDates.ts'
import { isClosed, type RegistryTask } from '../services/taskRegistry.ts'
import type { Priority, WorkTaskStatus } from '../types/index.ts'

export const priorityLabels: Record<Priority, string> = { low: 'Низкая', normal: 'Обычная', high: 'Важная', critical: 'Критичная' }
export const statusLabels: Record<WorkTaskStatus, string> = { todo: 'К выполнению', in_progress: 'В работе', waiting: 'Жду ответа', done: 'Готово', cancelled: 'Отменено' }
export function RegistryTaskRow({ task, context = true }: { task: RegistryTask; context?: boolean }) {
  const { updateTask } = useEventFlowData()
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState('')
  const edit = (patch: Parameters<typeof updateTask>[1]) => updateTask(task.key, patch)
  const state = isClosed(task) ? 'closed' : urgency(task.deadline, new Date(), task.timeZone)
  const exactTime = (value: string, field: 'deadline' | 'reminderAt') => {
    const iso = value ? zonedDateTime(value, task.timeZone) : null
    if (value && !iso) { setError('Такого местного времени нет. Выберите другое время.'); return }
    setError(''); edit({ [field]: iso })
  }
  return <article className={`registry-task ${isClosed(task) ? 'is-closed' : ''}`} data-task-key={task.key}>
    <div className="registry-task-main">
      <button className={`registry-check ${task.status === 'done' ? 'checked' : ''}`} aria-label={`${task.status === 'done' ? 'Вернуть задачу' : 'Выполнить задачу'}: ${task.title}`} onClick={() => edit({ status: task.status === 'done' ? 'todo' : 'done' })}>{task.status === 'done' && <Check size={15} />}</button>
      <div className="registry-task-content"><textarea rows={1} className="registry-title" key={task.title} defaultValue={task.title} aria-label="Название задачи" onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== task.title) edit({ title: e.target.value.trim() }) }} />
        {context && <small>{task.eventId ? <Link to={`/events/${task.eventId}?task=${encodeURIComponent(task.key)}`}>{task.eventTitle}</Link> : 'Без мероприятия'} · {task.sourceLabel}</small>}
        <div className="registry-badges">{task.manualHot && <span className="badge-hot">Горит вручную</span>}{state !== 'none' && state !== 'closed' && <span className={`badge-${state}`}>{state === 'overdue' ? 'Просрочено · ' : ''}{displayPlanningDate(task.deadline!, task.timeZone)}</span>}{!isClosed(task) && task.reminderAt && <span>Напомнить: {displayPlanningDate(task.reminderAt, task.timeZone)}</span>}{task.status === 'waiting' && task.waitingFor && <span>Жду: {task.waitingFor}</span>}{task.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
      </div>
      <button className={`registry-hot ${task.manualHot ? 'active' : ''}`} aria-label="Горит" aria-pressed={task.manualHot} title="Ручная отметка, независимо от срока" onClick={() => edit({ manualHot: !task.manualHot })}><Flame size={18} /></button>
      <button className="registry-expand" aria-label="Параметры задачи" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><SlidersHorizontal size={17} /></button>
    </div>
    <div className="registry-quick-controls">
      <label><span>Важность</span><select aria-label="Важность" value={task.priority} onChange={(e) => edit({ priority: e.target.value as Priority })}>{Object.entries(priorityLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
      <label><span>Срок</span><input aria-label="Срок задачи" type="date" value={task.deadline?.length === 10 ? task.deadline : task.deadline ? localDateTime(task.deadline, task.timeZone).slice(0, 10) : ''} onChange={(e) => edit({ deadline: e.target.value || null })} /></label>
      <label><span>Статус</span><select aria-label="Статус задачи" value={task.status} onChange={(e) => edit({ status: e.target.value as WorkTaskStatus })}>{Object.entries(statusLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
    </div>
    {expanded && <div className="registry-details">
      <label>Метки через запятую<input aria-label="Метки задачи" key={task.tags.join(',')} defaultValue={task.tags.join(', ')} onBlur={(e) => edit({ tags: [...new Set(e.target.value.split(',').map((v) => v.trim()).filter(Boolean))] })} /></label>
      <label>Часовой пояс<select aria-label="Часовой пояс задачи" value={task.timeZone} onChange={(e) => edit({ timeZone: e.target.value })}>{[...new Set([task.timeZone, 'Europe/Moscow', 'Europe/Kaliningrad', 'Europe/Samara', 'Asia/Yekaterinburg', 'Asia/Novosibirsk', 'Asia/Vladivostok', 'UTC'])].map((zone) => <option key={zone}>{zone}</option>)}</select></label>
      <label>Точный срок ({task.timeZone})<input aria-label="Точный срок" type="datetime-local" key={`due-${task.deadline}`} defaultValue={task.deadline ? localDateTime(task.deadline, task.timeZone) : ''} onBlur={(e) => { if (e.target.value) exactTime(e.target.value, 'deadline') }} /></label>
      <label>Напомнить / следующий контакт<input aria-label="Напоминание" type="datetime-local" key={`remind-${task.reminderAt}`} defaultValue={task.reminderAt ? localDateTime(task.reminderAt, task.timeZone) : ''} onBlur={(e) => exactTime(e.target.value, 'reminderAt')} /></label>
      <label>От кого ждём<input aria-label="От кого ждём" key={task.waitingFor} defaultValue={task.waitingFor ?? ''} onBlur={(e) => edit({ waitingFor: e.target.value })} /></label>
      <label>Ждём с<input aria-label="Ждём с" type="date" value={task.waitingSince ?? ''} onChange={(e) => edit({ waitingSince: e.target.value })} /></label>
      {error && <p role="alert">{error}</p>}
    </div>}
  </article>
}
