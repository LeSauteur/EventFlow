import { Check } from 'lucide-react'
import { useEventFlowData } from '../hooks/useEventFlowData.tsx'
import type { RegistryTask } from '../services/taskRegistry.ts'
import { displayPlanningDate } from '../services/planningDates.ts'

/** Optional standalone tasks use the same compact notebook interaction. */
export function CompactTaskRow({ task }: { task: RegistryTask }) {
  const { updateTask } = useEventFlowData()
  return <div className={`compact-task-row ${task.status === 'done' ? 'done' : ''}`} data-task-key={task.key}>
    <button className={`notebook-checkbox ${task.status === 'done' ? 'checked' : ''}`} aria-label={`Выполнить: ${task.title}`} aria-pressed={task.status === 'done'} onClick={() => updateTask(task.key, { status: task.status === 'done' ? 'todo' : 'done' })}>{task.status === 'done' && <Check size={13} />}</button>
    <input key={task.title} defaultValue={task.title} aria-label="Текст отдельной задачи" onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== task.title) updateTask(task.key, { title: e.target.value.trim() }) }} />
    {task.deadline && <small>{displayPlanningDate(task.deadline, task.timeZone)}</small>}
  </div>
}
