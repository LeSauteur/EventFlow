import { Flag, Flame, Pin } from 'lucide-react'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import { toggleEventAttention } from '../services/eventAttention.ts'
import type { Event, EventAttention } from '../types/index.ts'

export const attentionLabels: Record<EventAttention, string> = { important: 'Важное', urgent: 'Срочное', hot: 'Горит', ready: 'Готово' }
function AttentionIcon({ flag }: { flag: EventAttention }) {
  return flag === 'hot' ? <Flame size={16} fill="currentColor" /> : <Flag size={15} fill="currentColor" />
}

export function EventMarks({ event }: { event: Event }) {
  return <span className="event-marks">
    {event.pinned && <span className="mark-pin" role="img" aria-label="Закреплено" title="Закреплено"><Pin size={14} /></span>}
    {(Object.entries(attentionLabels) as [EventAttention, string][]).filter(([flag]) => event.attentionFlags?.includes(flag)).map(([flag, label]) => <span key={flag} className={`mark-${flag}`} role="img" aria-label={label} title={label}><AttentionIcon flag={flag} /></span>)}
  </span>
}

export function EventFlags({ event }: { event: Event }) {
  const { updateEvent } = useEventFlowData()
  const flags = event.attentionFlags ?? []
  return <div className="event-flags" aria-label="Отметки мероприятия">
    <button type="button" className={event.pinned ? 'active flag-pin' : 'flag-pin'} aria-label="Закрепить мероприятие" aria-pressed={!!event.pinned} onClick={() => updateEvent({ ...event, pinned: !event.pinned })}><Pin size={14} />{event.pinned ? 'Закреплено' : 'Закрепить'}</button>
    {(Object.entries(attentionLabels) as [EventAttention, string][]).map(([flag, label]) => <button type="button" key={flag} className={`flag-${flag} ${flags.includes(flag) ? 'active' : ''}`} aria-pressed={flags.includes(flag)} onClick={() => updateEvent({ ...event, attentionFlags: toggleEventAttention(flags, flag) })}><AttentionIcon flag={flag} />{label}</button>)}
  </div>
}
