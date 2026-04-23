/**
 * Barber Zac — Legit de Pagamento Generator
 * 
 * Generates the payment statement text in the exact format
 * used by the barbershop team in PT-BR.
 */

import { formatCurrencyBR, formatDateBR } from './periodUtils'

export interface LegitAdvanceItem {
  description: string
  total_amount: number
  carry_over_to_next_period: boolean
}

export interface LegitData {
  displayName: string
  periodStart: Date | string
  periodEnd: Date | string
  grossTotal: number
  commissionPercent: number
  barbershopShare: number
  barberShare: number
  advances: LegitAdvanceItem[]
  advancesTotal: number
  deferredTotal: number
  netPayable: number
  // Perfume commission data (additional source)
  perfumeGrossTotal?: number
  perfumeCommissionTotal?: number
  perfumeSalesCount?: number
}

/**
 * Generate the legit de pagamento text.
 * 
 * Example output:
 * 
 * Gulu
 * 
 * TOTAL BRUTO DO DIA 06/03 ao dia 18/03: 6.225,00
 * Porcentagem: 47%
 * Total barbearia %: 3.299,25
 * Total Barbeiro: 2.925,75
 * 
 * Pego: 500,00 / 2 Coca / 1 Redbull / Relógio 323,00 (mês q vem) = 1.172,00
 * A pagar: 1.753,75
 */
export function generateLegitText(data: LegitData): string {
  const startStr = formatDateBR(data.periodStart)
  const endStr = formatDateBR(data.periodEnd)
  const percentStr = Number.isInteger(data.commissionPercent)
    ? `${data.commissionPercent}%`
    : `${data.commissionPercent.toFixed(1).replace('.', ',')}%`

  const lines: string[] = []

  // Title
  lines.push(data.displayName)
  lines.push('')

  // Gross total
  lines.push(`TOTAL BRUTO DO DIA ${startStr} ao dia ${endStr}: ${formatCurrencyBR(data.grossTotal)}`)
  lines.push(`Porcentagem: ${percentStr}`)
  lines.push(`Total barbearia %: ${formatCurrencyBR(data.barbershopShare)}`)
  lines.push(`Total Barbeiro: ${formatCurrencyBR(data.barberShare)}`)
  lines.push('')

  // Perfume commissions section (if any)
  if (data.perfumeSalesCount && data.perfumeSalesCount > 0) {
    lines.push(`Comissão Perfumes: ${data.perfumeSalesCount} venda(s) — Bruto: ${formatCurrencyBR(data.perfumeGrossTotal || 0)} — Comissão: ${formatCurrencyBR(data.perfumeCommissionTotal || 0)}`)
    lines.push('')
  }

  // Pego (advances/deductions)
  if (data.advances.length > 0) {
    const advanceDescriptions = data.advances.map(a => {
      let desc = a.description
      if (a.carry_over_to_next_period) {
        desc += ' (mês q vem)'
      }
      return desc
    })

    const pegoLine = `Pego: ${advanceDescriptions.join(' / ')} = ${formatCurrencyBR(data.advancesTotal)}`
    lines.push(pegoLine)
  } else {
    lines.push('Pego: —')
  }

  // Net payable (includes perfume commission)
  lines.push(`A pagar: ${formatCurrencyBR(data.netPayable)}`)

  return lines.join('\n')
}
