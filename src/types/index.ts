export type EventStatus = 'В работе' | 'Согласование' | 'В подготовке'
export type TaskStatus = 'Просрочено' | 'Сегодня' | 'Ожидаем'
export type RiskSeverity = 'Высокий' | 'Средний'
export type ChecklistCategory = 'general' | 'venue' | 'catering' | 'equipment' | 'logistics' | 'accommodation' | 'documents'
export type ChecklistStatus = 'todo' | 'in_progress' | 'waiting' | 'done' | 'overdue' | 'not_applicable'
export type Priority = 'low' | 'normal' | 'high' | 'critical'
export type QuestionStatus = 'open' | 'waiting_external' | 'waiting_client' | 'resolved'
export type ContractorType = 'Отель' | 'Ресторан' | 'Площадка' | 'Трансфер' | 'Кейтеринг' | 'Оборудование' | 'Подрядчик' | 'Другое'

export interface Event {
  id: string
  title: string
  client: string
  city: string
  date: string
  guests: number
  budget: number
  type: string
  status: EventStatus
  progress: number
  contractorId?: string
  createdAt?: string
  updatedAt?: string
}

export interface ChecklistItem {
  id: string
  eventId: string
  category: ChecklistCategory
  title: string
  description: string
  status: ChecklistStatus
  priority: Priority
  deadline: string | null
  completedAt: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

export interface OpenQuestion {
  id: string
  eventId: string
  title: string
  description: string
  responsibleParty: string
  deadline: string | null
  priority: Priority
  status: QuestionStatus
  createdAt: string
  resolvedAt: string | null
}

export interface Task {
  id: string
  eventId: string
  eventName: string
  title: string
  deadline: string
  status: TaskStatus
  priority: 'Критичный' | 'Высокий'
}

export interface Risk {
  id: string
  eventId: string
  title: string
  severity: RiskSeverity
  description: string
}

export interface Activity {
  id: string
  eventId: string
  type: 'budget' | 'document' | 'message' | 'note' | 'status' | 'event' | 'checklist' | 'question' | 'contractor' | 'backup'
  title: string
  description: string
  timestamp: string
  entityId?: string
  amount?: number
  fileName?: string
}

export interface EventBudget {
  eventId: string
  clientLimit: number
  baseCost: number
  venue: number
  catering: number
  equipment: number
  accommodation: number
  transfer: number
  other: number
  serviceFeePercent: number
  commissionPercent: number
  vatPercent: number
  comment: string
  updatedAt: string
}

export interface Contractor {
  id: string
  name: string
  type: ContractorType
  city: string
  contactPerson: string
  phone: string
  email: string
  legalEntity: string
  vatInfo: string
  serviceFee: string
  paymentTerms: string
  cancellationTerms: string
  notes: string
  lastVerifiedAt: string
}

export interface TemplateTopic {
  id: string
  label: string
  patterns: string[]
}

export interface MessageTemplate {
  id: string
  name: string
  category: 'Работа с площадками' | 'Коммуникации с клиентами' | 'Документы и финансы' | 'Логистика и трансфер' | 'Служебные'
  subject: string
  body: string
  requiredTopics: string[]
  custom: boolean
  updatedAt: string
}

export interface AppSettings {
  userName: string
  workdayStart: string
  workdayEnd: string
  dateFormat: 'DD.MM.YYYY' | 'D MMM YYYY'
  lastBackupAt: string | null
}

export interface BackupPayload {
  format: 'eventflow-backup'
  schemaVersion: string
  exportedAt: string
  data: {
    events: Event[]
    checklistItems: ChecklistItem[]
    questions: OpenQuestion[]
    contractors: Contractor[]
    templates: MessageTemplate[]
    budgets: EventBudget[]
    activities: Activity[]
    tasks: Task[]
    settings: AppSettings
  }
}

export interface DashboardStats {
  activeEvents: number
  criticalQuestions: number
  awaitingResponse: number
  thisWeek: number
}
