import { Pin } from 'lucide-react'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import type { Event, EventAttention } from '../types/index.ts'

export const attentionLabels: Record<EventAttention, string> = { important: 'Важное', urgent: 'Срочное', hot: 'Горит' }
export function EventFlags({ event }: { event: Event }) {
  const { updateEvent } = useEventFlowData()
  const flags = event.attentionFlags ?? []
  return <div className="event-flags" aria-label="Отметки мероприятия">
    <button type="button" className={event.pinned ? 'active flag-pin' : 'flag-pin'} aria-label="Закрепить мероприятие" aria-pressed={!!event.pinned} onClick={() => updateEvent({ ...event, pinned: !event.pinned })}><Pin size={14} />{event.pinned ? 'Закреплено' : 'Закрепить'}</button>
    {(Object.entries(attentionLabels) as [EventAttention, string][]).map(([flag, label]) => <button type="button" key={flag} className={`flag-${flag} ${flags.includes(flag) ? 'active' : ''}`} aria-pressed={flags.includes(flag)} onClick={() => updateEvent({ ...event, attentionFlags: flags.includes(flag) ? flags.filter((value) => value !== flag) : [...flags, flag] })}>{label}</button>)}
  </div>
}
