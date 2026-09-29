import { ArrowLeft, CalendarPlus, Check, Save } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createNotebookEvent, createServiceInstance, SERVICE_PRESETS } from '../config/servicePresets.ts'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import { useToast } from '../hooks/useToast.tsx'
import type { ServiceType } from '../types/index.ts'

const initialForm = { title: '', dateFrom: '', dateTo: '', sector: '', city: '', company: '', initiator: '', participants: '' }

export function NewEventPage() {
  const [form, setForm] = useState(initialForm)
  const [services, setServices] = useState<ServiceType[]>([])
  const { addEvent } = useEventFlowData()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const update = (name: keyof typeof form, value: string) => setForm((current) => ({ ...current, [name]: value }))
  const toggleService = (type: ServiceType) => setServices((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const id = `event-${Date.now()}`
    const created = createNotebookEvent({
      id, title: form.title.trim(), dateFrom: form.dateFrom, dateTo: form.dateTo || form.dateFrom,
      sector: form.sector.trim(), city: form.city.trim(), company: form.company.trim(), client: form.company.trim(),
      initiator: form.initiator.trim(), participants: Number(form.participants), guests: Number(form.participants),
      stage: 'WORKING', status: 'В работе', type: form.sector.trim() || 'Мероприятие', nextStep: '',
    })
    created.services = services.map((type) => createServiceInstance(id, type))
    created.timeline = [{ id: `timeline-${Date.now()}`, eventId: id, text: 'Создана рабочая страница мероприятия', timestamp: new Date().toISOString(), source: 'system' }]
    addEvent(created)
    showToast('Мероприятие создано')
    navigate(`/events/${id}`)
  }

  return <main className="new-event-page">
    <button className="back-button" onClick={() => navigate('/events')}><ArrowLeft size={17} />Назад</button>
    <header><span><CalendarPlus size={24} /></span><div><h1>Новое мероприятие</h1><p>Только основное — рабочие блоки появятся автоматически.</p></div></header>
    <form onSubmit={submit}>
      <section className="notebook-form-section">
        <h2>Паспорт</h2>
        <div className="notebook-form-grid">
          <label className="wide"><span>Название</span><input required value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Например, Янсен Москва" autoFocus /></label>
          <label><span>Дата начала</span><input required type="date" value={form.dateFrom} onChange={(event) => update('dateFrom', event.target.value)} /></label>
          <label><span>Дата окончания</span><input type="date" min={form.dateFrom} value={form.dateTo} onChange={(event) => update('dateTo', event.target.value)} /></label>
          <label><span>Сектор</span><input value={form.sector} onChange={(event) => update('sector', event.target.value)} placeholder="Медтех" /></label>
          <label><span>Город</span><input required value={form.city} onChange={(event) => update('city', event.target.value)} placeholder="Москва" /></label>
          <label><span>Заказчик / компания</span><input value={form.company} onChange={(event) => update('company', event.target.value)} placeholder="Johnson & Johnson" /></label>
          <label><span>Инициатор / контакт</span><input value={form.initiator} onChange={(event) => update('initiator', event.target.value)} placeholder="ФИО" /></label>
          <label><span>Количество участников</span><input type="number" min="0" value={form.participants} onChange={(event) => update('participants', event.target.value)} placeholder="0" /></label>
        </div>
      </section>

      <section className="notebook-form-section">
        <div className="form-section-heading"><div><h2>Услуги</h2><p>Выберите всё, что нужно вести в рамках мероприятия.</p></div><span>{services.length ? `Выбрано: ${services.length}` : 'Не выбраны'}</span></div>
        <div className="service-picker">
          {SERVICE_PRESETS.filter((preset) => preset.type !== 'custom').map((preset) => <button type="button" key={preset.type} className={services.includes(preset.type) ? 'selected' : ''} onClick={() => toggleService(preset.type)}><span className="service-check">{services.includes(preset.type) && <Check size={14} />}</span>{preset.title}</button>)}
        </div>
      </section>

      <div className="new-event-actions"><button type="button" className="secondary-button" onClick={() => navigate('/events')}>Отмена</button><button className="primary-button"><Save size={17} />Создать мероприятие</button></div>
    </form>
  </main>
}
