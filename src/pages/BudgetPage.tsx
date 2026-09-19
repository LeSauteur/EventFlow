import { Calculator, CircleDollarSign, Save, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import { useToast } from '../hooks/useToast.tsx'
import { calculateBudget } from '../services/budget.ts'
import type { EventBudget } from '../types/index.ts'
import { formatCurrency } from '../utils/format.ts'

const moneyFields: { key: keyof EventBudget; label: string }[] = [
  { key: 'baseCost', label: 'Базовая стоимость' }, { key: 'venue', label: 'Аренда' }, { key: 'catering', label: 'Питание' },
  { key: 'equipment', label: 'Оборудование' }, { key: 'accommodation', label: 'Проживание' }, { key: 'transfer', label: 'Трансфер' }, { key: 'other', label: 'Прочее' },
]

export function BudgetPage() {
  const { events, budgets, saveBudget } = useEventFlowData()
  const { showToast } = useToast()
  const requestedEvent = new URLSearchParams(window.location.search).get('event')
  const [eventId, setEventId] = useState(requestedEvent && events.some((event) => event.id === requestedEvent) ? requestedEvent : events[0]?.id ?? '')
  const event = events.find((item) => item.id === eventId)
  const storedBudget = budgets.find((item) => item.eventId === eventId)
  const fallback: EventBudget = { eventId, clientLimit: event?.budget ?? 0, baseCost: 0, venue: 0, catering: 0, equipment: 0, accommodation: 0, transfer: 0, other: 0, serviceFeePercent: 0, commissionPercent: 0, vatPercent: 0, comment: '', updatedAt: new Date().toISOString() }
  const [budget, setBudget] = useState<EventBudget>(storedBudget ?? fallback)
  useEffect(() => { setBudget(budgets.find((item) => item.eventId === eventId) ?? { ...fallback, eventId, clientLimit: event?.budget ?? 0 }) }, [eventId])
  const summary = useMemo(() => calculateBudget(budget, event?.guests ?? 0), [budget, event?.guests])
  const setNumber = (key: keyof EventBudget, value: string) => setBudget((current) => ({ ...current, [key]: Number(value) || 0 }))
  const save = () => { saveBudget({ ...budget, updatedAt: new Date().toISOString() }); showToast('Бюджет сохранён локально') }

  return <main className="page"><div className="page-toolbar"><div><h1>Бюджет</h1><p>Расчёт лимита, расходов и стоимости на человека</p></div><button className="primary-button" onClick={save}><Save size={18} />Сохранить расчёт</button></div><section className="card budget-event-select"><label><span>Мероприятие</span><select value={eventId} onChange={(e) => setEventId(e.target.value)}>{events.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label><div><Users size={18} /><span>{event?.guests ?? 0} гостей</span></div></section><div className="budget-page-grid"><section className="card budget-form-card"><div className="section-title"><div><Calculator className="section-blue" size={22} /><h2>Параметры расчёта</h2></div></div><div className="budget-input-grid"><label className="limit-field"><span>Общий лимит клиента</span><input type="number" min="0" value={budget.clientLimit} onChange={(e) => setNumber('clientLimit', e.target.value)} /></label>{moneyFields.map((field) => <label key={field.key}><span>{field.label}</span><input type="number" min="0" value={budget[field.key] as number} onChange={(e) => setNumber(field.key, e.target.value)} /></label>)}<label><span>Сервисный сбор, %</span><input type="number" min="0" value={budget.serviceFeePercent} onChange={(e) => setNumber('serviceFeePercent', e.target.value)} /></label><label><span>Комиссия, %</span><input type="number" min="0" value={budget.commissionPercent} onChange={(e) => setNumber('commissionPercent', e.target.value)} /></label><label><span>НДС, %</span><input type="number" min="0" value={budget.vatPercent} onChange={(e) => setNumber('vatPercent', e.target.value)} /></label><label className="budget-comment"><span>Комментарий</span><textarea value={budget.comment} onChange={(e) => setBudget({ ...budget, comment: e.target.value })} placeholder="Условия расчёта и допущения" /></label></div></section><aside className="budget-results"><section className={`card budget-health-card health-${summary.status}`}><div className="budget-health-icon">{summary.status === 'over' ? <TrendingUp size={25} /> : <TrendingDown size={25} />}</div><div><span>{summary.status === 'over' ? 'Лимит превышен' : summary.status === 'warning' ? 'Близко к лимиту' : 'Укладываемся в лимит'}</span><strong>{summary.status === 'over' ? `+${formatCurrency(summary.overage)}` : formatCurrency(summary.remaining)}</strong></div></section><section className="card result-breakdown"><div className="section-title"><div><CircleDollarSign className="section-blue" size={22} /><h2>Итог</h2></div></div><dl><div><dt>Сумма расходов</dt><dd>{formatCurrency(summary.subtotal)}</dd></div><div><dt>Сервисный сбор</dt><dd>{formatCurrency(summary.serviceFee)}</dd></div><div><dt>Комиссия</dt><dd>{formatCurrency(summary.commission)}</dd></div><div><dt>НДС</dt><dd>{formatCurrency(summary.vat)}</dd></div><div className="total-line"><dt>Расчётный итог</dt><dd>{formatCurrency(summary.total)}</dd></div><div><dt>Стоимость на человека</dt><dd>{formatCurrency(summary.perGuest)}</dd></div></dl><div className="budget-usage"><div><span>Использовано лимита</span><strong>{summary.usagePercent}%</strong></div><div className="progress-track"><span style={{ width: `${Math.min(summary.usagePercent, 100)}%` }} /></div></div></section><section className="card available-card"><span>Лимит → доступно на меню / поставщика</span><strong>{formatCurrency(summary.availableForSupplier)}</strong><small>После учёта известных обязательных расходов</small></section></aside></div></main>
}
