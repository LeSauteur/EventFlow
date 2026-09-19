import { Check, Clipboard, Copy, FileText, Mail, Plus, Save, Send, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import { useToast } from '../hooks/useToast.tsx'
import { checkTemplateCoverage, renderTemplate } from '../services/templateEngine.ts'
import type { MessageTemplate } from '../types/index.ts'
import { addDays, toDateKey } from '../utils/dates.ts'

const categories: MessageTemplate['category'][] = ['Работа с площадками', 'Коммуникации с клиентами', 'Документы и финансы', 'Логистика и трансфер', 'Служебные']

export function TemplatesPage() {
  const { events, contractors, budgets, templates, saveTemplate, logActivity } = useEventFlowData()
  const { showToast } = useToast()
  const [category, setCategory] = useState<MessageTemplate['category']>('Работа с площадками')
  const categoryTemplates = templates.filter((template) => template.category === category)
  const [templateId, setTemplateId] = useState(categoryTemplates[0]?.id ?? templates[0]?.id ?? '')
  const [eventId, setEventId] = useState(events[0]?.id ?? '')
  const [contractorId, setContractorId] = useState(contractors[0]?.id ?? '')
  const [deadline, setDeadline] = useState(toDateKey(addDays(new Date(), 2)))
  const template = templates.find((item) => item.id === templateId) ?? categoryTemplates[0] ?? templates[0]
  const event = events.find((item) => item.id === eventId)
  const contractor = contractors.find((item) => item.id === contractorId)
  const budget = budgets.find((item) => item.eventId === eventId)
  const context = useMemo(() => ({ event, contractor, budget, deadline }), [event, contractor, budget, deadline])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  useEffect(() => {
    if (!template) return
    setSubject(renderTemplate(template.subject, context))
    setBody(renderTemplate(template.body, context))
  }, [template?.id, eventId, contractorId, deadline])
  useEffect(() => {
    const first = templates.find((item) => item.category === category)
    if (first) setTemplateId(first.id)
  }, [category])

  if (!template) return <main className="page"><div className="card placeholder"><h2>Шаблоны не найдены</h2></div></main>
  const coverage = checkTemplateCoverage(template, body)
  const copyMessage = async () => {
    try { await navigator.clipboard.writeText(`${subject}\n\n${body}`); logActivity({ eventId, type: 'message', title: 'Сформировано сообщение', description: template.name }); showToast('Сообщение скопировано') } catch { showToast('Не удалось скопировать сообщение') }
  }
  const markSent = () => { logActivity({ eventId, type: 'message', title: 'Сообщение отмечено отправленным', description: template.name }); showToast('Отправка отмечена в истории') }
  const saveCustom = () => {
    const name = window.prompt('Название собственной версии', `${template.name} — моя версия`)
    if (!name?.trim()) return
    saveTemplate({ ...template, id: `template-${Date.now()}`, name: name.trim(), subject, body, custom: true, updatedAt: new Date().toISOString() })
    showToast('Собственная версия шаблона сохранена')
  }

  return <main className="page templates-page"><div className="page-toolbar"><div><h1>Шаблоны и сообщения</h1><p>Готовые письма и детерминированная проверка обязательных пунктов</p></div><button className="primary-button" onClick={saveCustom}><Plus size={18} />Сохранить как шаблон</button></div><div className="templates-layout"><aside className="card template-library"><h2>Категории</h2><nav>{categories.map((item) => <button className={category === item ? 'active' : ''} onClick={() => setCategory(item)} key={item}><FileText size={16} /><span>{item}</span><strong>{templates.filter((template) => template.category === item).length}</strong></button>)}</nav><h2>Шаблоны</h2><div className="template-list">{categoryTemplates.map((item) => <button className={template.id === item.id ? 'active' : ''} onClick={() => setTemplateId(item.id)} key={item.id}><Mail size={17} /><span><strong>{item.name}</strong><small>{item.custom ? 'Собственный шаблон' : item.subject}</small></span></button>)}</div></aside><section className="card template-editor-card"><div className="template-editor-head"><span><Mail size={22} /></span><div><h2>{template.name}</h2><p>{template.category}</p></div></div><div className="template-context-grid"><label><span>Мероприятие</span><select value={eventId} onChange={(e) => setEventId(e.target.value)}>{events.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label><label><span>Контрагент</span><select value={contractorId} onChange={(e) => setContractorId(e.target.value)}>{contractors.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label><span>Срок ответа</span><input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label></div><label className="template-field"><span>Тема письма</span><input value={subject} onChange={(e) => setSubject(e.target.value)} /></label><label className="template-field body-field"><span>Текст сообщения</span><textarea value={body} onChange={(e) => setBody(e.target.value)} /></label><div className="template-footer"><span>{body.length} символов</span><div><button className="secondary-button" onClick={copyMessage}><Copy size={17} />Копировать</button><button className="secondary-button" onClick={saveCustom}><Save size={17} />Сохранить версию</button><button className="primary-button" onClick={markSent}><Send size={17} />Отмечено отправленным</button></div></div></section><aside className="template-aside"><section className="card coverage-card"><div className="section-title"><div><Sparkles className="section-blue" size={21} /><h2>Проверка покрытия</h2></div></div><div className="coverage-list">{coverage.checks.map((item) => <div key={item.id} className={item.covered ? 'covered' : 'missing'}><span>{item.covered ? <Check size={15} /> : '!'}</span><strong>{item.label}</strong></div>)}</div><div className={`coverage-total ${coverage.covered === coverage.total ? 'complete' : ''}`}><Clipboard size={20} /><div><strong>Покрыто {coverage.covered}/{coverage.total || 0} критичных пунктов</strong><span>{coverage.total === 0 || coverage.covered === coverage.total ? 'Сообщение покрывает заданные требования' : 'Проверьте отмеченные пункты'}</span></div></div></section><section className="card template-params"><div className="section-title"><div><FileText className="section-blue" size={21} /><h2>Подставленные данные</h2></div></div><dl><div><dt>Дата</dt><dd>{event?.date ?? '—'}</dd></div><div><dt>Город</dt><dd>{event?.city ?? '—'}</dd></div><div><dt>Гости</dt><dd>{event?.guests ?? '—'}</dd></div><div><dt>Контрагент</dt><dd>{contractor?.name ?? '—'}</dd></div><div><dt>НДС</dt><dd>{contractor?.vatInfo || 'Не указан'}</dd></div></dl></section></aside></div></main>
}
