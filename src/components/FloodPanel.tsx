import { useState } from 'react'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import { useToast } from '../hooks/useToast.tsx'
import type { FloodEntry } from '../types/index.ts'

const labels = { new: 'Новое', processed: 'Разобрано', archive: 'Архив', deleted: 'Корзина' }
const makeEntry = (text: string, eventId?: string): FloodEntry => ({ id: crypto.randomUUID(), text, eventId: eventId || null, status: 'new', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })

/** Each paste starts its own record. Further typing edits that record, never another. */
export function FloodComposer({ eventId }: { eventId?: string }) {
  const { saveFloodEntries, floodEntries } = useEventFlowData()
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = floodEntries.find((entry) => entry.id === activeId)
  const text = active?.text ?? ''
  const edit = (value: string, separate = false) => {
    if (!value && !active) return
    const entry = separate || !active ? makeEntry(value, eventId) : { ...active, text: value, updatedAt: new Date().toISOString() }
    setActiveId(entry.id)
    saveFloodEntries([entry])
  }
  return <div className="flood-composer"><label><strong>Флуд · быстрый ввод</strong><textarea aria-label="Новая запись Флуда" value={text} onChange={(e) => edit(e.target.value)} onPaste={(e) => { const pasted = e.clipboardData.getData('text/plain'); if (pasted) { e.preventDefault(); edit(pasted, true) } }} placeholder="Вставьте письмо, сообщение или напишите мысль. Мероприятие можно выбрать позже." /></label><div className="flood-actions"><small aria-live="polite">{active ? 'Сохранено · каждая новая вставка создаёт отдельную запись' : 'Текст сохраняется при вводе'}</small><button type="button" className="secondary-button" onClick={() => setActiveId(null)}>Новая запись</button></div></div>
}

export function FloodPanel({ eventId }: { eventId?: string }) {
  const data = useEventFlowData(), { showToast } = useToast()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('active')
  const [unassigned, setUnassigned] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [undo, setUndo] = useState<FloodEntry[]>([])
  const [fragment, setFragment] = useState<{ id: string; text: string } | null>(null)
  const [copyFallback, setCopyFallback] = useState('')
  const change = (entries: FloodEntry[]) => data.saveFloodEntries(entries.map((e) => ({ ...e, updatedAt: new Date().toISOString() })))
  const entries = data.floodEntries.filter((e) => (!eventId || e.eventId === eventId) && (!unassigned || !e.eventId) && (status === 'active' ? e.status !== 'deleted' && e.status !== 'archive' : status === 'all' ? e.status !== 'deleted' : e.status === status) && e.text.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru'))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const remove = (items: FloodEntry[]) => {
    if (!items.length || !window.confirm(`Переместить ${items.length} записей в корзину? Их можно восстановить.`)) return
    setUndo(items)
    change(items.map((e) => ({ ...e, previousStatus: e.status === 'deleted' ? e.previousStatus ?? 'new' : e.status, status: 'deleted' })))
    setSelected([])
  }
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); showToast('Скопировано') } catch { setCopyFallback(text) }
  }
  const createTask = (entry: FloodEntry) => {
    if (!fragment || fragment.id !== entry.id || !window.confirm(`Создать задачу из выделенного фрагмента?\n\n${fragment.text.slice(0, 240)}`)) return
    const now = new Date().toISOString()
    data.addChecklistItem({ id: crypto.randomUUID(), eventId: entry.eventId ?? '', title: fragment.text, description: '', category: 'general', status: 'todo', priority: 'normal', deadline: null, completedAt: null, notes: `Создано вручную из Флуда ${entry.id}`, createdAt: now, updatedAt: now })
    setFragment(null); showToast('Задача создана. Исходная запись сохранена.')
  }
  return <section className="flood-panel">
    <FloodComposer eventId={eventId} />
    <div className="planning-card flood-filters"><input aria-label="Поиск во Флуде" placeholder="Поиск по записям" value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Статус записей Флуда" value={status} onChange={(e) => { setStatus(e.target.value); setSelected([]) }}><option value="active">Входящие</option><option value="all">Все</option>{Object.entries(labels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select>{!eventId && <label className="planning-checkbox"><input type="checkbox" checked={unassigned} onChange={(e) => setUnassigned(e.target.checked)} />Без мероприятия</label>}
      <button onClick={() => setSelected(entries.map((e) => e.id))}>Выбрать все</button><button disabled={!selected.length} onClick={() => remove(entries.filter((e) => selected.includes(e.id) && e.status !== 'deleted'))}>Удалить выбранные ({selected.length})</button><button onClick={() => remove(entries.filter((e) => e.status === 'processed'))}>Очистить разобранное</button>
    </div>
    {undo.length > 0 && <div className="planning-card flood-actions" role="status"><span>Удаление или очистку можно отменить.</span><button onClick={() => { change(undo); setUndo([]) }}>Отменить</button></div>}
    {copyFallback && <div className="planning-card"><label>Скопируйте текст вручную<textarea aria-label="Текст для копирования" readOnly value={copyFallback} onFocus={(e) => e.target.select()} /></label><button onClick={() => setCopyFallback('')}>Закрыть</button></div>}
    {!entries.length && <p className="planning-empty">Записей по этим условиям нет. Вставьте первый фрагмент выше.</p>}
    {entries.map((entry) => <article className="planning-card flood-entry" key={entry.id}>
      <header className="flood-actions"><label className="planning-checkbox"><input aria-label="Выбрать запись" type="checkbox" checked={selected.includes(entry.id)} onChange={() => setSelected(selected.includes(entry.id) ? selected.filter((id) => id !== entry.id) : [...selected, entry.id])} /><time>{new Intl.DateTimeFormat('ru', { dateStyle: 'short', timeStyle: 'short', timeZone: data.settings.timeZone ?? 'Europe/Moscow' }).format(new Date(entry.createdAt))}</time></label><span>{labels[entry.status]}</span></header>
      <textarea aria-label="Текст записи Флуда" value={entry.text} onChange={(e) => change([{ ...entry, text: e.target.value }])} onSelect={(e) => { const input = e.currentTarget; setFragment({ id: entry.id, text: input.value.slice(input.selectionStart, input.selectionEnd).trim() }) }} />
      <div className="flood-actions"><label>Мероприятие<select aria-label="Привязка записи к мероприятию" value={entry.eventId ?? ''} onChange={(e) => change([{ ...entry, eventId: e.target.value || null }])}><option value="">Без мероприятия</option>{data.events.map((e) => <option value={e.id} key={e.id}>{e.title}</option>)}</select></label><label>Обработка<select aria-label="Обработка записи" value={entry.status} onChange={(e) => change([{ ...entry, status: e.target.value as FloodEntry['status'] }])}>{Object.entries(labels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label></div>
      <footer className="flood-actions"><button onClick={() => void copy(entry.text)}>Копировать</button><button disabled={fragment?.id !== entry.id || !fragment.text} onClick={() => createTask(entry)}>Выделение → задача</button>{entry.status === 'deleted' ? <button onClick={() => change([{ ...entry, status: entry.previousStatus ?? 'new' }])}>Восстановить</button> : <button onClick={() => remove([entry])}>В корзину</button>}<button onClick={() => { if (window.confirm('Полностью очистить текст этой записи? Можно отменить.')) { setUndo([entry]); change([{ ...entry, text: '' }]) } }}>Очистить текст</button></footer>
    </article>)}
  </section>
}
