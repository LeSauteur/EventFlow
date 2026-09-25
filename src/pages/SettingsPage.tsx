import { Clock3, Download, RefreshCcw, Settings, Upload, UserRound } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useRef, useState } from 'react'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import { useToast } from '../hooks/useToast.tsx'
import { createBackup, importBackup, loadAll, resetToDemo, validateBackup } from '../services/storage.ts'
import { markAllDataDirty, markDeleted, SHARED_COLLECTIONS } from '../services/sync.ts'
import type { AppSettings, BackupPayload } from '../types/index.ts'

export function SettingsPage() {
  const { settings, updateSettings, reloadData } = useEventFlowData()
  const { showToast } = useToast()
  const [form, setForm] = useState<AppSettings>(settings)
  const fileInput = useRef<HTMLInputElement>(null)

  const save = (e: FormEvent) => { e.preventDefault(); updateSettings(form); showToast('Настройки сохранены') }
  const exportBackup = () => {
    const backup = createBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `eventflow-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    const next = { ...form, lastBackupAt: new Date().toISOString() }
    setForm(next); updateSettings(next); showToast('Резервная копия экспортирована')
  }
  const importFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as BackupPayload
      if (!validateBackup(parsed)) { showToast('Файл не похож на резервную копию EventFlow'); return }
      if (!window.confirm('Импорт объединит текущие данные с резервной копией. Продолжить?')) return
      const imported = importBackup(parsed); markAllDataDirty(imported); reloadData(); setForm(imported.settings); showToast('Резервная копия импортирована и добавлена в очередь sync')
    } catch { showToast('Не удалось прочитать файл резервной копии') }
  }
  const reset = () => {
    if (!window.confirm('Восстановить первоначальные demo data? Текущие локальные изменения будут заменены.')) return
    const previous = loadAll()
    const next = resetToDemo()
    const now = new Date().toISOString()
    for (const collection of SHARED_COLLECTIONS) {
      const idOf = (item: Record<string, unknown>) => String(collection === 'budgets' ? item.eventId ?? '' : item.id ?? '')
      const retained = new Set(next[collection].map((item) => idOf(item as unknown as Record<string, unknown>)))
      for (const item of previous[collection]) {
        const id = idOf(item as unknown as Record<string, unknown>)
        if (id && !retained.has(id)) markDeleted(collection, id, undefined, now)
      }
    }
    markAllDataDirty(next, undefined, now); reloadData(); setForm(next.settings); showToast('Demo data восстановлены')
  }

  return <main className="page narrow-page"><div className="page-toolbar"><div><h1>Настройки</h1><p>Локальные параметры EventFlow и управление данными</p></div></div><div className="settings-stack"><form className="card settings-card" onSubmit={save}><div className="section-title"><div><UserRound className="section-blue" size={22} /><h2>Профиль и рабочий день</h2></div></div><div className="form-grid"><label className="full-field"><span>Имя пользователя</span><input value={form.userName} onChange={(e) => setForm({ ...form, userName: e.target.value })} /></label><label><span>Начало рабочего дня</span><input type="time" value={form.workdayStart} onChange={(e) => setForm({ ...form, workdayStart: e.target.value })} /></label><label><span>Окончание рабочего дня</span><input type="time" value={form.workdayEnd} onChange={(e) => setForm({ ...form, workdayEnd: e.target.value })} /></label><label><span>Формат даты</span><select value={form.dateFormat} onChange={(e) => setForm({ ...form, dateFormat: e.target.value as AppSettings['dateFormat'] })}><option value="DD.MM.YYYY">17.09.2026</option><option value="D MMM YYYY">17 сентября 2026</option></select></label></div><div className="form-actions"><button className="primary-button"><Settings size={17} />Сохранить настройки</button></div></form><section className="card settings-card"><div className="section-title"><div><Download className="section-blue" size={22} /><h2>Данные и резервные копии</h2></div></div><div className="backup-status"><Clock3 size={18} /><div><strong>Последняя резервная копия</strong><span>{form.lastBackupAt ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(form.lastBackupAt)) : 'Ещё не создавалась'}</span></div></div><div className="data-action-grid"><button className="primary-button" onClick={exportBackup}><Download size={18} />Экспорт резервной копии</button><button className="secondary-button" onClick={() => fileInput.current?.click()}><Upload size={18} />Импорт резервной копии</button><button className="danger-button" onClick={reset}><RefreshCcw size={18} />Восстановить demo data</button></div><input ref={fileInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={importFile} /><p className="settings-hint">Резервная копия содержит мероприятия, чек-листы, вопросы, риски, контрагентов, шаблоны, бюджеты, историю и настройки. Файл остаётся только на вашем компьютере.</p></section></div></main>
}
