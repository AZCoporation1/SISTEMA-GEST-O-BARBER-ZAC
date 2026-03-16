// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { fixedCostSchema, variableCostSchema, FixedCostFormValues, VariableCostFormValues } from "../types"
import { revalidatePath } from "next/cache"

export async function createFixedCost(data: FixedCostFormValues) {
  try {
    const validated = fixedCostSchema.parse(data)
    const supabase = await createServerClient()

    const { data: newCost, error } = await supabase
      .from("fixed_costs")
      .insert({
        name: validated.name,
        amount: validated.amount,
        category: validated.category,
        frequency: validated.frequency,
        due_day: validated.due_day || null,
        notes: validated.notes || null,
        is_active: validated.is_active,
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath("/custos/fixos")
    return { success: true, data: newCost }
  } catch (error: any) {
    console.error("Create Fixed Cost Error:", error)
    return { success: false, error: error.message || "Erro ao registrar custo fixo" }
  }
}

export async function toggleFixedCostStatus(id: string, currentStatus: boolean) {
  try {
    const supabase = await createServerClient()

    const { data: updated, error } = await supabase
      .from("fixed_costs")
      .update({ is_active: !currentStatus })
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    revalidatePath("/custos/fixos")
    return { success: true, data: updated }
  } catch (error: any) {
    console.error("Toggle Cost Status Error:", error)
    return { success: false, error: error.message || "Erro ao alterar status" }
  }
}

export async function createVariableCost(data: VariableCostFormValues) {
  try {
    const validated = variableCostSchema.parse(data)
    const supabase = await createServerClient()

    const { data: newCost, error } = await supabase
      .from("variable_costs")
      .insert({
        name: validated.name,
        amount: validated.amount,
        category: validated.category,
        occurred_on: validated.occurred_on || new Date().toISOString(),
        notes: validated.notes || null,
      })
      .select()
      .single()

    if (error) throw error

    // Also push to financial_movements for the cash flow view
    await supabase.from("financial_movements").insert({
      movement_type: "expense",
      amount: validated.amount,
      category: "Custo Variável",
      subcategory: validated.category,
      description: validated.name + (validated.notes ? `: ${validated.notes}` : ""),
      origin_type: "variable_cost",
      origin_id: newCost.id,
      occurred_on: validated.occurred_on || new Date().toISOString(),
    })

    revalidatePath("/custos/variaveis")
    return { success: true, data: newCost }
  } catch (error: any) {
    console.error("Create Variable Cost Error:", error)
    return { success: false, error: error.message || "Erro ao registrar custo variável" }
  }
}
