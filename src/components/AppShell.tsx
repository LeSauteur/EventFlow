import { Bell, CalendarPlus, CheckCircle, Cloud, CloudOff, CloudUpload, KeyRound, Menu, Search, Trash2, X } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { navigationItems } from '../data/navigation.ts'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import { useSync } from '../hooks/useSync.tsx'
import { Brand } from './Brand.tsx'

const eventColors = ['#17b979', '#1677f3', '#7447ea', '#f09b22']

function eventShortName(title: string) {
  return title.split('/').slice(0, 2).join(' ').trim() || title
}

function Sidebar({ open, close }: { open: boolean; close: () => void }) {
  const { events } = useEventFlowData()
  return <aside className={`sidebar notebook-sidebar ${open ? 'sidebar-open' : ''}`}>
    <div className="sidebar-mobile-head"><Brand /><button className="icon-button" onClick={close} aria-label="Закрыть меню"><X size={20} /></button></div>
    <nav aria-label="Основная навигация">{navigationItems.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={close} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={20} strokeWidth={1.8} /><span>{label}</span></NavLink>)}</nav>
    <div className="sidebar-divider" />
    <p className="sidebar-label">Мои мероприятия</p>
    <div className="sidebar-events">{events.slice(0, 4).map((event, index) => <Link key={event.id} to={`/events/${event.id}`} onClick={close}><span style={{ background: eventColors[index % eventColors.length] }} />{eventShortName(event.title)}</Link>)}</div>
    <Link className="sidebar-new-event" to="/events/new" onClick={close}><CalendarPlus size={17} />Новое мероприятие</Link>
    <div className="sidebar-note notebook-quote"><p>Больше,<br />чем мероприятия</p><span aria-hidden>♡</span></div>
  </aside>
}

function Topbar({ openMenu }: { openMenu: () => void }) {
  const navigate = useNavigate()
  const { settings, questions } = useEventFlowData()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); inputRef.current?.focus() } }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])
  const submit = (event: FormEvent) => { event.preventDefault(); navigate(query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : '/events') }
  const initials = settings.userName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  const notificationCount = questions.filter((question) => question.status !== 'resolved' && ['critical', 'high'].includes(question.priority)).length
  return <header className="topbar notebook-topbar"><button className="menu-button" onClick={openMenu} aria-label="Открыть меню"><Menu size={22} /></button><Brand /><form className="global-search" onSubmit={submit}><Search size={18} /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Глобальный поиск" placeholder="Поиск по мероприятиям, задачам, заметкам, контактам..." /><kbd>Ctrl + K</kbd></form><SyncControl /><button className="notification-button" aria-label={`Важные вопросы: ${notificationCount}`}><Bell size={21} />{notificationCount > 0 && <span />}</button><div className="profile"><span className="avatar">{initials || 'А'}</span><span><strong>{settings.userName}</strong><small>Event-менеджер</small></span></div></header>
}

const syncLabels = {
  local: 'Сохранено локально',
  dirty: 'Есть несохранённые изменения',
  syncing: 'Синхронизация…',
  online: 'Сохранено онлайн',
  error: 'Ошибка синхронизации',
} as const

function SyncControl() {
  const sync = useSync()
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState('')
  const Icon = sync.status === 'online' ? CheckCircle : sync.status === 'error' ? CloudOff : sync.status === 'syncing' ? CloudUpload : Cloud
  const lastSync = sync.lastOnlineSync ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(sync.lastOnlineSync)) : 'Ещё не было'
  const saveToken = () => { sync.setToken(token); setToken('') }
  return <div className="sync-control">
    <button className={`sync-status sync-${sync.status}`} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={syncLabels[sync.status]}><Icon size={18} /><span>{syncLabels[sync.status]}</span></button>
    {open && <div className="sync-popover">
      <div className="sync-popover-title"><Cloud size={18} /><div><strong>Общие данные</strong><span>Последняя sync: {lastSync}</span></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Закрыть"><X size={17} /></button></div>
      <p className={`sync-message sync-${sync.status}`}>{sync.error ?? syncLabels[sync.status]}</p>
      <button className="primary-button sync-now-button" onClick={() => void sync.saveNow()} disabled={sync.status === 'syncing'}><CloudUpload size={17} />Сохранить сейчас</button>
      <label className="sync-token-field"><span><KeyRound size={15} />GitHub token (только до закрытия вкладки)</span><input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder={sync.hasToken ? 'Токен сохранён в сессии' : 'github_pat_…'} autoComplete="off" /></label>
      <div className="sync-token-actions"><button className="secondary-button" onClick={saveToken} disabled={!token.trim()}>Сохранить token</button>{sync.hasToken && <button className="sync-clear-token" onClick={sync.clearToken}><Trash2 size={15} />Удалить</button>}</div>
      <small className="sync-help">Нужен fine-grained token с доступом Contents: Read and write к репозиторию EventFlow.</small>
    </div>}
  </div>
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  return <div className="app-shell"><Topbar openMenu={() => setMenuOpen(true)} /><Sidebar open={menuOpen} close={() => setMenuOpen(false)} />{menuOpen && <button className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-label="Закрыть меню" />}<div className="content-shell">{children}</div></div>
}
