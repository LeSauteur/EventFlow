import type { EventBudget } from '../types/index.ts'

export interface BudgetSummary {
  subtotal: number
  serviceFee: number
  commission: number
  vat: number
  total: number
  perGuest: number
  remaining: number
  overage: number
  usagePercent: number
  availableForSupplier: number
  status: 'ok' | 'warning' | 'over'
}

export function calculateBudget(budget: EventBudget, guests: number): BudgetSummary {
  const subtotal = budget.baseCost + budget.venue + budget.catering + budget.equipment + budget.accommodation + budget.transfer + budget.other
  const serviceFee = subtotal * (budget.serviceFeePercent / 100)
  const commission = subtotal * (budget.commissionPercent / 100)
  const vat = (subtotal + serviceFee + commission) * (budget.vatPercent / 100)
  const total = subtotal + serviceFee + commission + vat
  const remaining = Math.max(0, budget.clientLimit - total)
  const overage = Math.max(0, total - budget.clientLimit)
  const usagePercent = budget.clientLimit > 0 ? Math.round((total / budget.clientLimit) * 100) : 0
  const knownWithoutCatering = subtotal - budget.catering + serviceFee + commission + vat
  const availableForSupplier = Math.max(0, budget.clientLimit - knownWithoutCatering)
  return { subtotal, serviceFee, commission, vat, total, perGuest: guests > 0 ? total / guests : 0, remaining, overage, usagePercent, availableForSupplier, status: overage > 0 ? 'over' : usagePercent >= 85 ? 'warning' : 'ok' }
}
