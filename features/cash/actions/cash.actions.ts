// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { openSessionSchema, closeSessionSchema, cashEntrySchema, OpenSessionValues, CloseSessionValues, CashEntryValues } from "../validators"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/features/audit/actions/audit.actions"
import { resolveUserProfileId } from "@/lib/supabase/resolve-user"

export async function openCashSession(data: OpenSessionValues) {
  try {
    const validated = openSessionSchema.parse(data)
    const supabase = await createServerClient()
    const { data: authData } = await supabase.auth.getUser()
    const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

    // Verify no open session exists
    const { data: existing } = await supabase.from("cash_sessions").select("id").eq("status", "open").single()
    if (existing) throw new Error("Já existe um caixa aberto. Feche o atual antes de abrir um novo.")

    // Insert session
    const { data: newSession, error } = await supabase.from("cash_sessions").insert({
      opened_by: userProfileId,
      opening_amount: validated.opening_amount,
      notes: validated.notes,
      status: "open",
    }).select().single()

    if (error) throw error

    // Register the opening balance as a cash entry (for tracking, not double-counting)
    // The opening_amount is the physical cash in the drawer, not a new income.
    // We register it as "reinforcement" so the expected calculation includes it.
    if (validated.opening_amount > 0) {
      await supabase.from("cash_entries").insert({
        cash_session_id: (newSession as any).id,
        entry_type: "reinforcement",
        amount: validated.opening_amount,
        category: "Abertura de Caixa",
        description: "Saldo inicial informado na abertura",
        created_by: userProfileId,
      })
      // Opening balance is NOT mirrored to financial_movements
      // It's not revenue — it's cash already in the drawer.
    }

    await logAudit({
      action: 'INSERT',
      entity: 'cash_sessions',
      entity_id: newSession.id,
      newData: newSession,
      observation: `Caixa aberto. Saldo inicial: R$ ${validated.opening_amount.toFixed(2)}`
    })

    revalidatePath("/caixa")
    revalidatePath("/dashboard")
    return { success: true, data: newSession }
  } catch (error: any) {
    console.error("Open Session Error:", error)
    return { success: false, error: error.message || "Erro ao abrir caixa" }
  }
}

export async function closeCashSession(sessionId: string, data: CloseSessionValues) {
  try {
    const validated = closeSessionSchema.parse(data)
    const supabase = await createServerClient()
    const { data: authData } = await supabase.auth.getUser()
    const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

    // Guard: fetch the current session and verify it's still open
    const { data: currentSession } = await supabase.from("cash_sessions").select("*").eq("id", sessionId).single()
    if (!currentSession) throw new Error("Caixa não encontrado")
    if ((currentSession as any).status !== "open") throw new Error("Caixa já está fechado")

    // Calculate expected balance from entries
    const { data: entries } = await supabase.from("cash_entries").select("amount, entry_type").eq("cash_session_id", sessionId)
    let expected = 0
    entries?.forEach(e => {
      if (["income", "manual_income", "sale_income", "reinforcement"].includes(e.entry_type)) expected += Number(e.amount)
      if (["expense", "manual_expense", "withdrawal"].includes(e.entry_type)) expected -= Math.abs(Number(e.amount))
    })

    const difference = validated.closing_amount - expected

    // CRITICAL FIX: Use explicit UPDATE with both .eq("id") AND .eq("status", "open")
    // This prevents race conditions where two requests could try to close the same session.
    const { data: updatedSession, error } = await supabase.from("cash_sessions").update({
      closed_by: userProfileId,
      closing_amount: validated.closing_amount,
      expected_amount: expected,
      difference_amount: difference,
      notes: validated.notes,
      closed_at: new Date().toISOString(),
      status: "closed",
    }).eq("id", sessionId).eq("status", "open").select().single()

    if (error) throw error
    if (!updatedSession) throw new Error("Caixa já foi fechado por outra requisição.")

    await logAudit({
      action: 'UPDATE',
      entity: 'cash_sessions',
      entity_id: sessionId,
      newData: updatedSession,
      observation: `Caixa fechado. Saldo esperado: R$ ${expected.toFixed(2)} | Informado: R$ ${validated.closing_amount.toFixed(2)} | Diferença: R$ ${difference.toFixed(2)}`
    })

    revalidatePath("/caixa")
    revalidatePath("/dashboard")
    revalidatePath("/fluxo-de-caixa")
    return { success: true, data: updatedSession }
  } catch (error: any) {
    console.error("Close Session Error:", error)
    return { success: false, error: error.message || "Erro ao fechar caixa" }
  }
}

export async function addCashEntry(data: CashEntryValues) {
  try {
    const validated = cashEntrySchema.parse(data)
    const supabase = await createServerClient()
    const { data: authData } = await supabase.auth.getUser()
    const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

    const { data: newEntry, error } = await supabase.from("cash_entries").insert({
      cash_session_id: validated.cash_session_id,
      entry_type: validated.entry_type,
      amount: validated.amount,
      category: validated.category,
      description: validated.description,
      payment_method_id: validated.payment_method_id || null,
      reference_type: "manual",
      created_by: userProfileId,
    }).select().single()

    if (error) throw error

    // Mirror to Financial Movements for BOTH income and expense entries
    if (["expense", "manual_expense"].includes(validated.entry_type)) {
      await supabase.from("financial_movements").insert({
        movement_type: "paid" as any,
        amount: validated.amount,
        category: "Despesa de Caixa",
        subcategory: validated.category,
        description: validated.description,
        origin_type: "cash_register",
        origin_id: (newEntry as any).id,
        occurred_on: new Date().toISOString(),
      })
    } else if (["income", "manual_income"].includes(validated.entry_type)) {
      await supabase.from("financial_movements").insert({
        movement_type: "received" as any,
        amount: validated.amount,
        category: "Receita de Caixa",
        subcategory: validated.category,
        description: validated.description,
        origin_type: "cash_register",
        origin_id: (newEntry as any).id,
        occurred_on: new Date().toISOString(),
      })
    }

    await logAudit({
      action: 'INSERT',
      entity: 'cash_entries',
      entity_id: newEntry.id,
      newData: newEntry,
      observation: `Lançamento de Caixa (${validated.entry_type}): R$ ${validated.amount.toFixed(2)} - ${validated.category}`
    })

    revalidatePath("/caixa")
    revalidatePath("/dashboard")
    revalidatePath("/fluxo-de-caixa")
    return { success: true, data: newEntry }
  } catch (error: any) {
    console.error("Add Cash Entry Error:", error)
    return { success: false, error: error.message || "Erro ao adicionar lançamento" }
  }
}

// ══════════════════════════════════════════════════════════
// REVERSE CASH ENTRY (Admin — non-destructive, creates inverse)
// ══════════════════════════════════════════════════════════

export async function reverseCashEntry(entryId: string, reason: string) {
  try {
    const supabase = await createServerClient()
    const { data: authData } = await supabase.auth.getUser()
    const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

    // Fetch original
    const { data: original, error: fetchErr } = await supabase
      .from("cash_entries")
      .select("*")
      .eq("id", entryId)
      .single()

    if (fetchErr || !original) throw new Error("Lançamento não encontrado")
    if ((original as any).status === "reversed") throw new Error("Lançamento já foi estornado")

    // Determine inverse type
    const isIncome = ["income", "manual_income", "sale_income", "reinforcement"].includes(original.entry_type)
    const inverseType = isIncome ? "expense" : "manual_income"

    // Get current open session
    const { data: activeSession } = await supabase
      .from("cash_sessions")
      .select("id")
      .eq("status", "open")
      .single()

    if (!activeSession) {
      return { success: false, error: "Não há caixa aberto para registrar o estorno." }
    }

    // Create inverse cash entry
    const { data: reverseEntry, error: revErr } = await supabase
      .from("cash_entries")
      .insert({
        cash_session_id: activeSession.id,
        entry_type: inverseType,
        amount: original.amount,
        category: "Estorno",
        description: `Estorno: ${original.description || original.category}`,
        reference_type: "cash_entry_reversal",
        reference_id: entryId,
        reversal_of_entry_id: entryId,
        created_by: userProfileId,
      })
      .select()
      .single()

    if (revErr) throw new Error("Erro ao criar lançamento de estorno: " + revErr.message)

    // Mark original as reversed
    await supabase.from("cash_entries")
      .update({
        status: "reversed",
        reversed_by_entry_id: reverseEntry.id,
        cancellation_reason: reason,
        cancelled_by: userProfileId,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", entryId)

    // Reverse financial movement if one was created
    if (isIncome) {
      // Original was income → mirrored as "received" → create inverse as "paid"
      await supabase.from("financial_movements").insert({
        movement_type: "paid" as any,
        amount: original.amount,
        category: "Estorno",
        subcategory: "Estorno Lançamento de Caixa",
        description: `Estorno: ${original.description || original.category}`,
        origin_type: "cash_entry_reversal",
        origin_id: reverseEntry.id,
        occurred_on: new Date().toISOString(),
      })
    } else {
      // Original was expense → mirrored as "paid" → create inverse as "received"
      await supabase.from("financial_movements").insert({
        movement_type: "received" as any,
        amount: original.amount,
        category: "Estorno",
        subcategory: "Estorno Lançamento de Caixa",
        description: `Estorno: ${original.description || original.category}`,
        origin_type: "cash_entry_reversal",
        origin_id: reverseEntry.id,
        occurred_on: new Date().toISOString(),
      })
    }

    await logAudit({
      action: 'UPDATE',
      entity: 'cash_entries',
      entity_id: entryId,
      oldData: original,
      newData: { ...original, status: 'reversed' },
      observation: `Lançamento de caixa estornado. Motivo: ${reason}. Movimento inverso criado.`
    })

    revalidatePath("/caixa")
    revalidatePath("/dashboard")
    revalidatePath("/fluxo-de-caixa")
    return { success: true, data: reverseEntry }
  } catch (error: any) {
    console.error("Reverse Cash Entry Error:", error)
    return { success: false, error: error.message || "Erro ao estornar lançamento" }
  }
}
