// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { saleSchema, SaleFormValues } from "../validators"
import { revalidatePath } from "next/cache"
import { Database } from "@/types/supabase"
import { logAudit } from "@/features/audit/actions/audit.actions"
import { resolveUserProfileId } from "@/lib/supabase/resolve-user"

export async function processSale(data: SaleFormValues) {
  const supabase = await createServerClient()
  const rollbacks: Array<() => Promise<void>> = []

  try {
    const validated = saleSchema.parse(data)
    
    // Auth context
    const { data: authData } = await supabase.auth.getUser()

    // 0. FAIL-FAST: Check cash session BEFORE creating anything
    const { data: activeSession } = await supabase
      .from("cash_sessions")
      .select("id")
      .eq("status", "open")
      .single()

    if (!activeSession) {
      return { 
        success: false, 
        error: "Operação bloqueada: Não há um caixa aberto no momento. Abra o caixa antes de realizar vendas no PDV." 
      }
    }
    
    // Calculate totals
    const subtotal = validated.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0)
    const total = subtotal - validated.discount_amount

    // Resolve user profile ID for FK fields
    const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

    // Resolve Customer Name for Snapshot & Log Description
    let finalCustomerNameSnapshot: string | null = null;
    let humanReadableCustomer = "";

    if (validated.customer_id) {
      const { data: customer } = await supabase.from("customers").select("full_name, phone, mobile_phone").eq("id", validated.customer_id).single()
      if (customer) {
        finalCustomerNameSnapshot = customer.full_name
        humanReadableCustomer = ` - ${customer.full_name}`
        // Optionally capture phone snapshot too, if desired
      }
    } else if (validated.customer_name_override) {
      finalCustomerNameSnapshot = validated.customer_name_override
      humanReadableCustomer = ` - Cliente avulso: ${validated.customer_name_override}`
    }

    // 1. Create Sale Record — DO NOT send `total` (it's GENERATED ALWAYS)
    const { data: newSale, error: saleError } = await supabase
      .from("sales")
      .insert({
        customer_id: validated.customer_id || null,
        customer_name_snapshot: finalCustomerNameSnapshot,
        collaborator_id: validated.collaborator_id || null,
        payment_method_id: validated.payment_method_id,
        discount_amount: validated.discount_amount,
        subtotal: subtotal,
        // total is GENERATED ALWAYS AS (subtotal - discount_amount) — do NOT send
        status: "completed",
        sale_date: new Date().toISOString(),
        notes: validated.notes,
        created_by: userProfileId,
      })
      .select()
      .single()

    if (saleError) throw saleError

    // Add rollback function for Sale
    rollbacks.push(async () => {
      await supabase.from("sales").delete().eq("id", newSale.id)
    })

    // 2. Insert Sale Items — DO NOT send `total` (it's GENERATED ALWAYS)
    const itemsToInsert = validated.items.map(item => ({
      sale_id: newSale.id,
      item_type: item.type,
      product_id: item.type === "product" ? item.productId : null,
      service_id: item.type === "service" ? item.serviceId || null : null,
      service_name: item.type === "service" ? item.name : null,
      quantity: item.quantity,
      unit_price_snapshot: item.unitPrice,
      unit_cost_snapshot: item.unitCost,
      discount_amount: item.discount,
      // total is GENERATED ALWAYS AS ((quantity * unit_price_snapshot) - discount_amount) — do NOT send
    }))

    const { data: insertedItems, error: itemsError } = await supabase
      .from("sale_items")
      .insert(itemsToInsert)
      .select("id")

    if (itemsError) {
      console.error("Failed to insert sale items, orphaned sale created.", itemsError)
      throw new Error("Erro ao inserir itens da venda: " + itemsError.message)
    }

    rollbacks.push(async () => {
      const itemIds = insertedItems.map((i: any) => i.id)
      if (itemIds.length > 0) {
        await supabase.from("sale_items").delete().in("id", itemIds)
      }
    })

    // 3. For Product Items: stock_movements are created automatically by DB trigger
    //    (trg_sale_item_stock_movement -> log_sale_to_stock_movement)
    //    No need to insert manually — the trigger handles it.

    // 4. Register Cash Entry
    const { data: insertedCash, error: cashError } = await supabase.from("cash_entries").insert({
      cash_session_id: activeSession.id,
      entry_type: "sale_income",
      amount: total,
      category: "Venda (PDV)",
      description: `Venda #${newSale.id.split('-')[0]}${humanReadableCustomer}`,
      payment_method_id: validated.payment_method_id,
      reference_type: "sale",
      reference_id: newSale.id,
      occurred_at: newSale.sale_date,
      created_by: userProfileId,
    }).select("id").single()
    
    if (cashError) {
        console.error("Failed to insert cash entry:", cashError)
        throw new Error("Erro ao lançar no caixa: " + cashError.message)
    }
    
    rollbacks.push(async () => {
      await supabase.from("cash_entries").delete().eq("id", insertedCash.id)
    })

    // 5. Register corresponding Financial Flow entry
    const { data: insertedFin, error: financialError } = await supabase.from("financial_movements").insert({
      movement_type: "received" as any,
      amount: total,
      category: "Vendas",
      subcategory: "PDV",
      description: `Receita Venda #${newSale.id.split('-')[0]}${humanReadableCustomer}`,
      occurred_on: newSale.sale_date,
      origin_type: "sale",
      origin_id: newSale.id
    }).select("id").single()
    
    if (financialError) {
       console.error("Failed to insert financial movement:", financialError)
       throw new Error("Erro ao lançar no fluxo financeiro: " + financialError.message)
    }
    
    rollbacks.push(async () => {
      await supabase.from("financial_movements").delete().eq("id", insertedFin.id)
    })

    // 6. Audit Log
    await logAudit({
      action: 'INSERT',
      entity: 'sales',
      entity_id: newSale.id,
      newData: newSale,
      observation: `Venda registrada. Total: R$ ${total.toFixed(2)} (${validated.items.length} itens)`
    })

    revalidatePath("/vendas")
    revalidatePath("/estoque")
    revalidatePath("/caixa")
    revalidatePath("/dashboard")
    revalidatePath("/fluxo-de-caixa")
    return { success: true, data: newSale }
  } catch (error: any) {
    console.error("Process Sale Error, starting rollback:", error)
    
    // Execute rollbacks in reverse order
    for (let i = rollbacks.length - 1; i >= 0; i--) {
      try {
        await rollbacks[i]()
      } catch (rbError) {
        console.error("Falha no rollback. Inconsistência possível no banco:", rbError)
      }
    }

    return { success: false, error: error.message || "Erro ao processar venda no PDV" }
  }
}
