import { useState, type FormEvent } from 'react'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
export function TaskComposer({ eventId, deadline = null }: { eventId?: string; deadline?: string | null }) {
  const data = useEventFlowData()
  const [title, setTitle] = useState('')
  const [selected, setSelected] = useState(eventId ?? '')
  const create = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const now = new Date().toISOString()
    data.addChecklistItem({ id: crypto.randomUUID(), eventId: eventId ?? selected, title: title.trim(), description: '', category: 'general', status: 'todo', priority: 'normal', deadline, completedAt: null, notes: '', createdAt: now, updatedAt: now })
    setTitle('')
  }
  return <form className="task-composer" onSubmit={create}><input aria-label="Новая задача" placeholder="Что нужно сделать?" value={title} onChange={(e) => setTitle(e.target.value)} />{!eventId && <select aria-label="Мероприятие новой задачи" value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Без мероприятия</option>{data.events.filter((e) => e.stage !== 'ARCHIVE').map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select>}<button className="primary-button" disabled={!title.trim()}>Добавить задачу</button></form>
}
