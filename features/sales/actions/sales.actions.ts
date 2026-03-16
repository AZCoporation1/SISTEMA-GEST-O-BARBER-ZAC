// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { saleSchema, SaleFormValues } from "../validators"
import { revalidatePath } from "next/cache"
import { Database } from "@/types/supabase"

export async function processSale(data: SaleFormValues) {
  try {
    const validated = saleSchema.parse(data)
    const supabase = await createServerClient()
    
    // Auth context
    const { data: authData } = await supabase.auth.getUser()
    
    // Calculate totals
    const subtotal = validated.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0)
    const total = subtotal - validated.discount_amount

    // 1. Create Sale Record
    const { data: newSale, error: saleError } = await supabase
      .from("sales")
      .insert({
        customer_id: validated.customer_id || null,
        collaborator_id: validated.collaborator_id || null,
        payment_method_id: validated.payment_method_id,
        discount_amount: validated.discount_amount,
        subtotal: subtotal,
        total: total,
        status: "completed",
        sale_date: new Date().toISOString(),
        notes: validated.notes,
        created_by: authData.user?.id || null,
      })
      .select()
      .single()

    if (saleError) throw saleError

    // 2. Insert Sale Items
    const itemsToInsert = validated.items.map(item => ({
      sale_id: newSale.id,
      item_type: item.type,
      product_id: item.type === "product" ? item.productId : null,
      service_name: item.type === "service" ? item.name : null,
      quantity: item.quantity,
      unit_price_snapshot: item.unitPrice,
      unit_cost_snapshot: item.unitCost,
      discount_amount: item.discount,
      total: (item.quantity * item.unitPrice) - item.discount
    }))

    const { error: itemsError } = await supabase
      .from("sale_items")
      .insert(itemsToInsert)

    if (itemsError) {
      // In a robust system this would be a transaction or RPC call to rollback, but for MVP we log it
      console.error("Failed to insert sale items, orphaned sale created.", itemsError)
      throw itemsError
    }

    // 3. For Products: Trigger stock movement (-quantity). 
    //    Database trigger (`trg_after_sale_item_insert`) can handle this, OR we do it application-side. 
    //    The implementation plan specifies trigger usage where possible, but doing it in code is safer for UI feedback if trigger isn't perfect yet.
    //    Let's rely on the DB trigger as specced in Phase 3. If it fails, the item insert would have failed (since it's in the DB).

    // 4. Register Cash Entry if it's paid (which it is, status=completed)
    // Find active cash session
    const { data: activeSession } = await supabase
      .from("cash_sessions")
      .select("id")
      .eq("status", "open")
      .single()

    if (activeSession) {
      await supabase.from("cash_entries").insert({
        cash_session_id: activeSession.id,
        entry_type: "sale_income",
        amount: total,
        category: "Venda (PDV)",
        description: `Venda #${newSale.id.split('-')[0]}`,
        payment_method_id: validated.payment_method_id,
        reference_type: "sale",
        reference_id: newSale.id,
        occurred_at: newSale.sale_date,
        created_by: authData.user?.id || null,
      })
    }

    // 5. Register corresponding Financial Flow entry
    await supabase.from("financial_movements").insert({
      movement_type: "income",
      amount: total,
      category: "Vendas",
      subcategory: "PDV",
      description: `Receita Venda #${newSale.id.split('-')[0]}`,
      occurred_on: newSale.sale_date,
      origin_type: "sale",
      origin_id: newSale.id
    })

    // 6. Generate Commission Entries (Basic MVP implementation)
    // Triggers could also handle this, but the logic is easier to manage in app code.
    if (validated.collaborator_id) {
       // Just a stub for future extension:
       // The actual Commission Engine (Module 8) would run here or via a cron/webhook that processes closed sales.
       // For now, we will just let Module 8 handle its own rules later.
    }

    revalidatePath("/vendas")
    revalidatePath("/estoque")
    revalidatePath("/caixa")
    return { success: true, data: newSale }
  } catch (error: any) {
    console.error("Process Sale Error:", error)
    return { success: false, error: error.message || "Erro ao processar venda no PDV" }
  }
}
