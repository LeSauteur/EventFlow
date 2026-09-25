import { CalendarPlus, Save, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import { useToast } from '../hooks/useToast.tsx'
import type { Event } from '../types/index.ts'

const eventTypes = ['Корпоративное мероприятие', 'Конференция', 'Тимбилдинг', 'Логистика', 'Трансфер', 'Кейтеринг', 'Проживание', 'Комплексное мероприятие']
const initialForm = { title: '', client: '', city: '', date: '', guests: '', budget: '', type: 'Корпоративное мероприятие' }

export function NewEventPage() {
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const { addEvent } = useEventFlowData()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const update = (name: keyof typeof form, value: string) => setForm((current) => ({ ...current, [name]: value }))
  const submit = (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true)
    const newEvent: Event = { id: `event-${Date.now()}`, title: form.title.trim(), client: form.client.trim(), city: form.city.trim(), date: form.date, guests: Number(form.guests), budget: Number(form.budget), type: form.type, status: 'В подготовке', progress: 10 }
    addEvent(newEvent); showToast('Мероприятие создано и сохранено локально'); navigate('/events')
  }
  return <main className="page narrow-page"><div className="page-toolbar"><div><h1>Новое мероприятие</h1><p>Основная информация для новой рабочей карточки</p></div></div><form className="card event-form" onSubmit={submit}><div className="form-intro"><span><CalendarPlus size={24} /></span><div><h2>Данные мероприятия</h2><p>После создания EventFlow автоматически подготовит чек-лист и бюджет.</p></div></div><div className="form-grid"><label className="full-field"><span>Название мероприятия</span><input required value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="Например, J&J / Иваново" /></label><label><span>Клиент</span><input required value={form.client} onChange={(e) => update('client', e.target.value)} placeholder="Название компании" /></label><label><span>Город</span><input required value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Город проведения" /></label><label><span>Дата</span><input required type="date" value={form.date} onChange={(e) => update('date', e.target.value)} /></label><label><span>Количество гостей <small>(необязательно)</small></span><input type="number" min="1" value={form.guests} onChange={(e) => update('guests', e.target.value)} placeholder="Не указано" /></label><label><span>Бюджет, ₽ <small>(необязательно)</small></span><input type="number" min="0" step="1000" value={form.budget} onChange={(e) => update('budget', e.target.value)} placeholder="Не указано" /></label><label><span>Тип мероприятия</span><select value={form.type} onChange={(e) => update('type', e.target.value)}>{eventTypes.map((type) => <option key={type}>{type}</option>)}</select></label></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => navigate('/events')}><X size={18} />Отмена</button><button type="submit" className="primary-button" disabled={submitting}><Save size={18} />Создать мероприятие</button></div></form></main>
}
