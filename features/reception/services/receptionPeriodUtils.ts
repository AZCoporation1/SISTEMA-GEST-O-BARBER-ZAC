/**
 * Barber Zac — Reception Period Utilities
 *
 * Reception uses days 23 and 6 (different from professionals who use 5 and 20).
 *
 * Periods:
 *   Quinzena A: day 23 → day 05 of next month  (payment day 06)
 *   Quinzena B: day 06 → day 22 of same month  (payment day 23)
 *
 * Example:
 *   23/05 → 05/06 | pays day 06/06
 *   06/06 → 22/06 | pays day 23/06
 */

import type { ReceptionPeriod } from '../types'

export type { ReceptionPeriod }

/**
 * Get the current reception period based on today's date.
 * primaryDay = 23, secondaryDay = 6
 */
export function getCurrentReceptionPeriod(
  primaryDay: number = 23,
  secondaryDay: number = 6,
  refDate?: Date
): ReceptionPeriod {
  const today = refDate || new Date()
  const day = today.getDate()
  const month = today.getMonth()
  const year = today.getFullYear()

  if (day >= primaryDay) {
    // Quinzena A: day 23 of this month → day 05 of next month
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    const end = new Date(nextYear, nextMonth, secondaryDay - 1) // day 5
    const paymentDate = new Date(nextYear, nextMonth, secondaryDay) // day 6

    return {
      start: new Date(year, month, primaryDay),
      end,
      paymentDate,
      label: `${primaryDay}/${String(month + 1).padStart(2, '0')} a ${String(secondaryDay - 1).padStart(2, '0')}/${String(nextMonth + 1).padStart(2, '0')}`,
    }
  } else if (day >= secondaryDay) {
    // Quinzena B: day 06 → day 22 of same month
    return {
      start: new Date(year, month, secondaryDay),
      end: new Date(year, month, primaryDay - 1), // day 22
      paymentDate: new Date(year, month, primaryDay), // day 23
      label: `${String(secondaryDay).padStart(2, '0')}/${String(month + 1).padStart(2, '0')} a ${String(primaryDay - 1).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}`,
    }
  } else {
    // day < 6: still in Quinzena A that started on day 23 of previous month
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    const end = new Date(year, month, secondaryDay - 1) // day 5
    const paymentDate = new Date(year, month, secondaryDay) // day 6

    return {
      start: new Date(prevYear, prevMonth, primaryDay),
      end,
      paymentDate,
      label: `${primaryDay}/${String(prevMonth + 1).padStart(2, '0')} a ${String(secondaryDay - 1).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}`,
    }
  }
}

/**
 * Get the next reception period after the current one.
 */
export function getNextReceptionPeriod(
  primaryDay: number = 23,
  secondaryDay: number = 6,
  refDate?: Date
): ReceptionPeriod {
  const current = getCurrentReceptionPeriod(primaryDay, secondaryDay, refDate)
  const nextDay = new Date(current.end)
  nextDay.setDate(nextDay.getDate() + 1)
  return getCurrentReceptionPeriod(primaryDay, secondaryDay, nextDay)
}

/**
 * Get recent periods for the period selector (last 8 periods).
 */
export function getRecentReceptionPeriods(
  count: number = 8,
  primaryDay: number = 23,
  secondaryDay: number = 6
): ReceptionPeriod[] {
  const periods: ReceptionPeriod[] = []
  let ref = new Date()

  for (let i = 0; i < count; i++) {
    const period = getCurrentReceptionPeriod(primaryDay, secondaryDay, ref)
    periods.push(period)
    // Go back to the day before the period start
    ref = new Date(period.start)
    ref.setDate(ref.getDate() - 1)
  }

  return periods
}

/**
 * Convert period to ISO strings for DB queries.
 */
export function receptionPeriodToISO(period: ReceptionPeriod) {
  return {
    start: period.start.toISOString().split('T')[0], // date only (YYYY-MM-DD)
    end: period.end.toISOString().split('T')[0],
  }
}

/**
 * Format period compact: "23/05 a 05/06"
 */
export function formatReceptionPeriodCompact(period: ReceptionPeriod): string {
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  return `${fmt(period.start)} a ${fmt(period.end)}`
}

/**
 * Format currency pt-BR
 */
export function formatCurrencyBR(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Format date dd/MM
 */
export function formatDateBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Format full date dd/MM/yyyy
 */
export function formatFullDateBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}
