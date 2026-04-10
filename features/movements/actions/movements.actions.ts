// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { movementSchema, MovementFormValues } from "../validators"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/features/audit/actions/audit.actions"
import { resolveUserProfileId } from "@/lib/supabase/resolve-user"

export async function createMovement(data: MovementFormValues) {
  try {
    const validated = movementSchema.parse(data)
    const supabase = await createServerClient()
    
    // Auth context
    const { data: authData } = await supabase.auth.getUser()

    // Resolve user_profiles.id for performed_by FK
    const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)
    
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
        source_type: 'manual',
        destination_type: 'stock',
        performed_by: userProfileId,
      })
      .select()
      .single()

    if (error) throw error

    await logAudit({
      action: 'INSERT',
      entity: 'stock_movements',
      entity_id: newMovement.id,
      newData: newMovement,
      observation: `Movimentação Manual (${validated.movement_type}): ${qty > 0 ? '+' : ''}${qty} unid.`
    })

    revalidatePath("/movimentacoes")
    revalidatePath("/estoque")
    revalidatePath("/dashboard")
    return { success: true, data: newMovement }
  } catch (error: any) {
    console.error("Create Movement Error:", error)
    return { success: false, error: error.message || "Erro ao registrar movimentação" }
  }
}
