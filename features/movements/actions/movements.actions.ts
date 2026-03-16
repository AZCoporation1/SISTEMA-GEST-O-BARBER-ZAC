// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { movementSchema, MovementFormValues } from "../validators"
import { revalidatePath } from "next/cache"

export async function createMovement(data: MovementFormValues) {
  try {
    const validated = movementSchema.parse(data)
    const supabase = await createServerClient()
    
    // Auth context (in real scenario handled by server client cookie)
    const { data: authData } = await supabase.auth.getUser()
    
    const qty = 
      ["initial_balance", "purchase_entry", "manual_adjustment_in", "return_from_customer"].includes(validated.movement_type) 
      ? validated.quantity 
      : -validated.quantity

    const { data: newMovement, error } = await supabase
      .from("stock_movements")
      .insert({
        product_id: validated.product_id,
        movement_type: validated.movement_type as any,
        quantity: qty,
        movement_reason: validated.movement_reason,
        notes: validated.notes,
        movement_date: new Date().toISOString(),
        source_type: 'manual', // MVP simplified
        destination_type: 'stock',
        performed_by: authData.user?.id || null, // Best effort
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath("/movimentacoes")
    revalidatePath("/estoque")
    return { success: true, data: newMovement }
  } catch (error: any) {
    console.error("Create Movement Error:", error)
    return { success: false, error: error.message || "Erro ao registrar movimentação" }
  }
}
