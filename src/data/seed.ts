import type { Activity, DashboardStats, Event, Risk, Task } from '../types/index.ts'
import { importedOneNoteEvents } from './importedOneNote.ts'

export const dashboardStats: DashboardStats = { activeEvents: importedOneNoteEvents.filter((event) => event.stage !== 'ARCHIVE').length, criticalQuestions: 0, awaitingResponse: importedOneNoteEvents.reduce((sum, event) => sum + event.waitingItems.filter((item) => !item.completed).length, 0), thisWeek: 0 }

export const seedEvents: Event[] = importedOneNoteEvents

export const seedTasks: Task[] = []
export const seedRisks: Risk[] = []
export const seedActivities: Activity[] = []
export const attentionTasks = seedTasks
