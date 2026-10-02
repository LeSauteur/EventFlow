import { Clock3, CloudUpload, Download, KeyRound, Settings, Trash2, Upload, UserRound } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useRef, useState } from 'react'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import { useSync } from '../hooks/useSync.tsx'
import { useToast } from '../hooks/useToast.tsx'
import { createBackup, importBackup, validateBackup } from '../services/storage.ts'
import { markAllDataDirty } from '../services/sync.ts'
import type { AppSettings, BackupPayload } from '../types/index.ts'

const syncLabels = {
  local: 'Только локальное сохранение',
  dirty: 'Локально сохранено, ожидает отправки',
  syncing: 'Сохраняем в GitHub…',
  online: 'Локальная и онлайн-копии синхронизированы',
  error: 'Не удалось сохранить онлайн',
} as const

export function SettingsPage() {
  const { settings, updateSettings, reloadData } = useEventFlowData()
  const sync = useSync()
  const { showToast } = useToast()
  const [form, setForm] = useState<AppSettings>(settings)
  const [token, setToken] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const save = (e: FormEvent) => { e.preventDefault(); updateSettings(form); showToast('Настройки сохранены') }
  const saveToken = () => {
    if (!token.trim()) return
    sync.setToken(token)
    setToken('')
    showToast('GitHub token сохранён до закрытия вкладки')
  }
  const saveOnline = async () => {
    const saved = await sync.saveNow()
    showToast(saved ? 'Данные сохранены в GitHub' : 'Онлайн-сохранение не выполнено. Проверьте token и доступ к репозиторию')
  }
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
    setForm(next)
    updateSettings(next)
    showToast('Резервная копия экспортирована')
  }
  const importFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as BackupPayload
      if (!validateBackup(parsed)) { showToast('Файл не похож на резервную копию EventFlow'); return }
      if (!window.confirm('Импорт объединит текущие данные с резервной копией. Продолжить?')) return
      const imported = importBackup(parsed)
      markAllDataDirty(imported)
      reloadData()
      setForm(imported.settings)
      showToast('Резервная копия импортирована')
    } catch { showToast('Не удалось прочитать файл резервной копии') }
  }

  const lastSync = sync.lastOnlineSync
    ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(sync.lastOnlineSync))
    : 'Онлайн-сохранения ещё не было'

  return <main className="page narrow-page settings-page">
    <div className="page-toolbar"><div><h1>Настройки</h1><p>Локальное сохранение, синхронизация и резервные копии</p></div></div>
    <div className="settings-stack">
      <section className="card settings-card sync-settings-card">
        <div className="section-title"><div><CloudUpload className="section-blue" size={22} /><h2>Синхронизация между устройствами</h2></div></div>
        <div className={`sync-settings-status ${sync.status}`}><i /><div><strong>{syncLabels[sync.status]}</strong><span>{lastSync}</span></div></div>
        <p className="sync-explanation">Без токена EventFlow сохраняет изменения только в браузере этого устройства. Для работы на нескольких компьютерах добавьте GitHub token с доступом <b>Contents: Read and write</b> к репозиторию <b>LeSauteur/EventFlow</b>.</p>
        <label className="github-token-input"><span><KeyRound size={16} />GitHub token</span><input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder={sync.hasToken ? 'Token подключён для этой вкладки' : 'github_pat_…'} autoComplete="off" /></label>
        <div className="sync-settings-actions"><button className="secondary-button" onClick={saveToken} disabled={!token.trim()}><KeyRound size={16} />{sync.hasToken ? 'Обновить token' : 'Подключить token'}</button><button className="primary-button" onClick={() => void saveOnline()} disabled={!sync.hasToken || sync.status === 'syncing'}><CloudUpload size={17} />Сохранить в GitHub сейчас</button>{sync.hasToken && <button className="remove-token-button" onClick={sync.clearToken}><Trash2 size={15} />Удалить token</button>}</div>
        <div className="sync-howto"><strong>Как работать на другом устройстве</strong><ol><li>Откройте EventFlow — последняя онлайн-копия загрузится сама.</li><li>Чтобы сохранять изменения, вставьте тот же token здесь.</li><li>Сохраняйте кнопкой «Сохранить в GitHub» в левом меню. Также работает автосохранение каждые 15 секунд, пока вкладка открыта.</li></ol></div>
        <p className="settings-hint">Token хранится только в текущей сессии браузера, не попадает в резервную копию или файл синхронизации и удаляется после закрытия вкладки.</p>
      </section>

      <form className="card settings-card" onSubmit={save}>
        <div className="section-title"><div><UserRound className="section-blue" size={22} /><h2>Профиль и рабочий день</h2></div></div>
        <div className="form-grid"><label className="full-field"><span>Имя пользователя</span><input value={form.userName} onChange={(e) => setForm({ ...form, userName: e.target.value })} /></label><label><span>Начало рабочего дня</span><input type="time" value={form.workdayStart} onChange={(e) => setForm({ ...form, workdayStart: e.target.value })} /></label><label><span>Окончание рабочего дня</span><input type="time" value={form.workdayEnd} onChange={(e) => setForm({ ...form, workdayEnd: e.target.value })} /></label><label><span>Формат даты</span><select value={form.dateFormat} onChange={(e) => setForm({ ...form, dateFormat: e.target.value as AppSettings['dateFormat'] })}><option value="DD.MM.YYYY">17.09.2026</option><option value="D MMM YYYY">17 сентября 2026</option></select></label></div>
        <div className="form-actions"><button className="primary-button"><Settings size={17} />Сохранить настройки</button></div>
      </form>

      <section className="card settings-card">
        <div className="section-title"><div><Download className="section-blue" size={22} /><h2>Резервные копии</h2></div></div>
        <div className="backup-status"><Clock3 size={18} /><div><strong>Последняя резервная копия</strong><span>{form.lastBackupAt ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(form.lastBackupAt)) : 'Ещё не создавалась'}</span></div></div>
        <div className="data-action-grid"><button className="primary-button" onClick={exportBackup}><Download size={18} />Экспорт</button><button className="secondary-button" onClick={() => fileInput.current?.click()}><Upload size={18} />Импорт</button></div>
        <input ref={fileInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={importFile} />
        <p className="settings-hint">Резервная копия содержит мероприятия, рабочие блоки, чек-листы, ожидания, записи, шаблоны и настройки.</p>
      </section>
    </div>
  </main>
}
