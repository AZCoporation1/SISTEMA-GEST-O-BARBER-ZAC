import type { InstallmentItem } from "./types"

/**
 * Generate installment schedule — pure helper, usable on client and server.
 * Distributes total across N installments with correct cent distribution.
 */
export function generateInstallmentSchedule(
  totalAmount: number,
  installments: number,
  firstDueDate: string,
  intervalDays: number = 30
): InstallmentItem[] {
  if (installments < 1) throw new Error("Parcelas devem ser >= 1")
  if (totalAmount <= 0) throw new Error("Valor total deve ser > 0")
  if (!firstDueDate) throw new Error("Data do primeiro vencimento obrigatória")

  const baseAmount = Math.floor((totalAmount / installments) * 100) / 100
  const remainder = Math.round((totalAmount - baseAmount * installments) * 100) / 100

  const schedule: InstallmentItem[] = []
  const firstDate = new Date(firstDueDate + "T12:00:00")

  for (let i = 0; i < installments; i++) {
    const dueDate = new Date(firstDate)
    dueDate.setDate(dueDate.getDate() + i * intervalDays)

    const amount = i === installments - 1
      ? Math.round((baseAmount + remainder) * 100) / 100
      : baseAmount

    schedule.push({
      installment_number: i + 1,
      total_installments: installments,
      amount,
      due_date: dueDate.toISOString().split("T")[0],
    })
  }

  // Safety: verify sum matches total
  const sum = schedule.reduce((a, s) => a + s.amount, 0)
  const diff = Math.round((totalAmount - sum) * 100) / 100
  if (diff !== 0 && schedule.length > 0) {
    schedule[schedule.length - 1].amount = Math.round((schedule[schedule.length - 1].amount + diff) * 100) / 100
  }

  return schedule
}
