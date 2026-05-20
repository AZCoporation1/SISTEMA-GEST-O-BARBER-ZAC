// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/features/audit/actions/audit.actions"
import { resolveUserProfileId } from "@/lib/supabase/resolve-user"
import { calculateReceptionLedger, generateReceptionLegitText } from "../services/receptionLedger.service"
import { getReceptionAdvances, getReceptionDraftClosure } from "../services/reception.service"
import type { RegisterReceptionAdvanceInput, ConfirmReceptionClosureInput } from "../types"

/**
 * Helper to enforce admin/owner access for all reception mutations.
 */
async function requireAdminAccess(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Usuário não autenticado")

  const actorProfileId = await resolveUserProfileId(supabase, user.id)
  if (!actorProfileId) throw new Error("Perfil de usuário não encontrado no sistema")

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("system_role")
    .eq("id", actorProfileId)
    .single()

  if (error || !profile) {
    throw new Error("Erro ao validar permissões do usuário")
  }

  const allowedRoles = ["admin_total", "owner_admin_professional"]
  if (!allowedRoles.includes(profile.system_role)) {
    throw new Error("Acesso negado: Requer privilégios de Administrador ou Proprietário")
  }

  return actorProfileId
}

// ══════════════════════════════════════════════════════════
// 1. UPDATE RECEPTION SALARY
// ══════════════════════════════════════════════════════════

export async function updateReceptionSalary(
  staffId: string,
  periodStart: string,
  periodEnd: string,
  salaryAmount: number,
  updateBaseSalary: boolean = false
) {
  const supabase = await createServerClient()
  
  try {
    const actorId = await requireAdminAccess(supabase)

    if (salaryAmount < 0) {
      throw new Error("O valor do salário não pode ser negativo")
    }

    // 1. Fetch reception staff details
    const { data: staff, error: staffErr } = await supabase
      .from("reception_staff")
      .select("*")
      .eq("id", staffId)
      .single()

    if (staffErr || !staff) {
      throw new Error("Recepcionista não encontrado")
    }

    // 2. Fetch active advances to calculate correct net_payable
    const { data: advances, error: advErr } = await supabase
      .from("reception_advances")
      .select("*")
      .eq("staff_id", staffId)
      .eq("status", "active")
      .gte("period_start", periodStart)
      .lte("period_end", periodEnd)

    if (advErr) {
      throw new Error("Erro ao buscar adiantamentos ativos do período")
    }

    // 3. Find if there's an existing non-cancelled closure for this period
    const { data: existingClosure, error: closureFetchErr } = await supabase
      .from("reception_closures")
      .select("*")
      .eq("staff_id", staffId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .neq("status", "cancelled")
      .maybeSingle()

    if (existingClosure && existingClosure.status !== "draft") {
      throw new Error(`Não é possível alterar o salário. O período está com status '${existingClosure.status}'.`)
    }

    // Recalculate summary using the pure ledger service
    const summary = calculateReceptionLedger(staff, advances || [], existingClosure)
    // Overwrite the salaryAmount for calculation
    summary.salaryAmount = salaryAmount
    summary.netPayable = salaryAmount - (summary.advancesTotal + summary.stockWithdrawalsTotal) + summary.adjustmentsTotal

    let resultClosure

    if (existingClosure) {
      // Update existing draft closure
      const { data: updated, error: updateErr } = await supabase
        .from("reception_closures")
        .update({
          salary_amount: salaryAmount,
          net_payable: summary.netPayable,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingClosure.id)
        .select()
        .single()

      if (updateErr) throw new Error("Erro ao atualizar salário no fechamento: " + updateErr.message)
      resultClosure = updated

      await logAudit({
        action: "UPDATE",
        entity: "reception_closures",
        entity_id: existingClosure.id,
        oldData: existingClosure,
        newData: updated,
        observation: `Salário do período (${periodStart} a ${periodEnd}) atualizado para R$ ${salaryAmount.toFixed(2)}`
      })
    } else {
      // Create new draft closure
      const { data: inserted, error: insertErr } = await supabase
        .from("reception_closures")
        .insert({
          staff_id: staffId,
          period_start: periodStart,
          period_end: periodEnd,
          salary_amount: salaryAmount,
          advances_total: summary.advancesTotal + summary.stockWithdrawalsTotal,
          adjustments_total: 0,
          net_payable: summary.netPayable,
          status: "draft",
          created_by: actorId,
        })
        .select()
        .single()

      if (insertErr) throw new Error("Erro ao inicializar fechamento: " + insertErr.message)
      resultClosure = inserted

      await logAudit({
        action: "INSERT",
        entity: "reception_closures",
        entity_id: inserted.id,
        newData: inserted,
        observation: `Período inicializado em rascunho com salário de R$ ${salaryAmount.toFixed(2)}`
      })
    }

    // 4. Update permanent base salary if selected
    if (updateBaseSalary) {
      const { error: staffUpdateErr } = await supabase
        .from("reception_staff")
        .update({
          base_salary_per_period: salaryAmount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", staffId)

      if (staffUpdateErr) {
        console.error("Warning: Failed to update base salary on staff profile", staffUpdateErr)
      } else {
        await logAudit({
          action: "UPDATE",
          entity: "reception_staff",
          entity_id: staffId,
          observation: `Salário base quinzenal atualizado de forma permanente para R$ ${salaryAmount.toFixed(2)}`
        })
      }
    }

    revalidatePath("/recepcao")
    revalidatePath("/caixa")
    revalidatePath("/fluxo-de-caixa")
    return { success: true, data: resultClosure }
  } catch (error: any) {
    console.error("Update Reception Salary Error:", error)
    return { success: false, error: error.message || "Erro ao atualizar salário" }
  }
}

// ══════════════════════════════════════════════════════════
// 2. REGISTER RECEPTION ADVANCE (Pegos, Adiantamentos, Retiradas)
// ══════════════════════════════════════════════════════════

export async function registerReceptionAdvance(data: RegisterReceptionAdvanceInput) {
  const supabase = await createServerClient()

  try {
    const actorId = await requireAdminAccess(supabase)

    const totalAmount = data.quantity * data.unit_amount
    if (totalAmount <= 0) {
      throw new Error("O valor total da retirada/adiantamento deve ser maior que zero")
    }

    // Validate active period is not already closed or paid
    const { data: existingClosure } = await supabase
      .from("reception_closures")
      .select("status")
      .eq("staff_id", data.staff_id)
      .eq("period_start", data.period_start)
      .eq("period_end", data.period_end)
      .neq("status", "cancelled")
      .maybeSingle()

    if (existingClosure && ["confirmed", "paid"].includes(existingClosure.status)) {
      throw new Error(`Não é possível registrar lançamentos. O período está fechado/pago (status: ${existingClosure.status}).`)
    }

    let cashEntryId: string | null = null
    let financialMovementId: string | null = null
    let stockMovementId: string | null = null

    // ── A) Cash Advance: Cash Entry + Financial Movement ──
    if (data.type === "cash_advance") {
      const { data: activeSession } = await supabase
        .from("cash_sessions")
        .select("id")
        .eq("status", "open")
        .single()

      if (!activeSession) {
        return {
          success: false,
          error: "Não há caixa aberto. Abra o caixa antes de registrar adiantamento em dinheiro.",
        }
      }

      // Create cash entry (expense)
      const { data: cashEntry, error: cashErr } = await supabase
        .from("cash_entries")
        .insert({
          cash_session_id: activeSession.id,
          entry_type: "expense",
          amount: totalAmount,
          category: "Adiantamento Recepção",
          description: `Adiantamento: ${data.description}`,
          reference_type: "reception_advance",
          created_by: actorId,
        })
        .select("id")
        .single()

      if (cashErr) throw new Error("Erro ao lançar no caixa: " + cashErr.message)
      cashEntryId = cashEntry.id

      // Create financial movement
      const { data: finMov, error: finErr } = await supabase
        .from("financial_movements")
        .insert({
          movement_type: "paid",
          amount: totalAmount,
          category: "Despesa Operacional",
          subcategory: "Adiantamento Recepção",
          description: `Adiantamento dinheiro - Recepcionista - ${data.description}`,
          origin_type: "reception_advance",
          occurred_on: new Date().toISOString(),
        })
        .select("id")
        .single()

      if (finErr) throw new Error("Erro no fluxo financeiro: " + finErr.message)
      financialMovementId = finMov.id
    }

    // ── B) Pix Advance: Financial Movement only (no Cash Entry) ──
    else if (data.type === "pix_advance") {
      const { data: finMov, error: finErr } = await supabase
        .from("financial_movements")
        .insert({
          movement_type: "paid",
          amount: totalAmount,
          category: "Despesa Operacional",
          subcategory: "Adiantamento Recepção (PIX)",
          description: `Adiantamento PIX - Recepcionista - ${data.description}`,
          origin_type: "reception_advance",
          occurred_on: new Date().toISOString(),
        })
        .select("id")
        .single()

      if (finErr) throw new Error("Erro no fluxo financeiro: " + finErr.message)
      financialMovementId = finMov.id
    }

    // ── C) Stock Withdrawal: Verify stock balance and insert negative movement ──
    else if (data.type === "stock_withdrawal") {
      if (!data.product_id) {
        throw new Error("ID do produto é obrigatório para retiradas de estoque")
      }

      // Check product stock balance
      const { data: stockInfo, error: stockFetchErr } = await supabase
        .from("vw_inventory_position")
        .select("current_balance, product_name")
        .eq("product_id", data.product_id)
        .single()

      if (stockFetchErr || !stockInfo) {
        throw new Error("Produto não encontrado no estoque")
      }

      if (Number(stockInfo.current_balance) < data.quantity) {
        throw new Error(`Estoque insuficiente. Saldo disponível: ${stockInfo.current_balance}`)
      }

      // Insert negative stock movement
      const { data: stockMov, error: stockMovErr } = await supabase
        .from("stock_movements")
        .insert({
          product_id: data.product_id,
          movement_type: "internal_consumption",
          movement_reason: `Retirada de consumo: Recepcionista - ${data.description}`,
          source_type: "stock",
          destination_type: "reception",
          quantity: -Math.abs(data.quantity), // negative value to exit stock
          unit_cost_snapshot: null, // cost gets filled or can be skipped
          unit_sale_snapshot: data.unit_amount,
          total_sale_snapshot: totalAmount,
          reference_type: "reception_advance",
          movement_date: new Date().toISOString(),
          performed_by: actorId,
        })
        .select("id")
        .single()

      if (stockMovErr) throw new Error("Erro ao registrar baixa no estoque: " + stockMovErr.message)
      stockMovementId = stockMov.id
    }

    // 4. Save Advance record in DB
    const { data: advance, error: insertErr } = await supabase
      .from("reception_advances")
      .insert({
        staff_id: data.staff_id,
        occurred_at: new Date().toISOString(),
        type: data.type,
        source_method: data.source_method,
        description: data.description,
        quantity: data.quantity,
        unit_amount: data.unit_amount,
        total_amount: totalAmount,
        product_id: data.product_id || null,
        cash_entry_id: cashEntryId,
        financial_movement_id: financialMovementId,
        stock_movement_id: stockMovementId,
        period_start: data.period_start,
        period_end: data.period_end,
        status: "active",
        created_by: actorId,
        notes: data.notes || null,
      })
      .select()
      .single()

    if (insertErr) throw new Error("Erro ao salvar adiantamento na recepção: " + insertErr.message)

    // Link cash_entry, stock_movement, financial_movement references if possible
    if (cashEntryId) {
      await supabase.from("cash_entries").update({ reference_id: advance.id }).eq("id", cashEntryId)
    }
    if (financialMovementId) {
      await supabase.from("financial_movements").update({ origin_id: advance.id }).eq("id", financialMovementId)
    }
    if (stockMovementId) {
      await supabase.from("stock_movements").update({ reference_id: advance.id }).eq("id", stockMovementId)
    }

    // ── Audit ──
    await logAudit({
      action: "INSERT",
      entity: "reception_advances",
      entity_id: advance.id,
      newData: advance,
      observation: `Adiantamento recepção registrado: ${data.type} - R$ ${totalAmount.toFixed(2)} (${data.description})`
    })

    // Recompute the draft closure totals to keep them fresh
    await syncClosureTotals(supabase, data.staff_id, data.period_start, data.period_end)

    revalidatePath("/recepcao")
    revalidatePath("/caixa")
    revalidatePath("/estoque")
    revalidatePath("/fluxo-de-caixa")
    return { success: true, data: advance }
  } catch (error: any) {
    console.error("Register Reception Advance Error:", error)
    return { success: false, error: error.message || "Erro ao registrar adiantamento" }
  }
}

// ══════════════════════════════════════════════════════════
// 3. CANCEL RECEPTION ADVANCE
// ══════════════════════════════════════════════════════════

export async function cancelReceptionAdvance(advanceId: string, reason?: string) {
  const supabase = await createServerClient()

  try {
    const actorId = await requireAdminAccess(supabase)

    // 1. Fetch advance details
    const { data: advance, error: fetchErr } = await supabase
      .from("reception_advances")
      .select("*")
      .eq("id", advanceId)
      .single()

    if (fetchErr || !advance) throw new Error("Adiantamento não encontrado")
    if (advance.status !== "active") throw new Error("Apenas lançamentos ativos podem ser cancelados")

    // Check if period is already confirmed/paid
    const { data: existingClosure } = await supabase
      .from("reception_closures")
      .select("status")
      .eq("staff_id", advance.staff_id)
      .eq("period_start", advance.period_start)
      .eq("period_end", advance.period_end)
      .neq("status", "cancelled")
      .maybeSingle()

    if (existingClosure && ["confirmed", "paid"].includes(existingClosure.status)) {
      throw new Error(`Não é possível cancelar. O período já está fechado/pago (status: ${existingClosure.status}).`)
    }

    // ── A) Estornar Caixa (se for adiantamento em dinheiro) ──
    if (advance.cash_entry_id) {
      const { data: activeSession } = await supabase
        .from("cash_sessions").select("id").eq("status", "open").single()

      if (activeSession) {
        await supabase.from("cash_entries").insert({
          cash_session_id: activeSession.id,
          entry_type: "manual_income", // income to offset expense
          amount: advance.total_amount,
          category: "Estorno Adiantamento Recepção",
          description: `Estorno vale cancelado: ${advance.description}`,
          reference_type: "advance_cancellation",
          reference_id: advance.id,
          reversal_of_entry_id: advance.cash_entry_id,
          created_by: actorId,
        })
      }

      // Mark original entry as reversed
      await supabase.from("cash_entries")
        .update({ status: "reversed", cancelled_at: new Date().toISOString(), cancelled_by: actorId })
        .eq("id", advance.cash_entry_id)
    }

    // ── B) Estornar Fluxo Financeiro ──
    if (advance.financial_movement_id) {
      const { data: origFin } = await supabase
        .from("financial_movements").select("*").eq("id", advance.financial_movement_id).single()

      if (origFin) {
        await supabase.from("financial_movements").insert({
          movement_type: "received", // receive to offset pay
          amount: origFin.amount,
          category: "Estorno",
          subcategory: "Estorno Adiantamento Recepção",
          description: `Estorno: ${origFin.description}`,
          origin_type: "advance_cancellation",
          origin_id: advance.id,
          occurred_on: new Date().toISOString(),
        })
      }
    }

    // ── C) Estornar Estoque (Retornar produto) ──
    if (advance.stock_movement_id && advance.product_id) {
      await supabase.from("stock_movements").insert({
        product_id: advance.product_id,
        movement_type: "return_from_customer", // or adjustment_in
        quantity: Math.abs(advance.quantity), // positive value to enter stock
        movement_reason: `Estorno retirada recepcionista cancelada: ${advance.description}`,
        source_type: "advance_cancellation",
        destination_type: "stock",
        reference_type: "reception_advance",
        reference_id: advance.id,
        movement_date: new Date().toISOString(),
        performed_by: actorId,
      })
    }

    // 2. Mark Advance as cancelled
    const { error: updateErr } = await supabase
      .from("reception_advances")
      .update({
        status: "cancelled",
        cancelled_by: actorId,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || null,
      })
      .eq("id", advanceId)

    if (updateErr) throw updateErr

    // ── Audit ──
    await logAudit({
      action: "UPDATE",
      entity: "reception_advances",
      entity_id: advanceId,
      oldData: advance,
      newData: { ...advance, status: "cancelled" },
      observation: `Adiantamento recepção cancelado. Motivo: ${reason || "Não informado"}. Caixa/financeiro/estoque estornados.`
    })

    // Recompute the draft closure totals to keep them fresh
    await syncClosureTotals(supabase, advance.staff_id, advance.period_start, advance.period_end)

    revalidatePath("/recepcao")
    revalidatePath("/caixa")
    revalidatePath("/estoque")
    revalidatePath("/fluxo-de-caixa")
    return { success: true }
  } catch (error: any) {
    console.error("Cancel Reception Advance Error:", error)
    return { success: false, error: error.message || "Erro ao cancelar adiantamento" }
  }
}

// ══════════════════════════════════════════════════════════
// 4. GENERATE CLOSURE PREVIEW
// ══════════════════════════════════════════════════════════

export async function generateReceptionClosurePreview(
  staffId: string,
  periodStart: string,
  periodEnd: string
) {
  const supabase = await createServerClient()

  try {
    // 1. Fetch staff details
    const { data: staff, error: staffErr } = await supabase
      .from("reception_staff")
      .select("*")
      .eq("id", staffId)
      .single()

    if (staffErr || !staff) throw new Error("Recepcionista não encontrado")

    // 2. Fetch active advances
    const { data: advances, error: advErr } = await supabase
      .from("reception_advances")
      .select("*")
      .eq("staff_id", staffId)
      .eq("status", "active")
      .gte("period_start", periodStart)
      .lte("period_end", periodEnd)

    if (advErr) throw new Error("Erro ao carregar adiantamentos ativos")

    // 3. Fetch draft closure if exists
    const { data: draftClosure } = await supabase
      .from("reception_closures")
      .select("*")
      .eq("staff_id", staffId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .neq("status", "cancelled")
      .maybeSingle()

    // Run pure calculation
    const summary = calculateReceptionLedger(staff, advances || [], draftClosure)
    const legitText = generateReceptionLegitText(staff, summary, periodStart, periodEnd, advances || [])

    return {
      success: true,
      data: {
        staff,
        summary,
        advances: advances || [],
        legitText,
        draftClosure,
      }
    }
  } catch (error: any) {
    console.error("Generate Reception Closure Preview Error:", error)
    return { success: false, error: error.message || "Erro ao gerar prévia do fechamento" }
  }
}

// ══════════════════════════════════════════════════════════
// 5. CONFIRM RECEPTION CLOSURE
// ══════════════════════════════════════════════════════════

export async function confirmReceptionClosure(data: ConfirmReceptionClosureInput) {
  const supabase = await createServerClient()

  try {
    const actorId = await requireAdminAccess(supabase)

    if (data.salary_amount <= 0) {
      throw new Error("Não é possível fechar o período sem salário definido (> 0)")
    }

    // Check if there is already a non-cancelled confirmed or paid closure
    const { data: existingClosure } = await supabase
      .from("reception_closures")
      .select("id, status")
      .eq("staff_id", data.staff_id)
      .eq("period_start", data.period_start)
      .eq("period_end", data.period_end)
      .neq("status", "cancelled")
      .maybeSingle()

    if (existingClosure && existingClosure.status !== "draft") {
      throw new Error(`Fechamento já realizado para este período (status: ${existingClosure.status})`)
    }

    let resultClosure

    if (existingClosure) {
      // Update the draft closure to confirmed
      const { data: updated, error: updateErr } = await supabase
        .from("reception_closures")
        .update({
          salary_amount: data.salary_amount,
          advances_total: data.advances_total,
          adjustments_total: data.adjustments_total,
          net_payable: data.net_payable,
          legit_text: data.legit_text,
          status: "confirmed",
          snapshot_json: data.snapshot_json,
          confirmed_by: actorId,
          notes: data.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingClosure.id)
        .select()
        .single()

      if (updateErr) throw new Error("Erro ao fechar período: " + updateErr.message)
      resultClosure = updated
    } else {
      // Insert new confirmed closure
      const { data: inserted, error: insertErr } = await supabase
        .from("reception_closures")
        .insert({
          staff_id: data.staff_id,
          period_start: data.period_start,
          period_end: data.period_end,
          salary_amount: data.salary_amount,
          advances_total: data.advances_total,
          adjustments_total: data.adjustments_total,
          net_payable: data.net_payable,
          legit_text: data.legit_text,
          status: "confirmed",
          snapshot_json: data.snapshot_json,
          created_by: actorId,
          confirmed_by: actorId,
          notes: data.notes || null,
        })
        .select()
        .single()

      if (insertErr) throw new Error("Erro ao salvar fechamento: " + insertErr.message)
      resultClosure = inserted
    }

    // Mark included advances as applied and link to closure
    if (data.advance_ids && data.advance_ids.length > 0) {
      const { error: advUpdateErr } = await supabase
        .from("reception_advances")
        .update({ status: "applied", closure_id: resultClosure.id })
        .in("id", data.advance_ids)

      if (advUpdateErr) {
        console.error("Warning: failed to update advances to applied status", advUpdateErr)
      }
    }

    // ── Audit ──
    await logAudit({
      action: "INSERT",
      entity: "reception_closures",
      entity_id: resultClosure.id,
      newData: resultClosure,
      observation: `Fechamento quinzenal de Recepção CONFIRMADO. Período: ${data.period_start} a ${data.period_end}. Líquido: R$ ${data.net_payable.toFixed(2)}`
    })

    revalidatePath("/recepcao")
    return { success: true, data: resultClosure }
  } catch (error: any) {
    console.error("Confirm Reception Closure Error:", error)
    return { success: false, error: error.message || "Erro ao confirmar fechamento" }
  }
}

// ══════════════════════════════════════════════════════════
// 6. PAY RECEPTION CLOSURE (Caixa ou PIX)
// ══════════════════════════════════════════════════════════

export async function payReceptionClosure(
  closureId: string,
  paidMethod: "caixa" | "pix"
) {
  const supabase = await createServerClient()

  try {
    const actorId = await requireAdminAccess(supabase)

    // 1. Fetch closure details
    const { data: closure, error: fetchErr } = await supabase
      .from("reception_closures")
      .select("*")
      .eq("id", closureId)
      .single()

    if (fetchErr || !closure) throw new Error("Fechamento não encontrado")
    if (closure.status !== "confirmed") throw new Error("Apenas fechamentos confirmados podem ser pagos")

    if (closure.net_payable <= 0) {
      throw new Error("Fechamentos com saldo líquido menor ou igual a zero não exigem pagamento via caixa/PIX")
    }

    let cashEntryId: string | null = null
    let financialMovementId: string | null = null

    // ── A) Pay via Caixa: Requires open session, creates Expense cash entry and paid financial movement ──
    if (paidMethod === "caixa") {
      const { data: activeSession } = await supabase
        .from("cash_sessions")
        .select("id")
        .eq("status", "open")
        .single()

      if (!activeSession) {
        return { success: false, error: "Não há caixa aberto para realizar o pagamento." }
      }

      // Create cash entry (expense)
      const { data: cashEntry, error: cashErr } = await supabase
        .from("cash_entries")
        .insert({
          cash_session_id: activeSession.id,
          entry_type: "expense",
          amount: closure.net_payable,
          category: "Pagamento Recepção",
          description: `Pagamento recepção #${closure.id.split("-")[0]}`,
          reference_type: "reception_closure",
          reference_id: closure.id,
          created_by: actorId,
        })
        .select("id")
        .single()

      if (cashErr) throw new Error("Erro ao lançar pagamento no caixa: " + cashErr.message)
      cashEntryId = cashEntry.id

      // Create financial movement
      const { data: finMov, error: finErr } = await supabase
        .from("financial_movements")
        .insert({
          movement_type: "paid",
          amount: closure.net_payable,
          category: "Despesa Operacional",
          subcategory: "Pagamento Recepção",
          description: `Quitação fechamento recepção #${closure.id.split("-")[0]}`,
          origin_type: "reception_closure",
          origin_id: closure.id,
          occurred_on: new Date().toISOString(),
        })
        .select("id")
        .single()

      if (finErr) throw new Error("Erro no fluxo financeiro: " + finErr.message)
      financialMovementId = finMov.id
    }

    // ── B) Pay via PIX: Financial movement only (direct bank transfer, no cash register effect) ──
    else if (paidMethod === "pix") {
      const { data: finMov, error: finErr } = await supabase
        .from("financial_movements")
        .insert({
          movement_type: "paid",
          amount: closure.net_payable,
          category: "Despesa Operacional",
          subcategory: "Pagamento Recepção (PIX)",
          description: `Quitação PIX fechamento recepção #${closure.id.split("-")[0]}`,
          origin_type: "reception_closure",
          origin_id: closure.id,
          occurred_on: new Date().toISOString(),
        })
        .select("id")
        .single()

      if (finErr) throw new Error("Erro no fluxo financeiro: " + finErr.message)
      financialMovementId = finMov.id
    }

    // 2. Update closure status to paid
    const { error: updateErr } = await supabase
      .from("reception_closures")
      .update({
        status: "paid",
        paid_method: paidMethod,
        paid_at: new Date().toISOString(),
        cash_entry_id: cashEntryId,
        financial_movement_id: financialMovementId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", closureId)

    if (updateErr) throw updateErr

    // ── Audit ──
    await logAudit({
      action: "UPDATE",
      entity: "reception_closures",
      entity_id: closureId,
      newData: { status: "paid", paid_method: paidMethod },
      observation: `Fechamento recepção PAGO via ${paidMethod.toUpperCase()}. Valor: R$ ${closure.net_payable.toFixed(2)}`
    })

    revalidatePath("/recepcao")
    revalidatePath("/caixa")
    revalidatePath("/fluxo-de-caixa")
    return { success: true }
  } catch (error: any) {
    console.error("Pay Reception Closure Error:", error)
    return { success: false, error: error.message || "Erro ao registrar pagamento" }
  }
}

// ══════════════════════════════════════════════════════════
// 7. CANCEL RECEPTION CLOSURE
// ══════════════════════════════════════════════════════════

export async function cancelReceptionClosure(closureId: string, reason?: string) {
  const supabase = await createServerClient()

  try {
    const actorId = await requireAdminAccess(supabase)

    // 1. Fetch closure
    const { data: closure, error: fetchErr } = await supabase
      .from("reception_closures")
      .select("*")
      .eq("id", closureId)
      .single()

    if (fetchErr || !closure) throw new Error("Fechamento não encontrado")
    if (closure.status === "cancelled") throw new Error("Fechamento já está cancelado")

    // ── A) Se pago, estornar lançamentos financeiros correspondentes ──
    if (closure.status === "paid") {
      // Reverter caixa (se foi pago via caixa)
      if (closure.cash_entry_id) {
        const { data: activeSession } = await supabase
          .from("cash_sessions").select("id").eq("status", "open").single()

        if (activeSession) {
          await supabase.from("cash_entries").insert({
            cash_session_id: activeSession.id,
            entry_type: "manual_income", // offset expense
            amount: closure.net_payable,
            category: "Estorno Pagamento Recepção",
            description: `Estorno pagamento fechamento recepção #${closure.id.split("-")[0]}`,
            reference_type: "closure_reversal",
            reference_id: closure.id,
            reversal_of_entry_id: closure.cash_entry_id,
            created_by: actorId,
          })
        }

        // Mark original cash entry as reversed
        await supabase.from("cash_entries")
          .update({ status: "reversed", cancelled_at: new Date().toISOString(), cancelled_by: actorId })
          .eq("id", closure.cash_entry_id)
      }

      // Reverter fluxo financeiro
      if (closure.financial_movement_id) {
        const { data: origFin } = await supabase
          .from("financial_movements").select("*").eq("id", closure.financial_movement_id).single()

        if (origFin) {
          await supabase.from("financial_movements").insert({
            movement_type: "received", // received to offset paid
            amount: origFin.amount,
            category: "Estorno",
            subcategory: "Estorno Pagamento Recepção",
            description: `Estorno: ${origFin.description}`,
            origin_type: "closure_reversal",
            origin_id: closure.id,
            occurred_on: new Date().toISOString(),
          })
        }
      }
    }

    // 2. Revert applied advances back to active status
    const { error: advRevertErr } = await supabase
      .from("reception_advances")
      .update({ status: "active", closure_id: null })
      .eq("closure_id", closureId)

    if (advRevertErr) {
      console.error("Warning: failed to revert applied advances back to active", advRevertErr)
    }

    // 3. Mark closure as cancelled
    const { error: updateErr } = await supabase
      .from("reception_closures")
      .update({
        status: "cancelled",
        cancelled_by: actorId,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", closureId)

    if (updateErr) throw updateErr

    // ── Audit ──
    const wasPaid = closure.status === "paid"
    await logAudit({
      action: "UPDATE",
      entity: "reception_closures",
      entity_id: closureId,
      oldData: closure,
      newData: { ...closure, status: "cancelled" },
      observation: wasPaid
        ? `Fechamento recepção PAGO cancelado. Motivo: ${reason || "Não informado"}. Caixa/financeiro estornados, vales liberados.`
        : `Fechamento recepção cancelado. Motivo: ${reason || "Não informado"}. Vales liberados de volta ao estado ativo.`
    })

    revalidatePath("/recepcao")
    revalidatePath("/caixa")
    revalidatePath("/fluxo-de-caixa")
    return { success: true }
  } catch (error: any) {
    console.error("Cancel Reception Closure Error:", error)
    return { success: false, error: error.message || "Erro ao cancelar fechamento" }
  }
}

// ══════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ══════════════════════════════════════════════════════════

/**
 * Synchronizes the closure record totals (advances_total, net_payable)
 * when new advances/withdrawals are registered or cancelled under an open draft period.
 */
async function syncClosureTotals(
  supabase: any,
  staffId: string,
  periodStart: string,
  periodEnd: string
) {
  try {
    // 1. Fetch draft closure
    const { data: draftClosure } = await supabase
      .from("reception_closures")
      .select("*")
      .eq("staff_id", staffId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .eq("status", "draft")
      .maybeSingle()

    if (!draftClosure) return // No active draft to sync

    // 2. Fetch staff
    const { data: staff } = await supabase
      .from("reception_staff")
      .select("*")
      .eq("id", staffId)
      .single()

    // 3. Fetch active advances
    const { data: advances } = await supabase
      .from("reception_advances")
      .select("*")
      .eq("staff_id", staffId)
      .eq("status", "active")
      .gte("period_start", periodStart)
      .lte("period_end", periodEnd)

    const summary = calculateReceptionLedger(staff, advances || [], draftClosure)

    await supabase
      .from("reception_closures")
      .update({
        advances_total: summary.advancesTotal + summary.stockWithdrawalsTotal,
        net_payable: summary.netPayable,
        updated_at: new Date().toISOString(),
      })
      .eq("id", draftClosure.id)
  } catch (err) {
    console.error("Failed to sync open closure totals:", err)
  }
}
