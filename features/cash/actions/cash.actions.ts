// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { openSessionSchema, closeSessionSchema, cashEntrySchema, OpenSessionValues, CloseSessionValues, CashEntryValues } from "../validators"
import { revalidatePath } from "next/cache"

export async function openCashSession(data: OpenSessionValues) {
  try {
    const validated = openSessionSchema.parse(data)
    const supabase = await createServerClient()
    const { data: authData } = await supabase.auth.getUser()

    // Verify no open session exists
    const { data: existing } = await supabase.from("cash_sessions").select("id").eq("status", "open").single()
    if (existing) throw new Error("Já existe um caixa aberto. Feche o atual antes de abrir um novo.")

    // Insert session - note DB uses opening_amount not opening_balance
    const { data: newSession, error } = await supabase.from("cash_sessions").insert({
      opened_by: authData.user?.id || null,
      opening_amount: validated.opening_amount,
      notes: validated.notes,
      status: "open",
    }).select().single()

    if (error) throw error

    // Register the opening balance as an entry
    if (validated.opening_amount > 0) {
      await supabase.from("cash_entries").insert({
        cash_session_id: (newSession as any).id,
        entry_type: "income",   // using valid enum value
        amount: validated.opening_amount,
        category: "Abertura de Caixa",
        description: "Saldo inicial informado na abertura",
        created_by: authData.user?.id || null,
      })
    }

    revalidatePath("/caixa")
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

    const { data: currentSession } = await supabase.from("cash_sessions").select("*").eq("id", sessionId).single()
    if (!currentSession) throw new Error("Caixa não encontrado")
    if ((currentSession as any).status !== "open") throw new Error("Caixa já está fechado")

    // Calculate expected balance from entries
    const { data: entries } = await supabase.from("cash_entries").select("amount, entry_type").eq("cash_session_id", sessionId)
    let expected = 0
    entries?.forEach(e => {
      if (["income", "manual_income", "sale_income", "reinforcement"].includes(e.entry_type)) expected += e.amount
      if (["expense", "manual_expense", "withdrawal"].includes(e.entry_type)) expected -= e.amount
    })

    const difference = validated.closing_amount - expected

    const { data: updatedSession, error } = await supabase.from("cash_sessions").update({
      closed_by: authData.user?.id || null,
      closing_amount: validated.closing_amount,
      expected_amount: expected,
      difference_amount: difference,
      notes: validated.notes,
      closed_at: new Date().toISOString(),
      status: "closed",
    }).eq("id", sessionId).select().single()

    if (error) throw error

    revalidatePath("/caixa")
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

    const { data: newEntry, error } = await supabase.from("cash_entries").insert({
      cash_session_id: validated.cash_session_id,
      entry_type: validated.entry_type,
      amount: validated.amount,
      category: validated.category,
      description: validated.description,
      payment_method_id: validated.payment_method_id || null,
      reference_type: "manual",
      created_by: authData.user?.id || null,
    }).select().single()

    if (error) throw error

    // Mirror to Financial Flow for expense entries
    if (["expense", "manual_expense"].includes(validated.entry_type)) {
      await supabase.from("financial_movements").insert({
        movement_type: "expense",
        amount: validated.amount,
        category: "Despesa de Caixa",
        subcategory: validated.category,
        description: validated.description,
        origin_type: "cash_register",
        origin_id: (newEntry as any).id,
        occurred_on: new Date().toISOString(),
      })
    }

    revalidatePath("/caixa")
    return { success: true, data: newEntry }
  } catch (error: any) {
    console.error("Add Cash Entry Error:", error)
    return { success: false, error: error.message || "Erro ao adicionar lançamento" }
  }
}
