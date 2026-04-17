/**
 * Barber Zac — Fortnight Period Utilities
 * 
 * Business rules:
 * - Payment dates: day 05 and day 20
 * - Period A: day 21 of previous month → day 05 of current month
 * - Period B: day 06 → day 20 of current month
 */

export interface FortnightPeriod {
  start: Date
  end: Date
  paymentDate: Date
  label: string
}

/**
 * Get the current fortnight period based on today's date.
 */
export function getCurrentFortnightPeriod(refDate?: Date): FortnightPeriod {
  const today = refDate || new Date()
  const day = today.getDate()
  const month = today.getMonth()
  const year = today.getFullYear()

  if (day <= 5) {
    // Period A: 21 of previous month → 05 of current month
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    return {
      start: new Date(prevYear, prevMonth, 21),
      end: new Date(year, month, 5),
      paymentDate: new Date(year, month, 5),
      label: `21/${String(prevMonth + 1).padStart(2, '0')} ao dia 05/${String(month + 1).padStart(2, '0')}`
    }
  } else if (day <= 20) {
    // Period B: 06 → 20 of current month
    return {
      start: new Date(year, month, 6),
      end: new Date(year, month, 20),
      paymentDate: new Date(year, month, 20),
      label: `06/${String(month + 1).padStart(2, '0')} ao dia 20/${String(month + 1).padStart(2, '0')}`
    }
  } else {
    // Period A of next cycle: 21 of current month → 05 of next month
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    return {
      start: new Date(year, month, 21),
      end: new Date(nextYear, nextMonth, 5),
      paymentDate: new Date(nextYear, nextMonth, 5),
      label: `21/${String(month + 1).padStart(2, '0')} ao dia 05/${String(nextMonth + 1).padStart(2, '0')}`
    }
  }
}

/**
 * Get the next fortnight period after the current one.
 */
export function getNextFortnightPeriod(refDate?: Date): FortnightPeriod {
  const current = getCurrentFortnightPeriod(refDate)
  const nextDay = new Date(current.end)
  nextDay.setDate(nextDay.getDate() + 1)
  return getCurrentFortnightPeriod(nextDay)
}

/**
 * Get available periods for selection (last 6 periods).
 */
export function getRecentPeriods(count: number = 6): FortnightPeriod[] {
  const periods: FortnightPeriod[] = []
  let ref = new Date()

  for (let i = 0; i < count; i++) {
    const period = getCurrentFortnightPeriod(ref)
    periods.push(period)
    // Go back to the day before the period start
    ref = new Date(period.start)
    ref.setDate(ref.getDate() - 1)
  }

  return periods
}

/**
 * Format currency in pt-BR style: 1.234,56
 */
export function formatCurrencyBR(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Format date as dd/MM
 */
export function formatDateBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Format full date as dd/MM/yyyy
 */
export function formatFullDateBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

/**
 * Convert a FortnightPeriod to ISO date strings for DB queries.
 */
export function periodToISO(period: FortnightPeriod) {
  return {
    start: period.start.toISOString(),
    end: new Date(period.end.getFullYear(), period.end.getMonth(), period.end.getDate(), 23, 59, 59, 999).toISOString(),
  }
}
