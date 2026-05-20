/**
 * Barber Zac — Reception Ledger Service
 * Pure calculation — no mutations, no Supabase writes.
 * Calculates salary, advances, withdrawals, adjustments, net_payable.
 */

import type {
  ReceptionStaffRow,
  ReceptionAdvanceRow,
  ReceptionClosureRow,
  ReceptionLedgerSummary,
} from '../types'

/**
 * Calculate the ledger summary for a receptionist in a given period.
 *
 * @param staff - The reception staff member
 * @param advances - All advances for the period (including stock withdrawals)
 * @param draftClosure - Existing draft closure for the period (if any)
 * @returns Ledger summary with salary, deductions, net payable
 */
export function calculateReceptionLedger(
  staff: ReceptionStaffRow,
  advances: ReceptionAdvanceRow[],
  draftClosure: ReceptionClosureRow | null
): ReceptionLedgerSummary {
  // Salary: use draft closure salary if exists, otherwise base_salary_per_period
  const salaryAmount = draftClosure
    ? Number(draftClosure.salary_amount) || 0
    : Number(staff.base_salary_per_period) || 0

  const hasSalaryDefined = salaryAmount > 0

  // Only count active advances (not cancelled, not yet applied to another closure)
  const activeAdvances = advances.filter((a) => a.status === 'active')

  // Cash + PIX advances
  const cashAndPixAdvances = activeAdvances.filter(
    (a) => a.type === 'cash_advance' || a.type === 'pix_advance' || a.type === 'manual_deduction'
  )
  const advancesTotal = cashAndPixAdvances.reduce(
    (sum, a) => sum + Number(a.total_amount),
    0
  )

  // Stock withdrawals (uses sale price as deduction value)
  const stockWithdrawals = activeAdvances.filter(
    (a) => a.type === 'stock_withdrawal'
  )
  const stockWithdrawalsTotal = stockWithdrawals.reduce(
    (sum, a) => sum + Number(a.total_amount),
    0
  )

  // Adjustments (positive = credit to staff, negative = debit)
  // For now, adjustments come from the draft closure if it exists
  const adjustmentsTotal = draftClosure
    ? Number(draftClosure.adjustments_total) || 0
    : 0

  // Net payable = salary - advances - withdrawals + adjustments
  const totalDeductions = advancesTotal + stockWithdrawalsTotal
  const netPayable = salaryAmount - totalDeductions + adjustmentsTotal

  return {
    salaryAmount,
    hasSalaryDefined,
    advancesTotal,
    stockWithdrawalsTotal,
    adjustmentsTotal,
    netPayable,
    advancesCount: activeAdvances.length,
  }
}

/**
 * Generate the legit text for a closure.
 * This is the human-readable receipt text.
 */
export function generateReceptionLegitText(
  staff: ReceptionStaffRow,
  summary: ReceptionLedgerSummary,
  periodStart: string,
  periodEnd: string,
  advances: ReceptionAdvanceRow[]
): string {
  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const activeAdvances = advances.filter((a) => a.status === 'active')

  const lines: string[] = [
    '═══════════════════════════════════════',
    '       BARBER ZAC — RECEPÇÃO',
    '       FECHAMENTO DE PERÍODO',
    '═══════════════════════════════════════',
    '',
    `Recepcionista: ${staff.display_name}`,
    `Período: ${periodStart} a ${periodEnd}`,
    `Data: ${new Date().toLocaleDateString('pt-BR')}`,
    '',
    '───────────────────────────────────────',
    `Salário da Quinzena:     R$ ${fmt(summary.salaryAmount)}`,
    '───────────────────────────────────────',
  ]

  if (activeAdvances.length > 0) {
    lines.push('')
    lines.push('DESCONTOS:')

    const cashPix = activeAdvances.filter(
      (a) => a.type !== 'stock_withdrawal'
    )
    if (cashPix.length > 0) {
      lines.push('')
      lines.push('  Adiantamentos/Pegos:')
      for (const a of cashPix) {
        lines.push(`    • ${a.description} — R$ ${fmt(Number(a.total_amount))}`)
      }
      lines.push(`    Subtotal: R$ ${fmt(summary.advancesTotal)}`)
    }

    const stock = activeAdvances.filter(
      (a) => a.type === 'stock_withdrawal'
    )
    if (stock.length > 0) {
      lines.push('')
      lines.push('  Retiradas de Estoque:')
      for (const a of stock) {
        lines.push(
          `    • ${a.description} (${a.quantity}x R$ ${fmt(Number(a.unit_amount))}) — R$ ${fmt(Number(a.total_amount))}`
        )
      }
      lines.push(`    Subtotal: R$ ${fmt(summary.stockWithdrawalsTotal)}`)
    }
  }

  if (summary.adjustmentsTotal !== 0) {
    lines.push('')
    lines.push(`Ajustes:                 R$ ${fmt(summary.adjustmentsTotal)}`)
  }

  lines.push('')
  lines.push('═══════════════════════════════════════')
  lines.push(`TOTAL A PAGAR:           R$ ${fmt(summary.netPayable)}`)
  lines.push('═══════════════════════════════════════')

  return lines.join('\n')
}
