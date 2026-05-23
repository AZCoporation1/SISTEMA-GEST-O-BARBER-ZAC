// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { logAudit } from "@/features/audit/actions/audit.actions"
import { resolveUserProfileId } from "@/lib/supabase/resolve-user"
import { revalidatePath } from "next/cache"
import type { InstallmentItem } from "../types"
import { generateInstallmentSchedule } from "../helpers"

// ══════════════════════════════════════════════════════════
// CREATE RECEIVABLES FOR A SALE
// ══════════════════════════════════════════════════════════

export async function createReceivablesForSale(params: {
  saleId: string
  customerId: string | null
  customerNameSnapshot: string | null
  customerPhoneSnapshot: string | null
  professionalId: string | null
  paymentOrigin: 'credit_card_installment' | 'store_credit' | 'mixed_payment'
  totalReceivable: number
  installments: number
  firstDueDate: string
  notes: string | null
  description: string
}) {
  const supabase = await createServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

  // Anti-duplicate: check if sale already has active receivables
  const { data: existing } = await supabase
    .from("accounts_receivable")
    .select("id")
    .eq("sale_id", params.saleId)
    .in("status", ["open", "partial", "paid"])
    .limit(1)

  if (existing && existing.length > 0) {
    return { success: false, error: "Esta venda já possui parcelas ativas em A Receber." }
  }

  const schedule = generateInstallmentSchedule(
    params.totalReceivable,
    params.installments,
    params.firstDueDate
  )

  const rows = schedule.map((s) => ({
    sale_id: params.saleId,
    customer_id: params.customerId,
    customer_name_snapshot: params.customerNameSnapshot,
    customer_phone_snapshot: params.customerPhoneSnapshot,
    professional_id: params.professionalId,
    source_type: "sale" as const,
    payment_origin: params.paymentOrigin,
    installment_number: s.installment_number,
    total_installments: s.total_installments,
    amount: s.amount,
    amount_paid: 0,
    due_date: s.due_date,
    status: "open" as const,
    description: params.description || `Parcela ${s.installment_number}/${s.total_installments}`,
    notes: params.notes,
    created_by: userProfileId,
  }))

  const { data: inserted, error } = await supabase
    .from("accounts_receivable")
    .insert(rows)
    .select("id")

  if (error) {
    console.error("Failed to create receivables:", error)
    return { success: false, error: "Erro ao criar parcelas: " + error.message }
  }

  await logAudit({
    action: "create_receivables",
    entity: "accounts_receivable",
    entity_id: params.saleId,
    newData: { count: schedule.length, total: params.totalReceivable, origin: params.paymentOrigin },
    observation: `${schedule.length} parcelas criadas para venda. Total A Receber: R$ ${params.totalReceivable.toFixed(2)}`,
  })

  revalidatePath("/a-receber")
  return { success: true, data: inserted }
}

// ══════════════════════════════════════════════════════════
// GET ACCOUNTS RECEIVABLE (with filters)
// ══════════════════════════════════════════════════════════

export async function getAccountsReceivable(filters: {
  page?: number
  perPage?: number
  status?: string
  customerId?: string
  professionalId?: string
  startDate?: string
  endDate?: string
  search?: string
}) {
  const supabase = await createServerClient()
  const page = filters.page || 1
  const perPage = filters.perPage || 20

  let query = supabase
    .from("accounts_receivable")
    .select(`
      *,
      customer:customer_id (full_name, phone, mobile_phone),
      professional:professional_id (name)
    `, { count: "exact" })

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status)
  }
  if (filters.customerId) {
    query = query.eq("customer_id", filters.customerId)
  }
  if (filters.professionalId) {
    query = query.eq("professional_id", filters.professionalId)
  }
  if (filters.startDate) {
    query = query.gte("due_date", filters.startDate)
  }
  if (filters.endDate) {
    query = query.lte("due_date", filters.endDate)
  }
  if (filters.search) {
    query = query.or(`customer_name_snapshot.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
  }

  const from = (page - 1) * perPage
  const to = from + perPage - 1
  query = query.range(from, to).order("due_date", { ascending: true })

  const { data, error, count } = await query

  if (error) {
    console.error("Error fetching receivables:", error)
    return { success: false, error: error.message, data: [], count: 0 }
  }

  return { success: true, data: data || [], count: count || 0 }
}

// ══════════════════════════════════════════════════════════
// GET RECEIVABLE SUMMARY (KPIs)
// ══════════════════════════════════════════════════════════

export async function getReceivableSummary() {
  const supabase = await createServerClient()
  const today = new Date().toISOString().split("T")[0]
  const monthStart = today.substring(0, 7) + "-01"

  // Total open amount
  const { data: openData } = await supabase
    .from("accounts_receivable")
    .select("amount, amount_paid")
    .in("status", ["open", "partial", "overdue"])

  const totalOpen = (openData || []).reduce((sum, r) => sum + (Number(r.amount) - Number(r.amount_paid)), 0)

  // Overdue
  const { data: overdueData } = await supabase
    .from("accounts_receivable")
    .select("amount, amount_paid")
    .in("status", ["open", "partial"])
    .lt("due_date", today)

  const totalOverdue = (overdueData || []).reduce((sum, r) => sum + (Number(r.amount) - Number(r.amount_paid)), 0)

  // Due today
  const { data: dueTodayData } = await supabase
    .from("accounts_receivable")
    .select("amount, amount_paid")
    .in("status", ["open", "partial"])
    .eq("due_date", today)

  const dueTodayCount = dueTodayData?.length || 0
  const dueTodayAmount = (dueTodayData || []).reduce((sum, r) => sum + (Number(r.amount) - Number(r.amount_paid)), 0)

  // Received this month
  const { data: receivedData } = await supabase
    .from("accounts_receivable_payments")
    .select("amount")
    .eq("status", "active")
    .gte("paid_at", monthStart)

  const receivedThisMonth = (receivedData || []).reduce((sum, r) => sum + Number(r.amount), 0)

  // Total receivables count
  const { count: totalReceivables } = await supabase
    .from("accounts_receivable")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "partial", "overdue"])

  return {
    success: true,
    data: {
      totalOpen,
      totalOverdue,
      dueTodayCount,
      dueTodayAmount,
      receivedThisMonth,
      totalReceivables: totalReceivables || 0,
    },
  }
}

// ══════════════════════════════════════════════════════════
// RECEIVE INSTALLMENT PAYMENT
// ══════════════════════════════════════════════════════════

export async function receiveInstallment(params: {
  receivableId: string
  amount: number
  paymentMethod: 'dinheiro' | 'pix' | 'debit_card' | 'credit_card'
  notes?: string
}) {
  const supabase = await createServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

  // Fetch receivable
  const { data: receivable, error: fetchErr } = await supabase
    .from("accounts_receivable")
    .select("*")
    .eq("id", params.receivableId)
    .single()

  if (fetchErr || !receivable) {
    return { success: false, error: "Parcela não encontrada." }
  }

  if (["paid", "cancelled", "reversed"].includes(receivable.status)) {
    return { success: false, error: `Parcela já está ${receivable.status === 'paid' ? 'paga' : receivable.status === 'cancelled' ? 'cancelada' : 'estornada'}.` }
  }

  const remaining = Number(receivable.amount) - Number(receivable.amount_paid)
  if (params.amount <= 0) {
    return { success: false, error: "Valor deve ser maior que zero." }
  }
  if (params.amount > remaining + 0.01) {
    return { success: false, error: `Valor excede saldo restante (R$ ${remaining.toFixed(2)}).` }
  }

  // For cash payments, check if cash session is open
  if (params.paymentMethod === 'dinheiro') {
    const { data: session } = await supabase
      .from("cash_sessions")
      .select("id")
      .eq("status", "open")
      .single()

    if (!session) {
      return { success: false, error: "Abra um caixa antes de receber em dinheiro." }
    }
  }

  // Determine payment method display name for descriptions
  const methodNames: Record<string, string> = {
    dinheiro: 'Dinheiro',
    pix: 'PIX',
    debit_card: 'Cartão Débito',
    credit_card: 'Cartão Crédito',
  }
  const methodDisplay = methodNames[params.paymentMethod] || params.paymentMethod

  const now = new Date().toISOString()
  const newAmountPaid = Math.round((Number(receivable.amount_paid) + params.amount) * 100) / 100
  const isFullyPaid = newAmountPaid >= Number(receivable.amount) - 0.01
  const newStatus = isFullyPaid ? "paid" : "partial"

  // 1. Create cash_entry (for dinheiro & debit, also pix goes through here)
  let cashEntryId: string | null = null
  const { data: cashSession } = await supabase
    .from("cash_sessions")
    .select("id")
    .eq("status", "open")
    .single()

  if (cashSession) {
    const { data: cashEntry, error: cashErr } = await supabase
      .from("cash_entries")
      .insert({
        cash_session_id: cashSession.id,
        entry_type: "sale_income",
        amount: params.amount,
        category: "Recebimento A Receber",
        description: `Parcela ${receivable.installment_number}/${receivable.total_installments} - ${receivable.customer_name_snapshot || 'Cliente'} (${methodDisplay})`,
        reference_type: "accounts_receivable",
        reference_id: receivable.id,
        occurred_at: now,
        created_by: userProfileId,
      })
      .select("id")
      .single()

    if (cashErr) {
      console.error("Failed to create cash entry:", cashErr)
      return { success: false, error: "Erro ao lançar no caixa: " + cashErr.message }
    }
    cashEntryId = cashEntry.id
  }

  // 2. Create financial_movement
  const { data: finMov, error: finErr } = await supabase
    .from("financial_movements")
    .insert({
      movement_type: "received",
      amount: params.amount,
      category: "Recebimentos",
      subcategory: "A Receber",
      description: `Recebimento parcela ${receivable.installment_number}/${receivable.total_installments} - ${receivable.customer_name_snapshot || 'Cliente'}`,
      occurred_on: now,
      origin_type: "accounts_receivable",
      origin_id: receivable.id,
    })
    .select("id")
    .single()

  if (finErr) {
    console.error("Failed to create financial movement:", finErr)
    return { success: false, error: "Erro ao lançar no financeiro: " + finErr.message }
  }

  // 3. Create payment record
  const { error: payErr } = await supabase
    .from("accounts_receivable_payments")
    .insert({
      receivable_id: receivable.id,
      amount: params.amount,
      payment_method: params.paymentMethod,
      paid_at: now,
      cash_entry_id: cashEntryId,
      financial_movement_id: finMov.id,
      created_by: userProfileId,
      notes: params.notes || null,
    })

  if (payErr) {
    console.error("Failed to create payment record:", payErr)
    return { success: false, error: "Erro ao registrar pagamento: " + payErr.message }
  }

  // 4. Update receivable
  const { error: updateErr } = await supabase
    .from("accounts_receivable")
    .update({
      amount_paid: newAmountPaid,
      status: newStatus,
      paid_at: isFullyPaid ? now : null,
      paid_by: isFullyPaid ? userProfileId : null,
      cash_entry_id: cashEntryId,
      financial_movement_id: finMov.id,
    })
    .eq("id", receivable.id)

  if (updateErr) {
    console.error("Failed to update receivable:", updateErr)
    return { success: false, error: "Erro ao atualizar parcela: " + updateErr.message }
  }

  // 5. Update sale payment_status if all installments are paid
  if (receivable.sale_id) {
    const { data: allInstallments } = await supabase
      .from("accounts_receivable")
      .select("status")
      .eq("sale_id", receivable.sale_id)

    const allPaid = allInstallments?.every(i => i.status === "paid")
    const anyPaid = allInstallments?.some(i => i.status === "paid" || i.status === "partial")

    if (allPaid) {
      await supabase.from("sales").update({ payment_status: "paid" }).eq("id", receivable.sale_id)
    } else if (anyPaid) {
      await supabase.from("sales").update({ payment_status: "partially_paid" }).eq("id", receivable.sale_id)
    }
  }

  // 6. Audit
  await logAudit({
    action: "receive_installment",
    entity: "accounts_receivable",
    entity_id: receivable.id,
    oldData: { amount_paid: receivable.amount_paid, status: receivable.status },
    newData: { amount_paid: newAmountPaid, status: newStatus, payment_amount: params.amount },
    observation: `Parcela ${receivable.installment_number}/${receivable.total_installments} recebida. R$ ${params.amount.toFixed(2)} via ${methodDisplay}. Novo saldo pago: R$ ${newAmountPaid.toFixed(2)}`,
  })

  revalidatePath("/a-receber")
  revalidatePath("/caixa")
  revalidatePath("/fluxo-de-caixa")
  revalidatePath("/vendas")
  return { success: true }
}

// ══════════════════════════════════════════════════════════
// CANCEL RECEIVABLE
// ══════════════════════════════════════════════════════════

export async function cancelReceivable(receivableId: string, reason: string) {
  if (!reason.trim()) {
    return { success: false, error: "Motivo de cancelamento obrigatório." }
  }

  const supabase = await createServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

  const { data: receivable, error: fetchErr } = await supabase
    .from("accounts_receivable")
    .select("*")
    .eq("id", receivableId)
    .single()

  if (fetchErr || !receivable) {
    return { success: false, error: "Parcela não encontrada." }
  }

  if (["paid", "cancelled", "reversed"].includes(receivable.status)) {
    return { success: false, error: "Esta parcela não pode ser cancelada." }
  }

  const { error: updateErr } = await supabase
    .from("accounts_receivable")
    .update({
      status: "cancelled",
      cancelled_by: userProfileId,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    })
    .eq("id", receivableId)

  if (updateErr) {
    return { success: false, error: "Erro ao cancelar: " + updateErr.message }
  }

  await logAudit({
    action: "cancel_receivable",
    entity: "accounts_receivable",
    entity_id: receivableId,
    oldData: { status: receivable.status },
    newData: { status: "cancelled", reason },
    observation: `Parcela ${receivable.installment_number}/${receivable.total_installments} cancelada. Motivo: ${reason}`,
  })

  revalidatePath("/a-receber")
  return { success: true }
}

// ══════════════════════════════════════════════════════════
// REVERSE INSTALLMENT PAYMENT
// ══════════════════════════════════════════════════════════

export async function reverseInstallmentPayment(paymentId: string, reason: string) {
  if (!reason.trim()) {
    return { success: false, error: "Motivo de estorno obrigatório." }
  }

  const supabase = await createServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

  const { data: payment, error: fetchErr } = await supabase
    .from("accounts_receivable_payments")
    .select("*")
    .eq("id", paymentId)
    .single()

  if (fetchErr || !payment) {
    return { success: false, error: "Pagamento não encontrado." }
  }

  if (payment.status === "reversed") {
    return { success: false, error: "Pagamento já estornado." }
  }

  // 1. Mark payment as reversed
  await supabase
    .from("accounts_receivable_payments")
    .update({
      status: "reversed",
      reversed_at: new Date().toISOString(),
      reversed_by: userProfileId,
      reversal_reason: reason,
    })
    .eq("id", paymentId)

  // 2. Recalculate receivable amount_paid
  const { data: receivable } = await supabase
    .from("accounts_receivable")
    .select("*")
    .eq("id", payment.receivable_id)
    .single()

  if (receivable) {
    const { data: activePayments } = await supabase
      .from("accounts_receivable_payments")
      .select("amount")
      .eq("receivable_id", receivable.id)
      .eq("status", "active")

    const newAmountPaid = (activePayments || []).reduce((sum, p) => sum + Number(p.amount), 0)
    const newStatus = newAmountPaid <= 0 ? "open" : "partial"

    await supabase
      .from("accounts_receivable")
      .update({
        amount_paid: newAmountPaid,
        status: newStatus,
        paid_at: null,
        paid_by: null,
      })
      .eq("id", receivable.id)
  }

  // 3. Create inverse cash_entry if exists
  if (payment.cash_entry_id) {
    const { data: cashSession } = await supabase
      .from("cash_sessions")
      .select("id")
      .eq("status", "open")
      .single()

    if (cashSession) {
      await supabase.from("cash_entries").insert({
        cash_session_id: cashSession.id,
        entry_type: "manual_expense",
        amount: -payment.amount,
        category: "Estorno A Receber",
        description: `Estorno de recebimento - Parcela (${reason})`,
        reference_type: "accounts_receivable_reversal",
        reference_id: payment.receivable_id,
        occurred_at: new Date().toISOString(),
        created_by: userProfileId,
      })
    }
  }

  // 4. Create inverse financial_movement
  if (payment.financial_movement_id) {
    await supabase.from("financial_movements").insert({
      movement_type: "paid",
      amount: -payment.amount,
      category: "Estornos",
      subcategory: "A Receber",
      description: `Estorno de recebimento de parcela (${reason})`,
      occurred_on: new Date().toISOString(),
      origin_type: "accounts_receivable_reversal",
      origin_id: payment.receivable_id,
    })
  }

  // 5. Audit
  await logAudit({
    action: "reverse_installment_payment",
    entity: "accounts_receivable_payments",
    entity_id: paymentId,
    oldData: { status: "active", amount: payment.amount },
    newData: { status: "reversed", reason },
    observation: `Pagamento de R$ ${Number(payment.amount).toFixed(2)} estornado. Motivo: ${reason}`,
  })

  revalidatePath("/a-receber")
  revalidatePath("/caixa")
  revalidatePath("/fluxo-de-caixa")
  return { success: true }
}
