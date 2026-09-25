import { CalendarDays, MapPin, Users, WalletCards } from 'lucide-react'
import type { Event } from '../types/index.ts'
import { formatCurrency, formatDate } from '../utils/format.ts'
import { Link } from 'react-router-dom'

const thumbnailIcons: Record<string, string> = { Ужин: '🍽', Обед: '☕', Конференция: '◫', Тимбилдинг: '⛵', Логистика: '▣', Трансфер: '⇄', Кейтеринг: '◉', Проживание: '▥', 'Комплексное мероприятие': '◇' }

export function EventCard({ event }: { event: Event }) {
  return <Link className="event-card-link" to={`/events/${event.id}`}><article className="event-card"><div className={`event-thumb thumb-${event.id.slice(-1)}`}><span>{thumbnailIcons[event.type] ?? '◇'}</span></div><div className="event-card-body"><h3>{event.title}</h3><ul><li><CalendarDays size={14} />{formatDate(event.date)}</li><li><MapPin size={14} />{event.city}</li><li><Users size={14} />{event.guests} гостей</li><li><WalletCards size={14} />{formatCurrency(event.budget)}</li></ul><div className="progress-row"><div className="progress-track" aria-label={`Готовность ${event.progress}%`}><span style={{ width: `${event.progress}%` }} /></div><strong>{event.progress}%</strong></div><span className={`event-status status-${event.status.toLowerCase().replaceAll(' ', '-')}`}>{event.status}</span></div></article></Link>
}
