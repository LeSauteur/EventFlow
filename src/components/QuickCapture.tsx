import { CheckSquare2, ContactRound, FileText, MessageCircle, NotebookPen, Sparkles, WalletCards } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import { useToast } from '../hooks/useToast.tsx'
import { parseQuickCapture } from '../services/quickCapture.ts'
import type { ChecklistItem, Contractor } from '../types/index.ts'
import { toDateKey } from '../utils/dates.ts'

type CaptureKind = 'task' | 'note' | 'money' | 'contact' | 'document' | 'message'

const kinds: { value: CaptureKind; label: string; icon: typeof CheckSquare2 }[] = [
  { value: 'task', label: 'Задача', icon: CheckSquare2 },
  { value: 'note', label: 'Заметка', icon: NotebookPen },
  { value: 'money', label: 'Деньги', icon: WalletCards },
  { value: 'contact', label: 'Контакт', icon: ContactRound },
  { value: 'document', label: 'Документ', icon: FileText },
  { value: 'message', label: 'Сообщение', icon: MessageCircle },
]

export function QuickCapture({ eventId, title = 'Быстрая запись', compact = false }: { eventId?: string; title?: string; compact?: boolean }) {
  const data = useEventFlowData()
  const { showToast } = useToast()
  const [selectedEventId, setSelectedEventId] = useState(eventId ?? data.events[0]?.id ?? '')
  const [text, setText] = useState('')
  const [kind, setKind] = useState<CaptureKind>('note')
  const [confirmed, setConfirmed] = useState<string[]>([])
  const selected = data.events.find((event) => event.id === (eventId ?? selectedEventId))
  const suggestions = useMemo(() => parseQuickCapture(text).filter((item) => !confirmed.includes(item.id)), [text, confirmed])

  const addTask = (taskTitle: string, deadline: string | null = null) => {
    if (!selected) return
    const now = new Date().toISOString()
    const item: ChecklistItem = { id: `capture-task-${Date.now()}`, eventId: selected.id, category: 'general', title: taskTitle, description: '', status: 'todo', priority: 'normal', deadline, completedAt: null, notes: 'Добавлено через быструю запись', createdAt: now, updatedAt: now }
    data.addChecklistItem(item)
  }

  const addMoney = (amount: number, description: string) => {
    if (!selected) return
    data.addExpense(selected.id, amount, description)
  }

  const save = (targetKind = kind) => {
    const value = text.trim()
    if (!value || !selected) return
    const entityId = `capture-${Date.now()}`
    if (targetKind === 'task') addTask(value)
    if (targetKind === 'money') {
      const amount = Number(value.replace(/[^\d]/g, ''))
      if (!amount) { showToast('Укажите сумму цифрами'); return }
      addMoney(amount, value)
    }
    if (targetKind === 'contact') {
      const contractor: Contractor = { id: entityId, name: value, type: 'Другое', city: selected.city, contactPerson: value, phone: '', email: '', legalEntity: '', vatInfo: '', serviceFee: '', paymentTerms: '', cancellationTerms: '', notes: 'Добавлено через быструю запись', lastVerifiedAt: toDateKey(new Date()) }
      data.saveContractor(contractor)
      data.updateEvent({ ...selected, contractorId: contractor.id })
      data.logActivity({ eventId: selected.id, type: 'contractor', entityId: contractor.id, title: 'Добавлен контакт', description: value })
    }
    if (targetKind === 'document') data.logActivity({ eventId: selected.id, type: 'document', entityId, fileName: value, title: 'Добавлен документ', description: value })
    if (targetKind === 'message') data.logActivity({ eventId: selected.id, type: 'message', entityId, title: 'Зафиксировано сообщение', description: value })
    if (targetKind === 'note') data.logActivity({ eventId: selected.id, type: 'note', entityId, title: 'Заметка', description: value })
    setText(''); setConfirmed([]); showToast('Запись сохранена')
  }

  const confirmSuggestion = (id: string) => {
    const suggestion = suggestions.find((item) => item.id === id)
    if (!suggestion || !selected) return
    if (suggestion.kind === 'money' && suggestion.amount) addMoney(suggestion.amount, text.trim())
    if (suggestion.kind === 'task') addTask(suggestion.title, suggestion.deadline ?? null)
    setConfirmed((items) => [...items, id])
    showToast(suggestion.kind === 'money' ? 'Сумма добавлена в бюджет' : 'Задача создана')
  }

  return <section className={`card quick-capture ${compact ? 'compact' : ''}`}>
    <div className="quick-capture-title"><Sparkles size={19} /><h2>{title}</h2>{!eventId && <select aria-label="Мероприятие для записи" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>{data.events.map((event) => <option value={event.id} key={event.id}>{event.title}</option>)}</select>}</div>
    <textarea value={text} onChange={(e) => { setText(e.target.value); setConfirmed([]) }} placeholder="Что произошло или что нужно сделать?" aria-label="Текст быстрой записи" />
    <div className="capture-kinds">{kinds.map(({ value, label, icon: Icon }) => <button key={value} type="button" className={kind === value ? 'active' : ''} onClick={() => setKind(value)}><Icon size={17} />{label}</button>)}</div>
    <button className="capture-save" type="button" disabled={!text.trim()} onClick={() => save()}>Сохранить как «{kinds.find((item) => item.value === kind)?.label}»</button>
    {suggestions.length > 0 && <div className="smart-suggestions"><div className="suggestions-head"><Sparkles size={16} /><strong>Умный разбор заметки</strong><span>без AI</span></div>{suggestions.map((suggestion) => <div className="suggestion-row" key={suggestion.id}><span className={`suggestion-icon ${suggestion.kind}`} >{suggestion.kind === 'money' ? <WalletCards size={17} /> : <CheckSquare2 size={17} />}</span><div><strong>{suggestion.title}</strong><small>{suggestion.detail}</small></div><button type="button" onClick={() => confirmSuggestion(suggestion.id)}>{suggestion.kind === 'money' ? 'Добавить в бюджет' : 'Создать задачу'}</button></div>)}</div>}
  </section>
}
