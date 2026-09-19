import type { LucideIcon } from 'lucide-react'
import { CalendarDays, FileText, Home, Settings } from 'lucide-react'

export interface NavigationItem { to: string; label: string; icon: LucideIcon; end?: boolean }

export const navigationItems: NavigationItem[] = [
  { to: '/', label: 'Сегодня', icon: Home, end: true },
  { to: '/events', label: 'Мероприятия', icon: CalendarDays, end: true },
  { to: '/templates', label: 'Шаблоны', icon: FileText },
  { to: '/settings', label: 'Настройки', icon: Settings },
]

export const APP_ROUTES = navigationItems.map(({ to }) => to)
export const APPLICATION_ROUTES = [...APP_ROUTES, '/events/new', '/events/:id', '/contractors', '/budget', '/questions', '/documents', '/search']

export const placeholderContent: Record<string, { title: string; description: string }> = {
  '/documents': { title: 'Документы', description: 'Договоры, счета и файлы по мероприятиям.' },
}
