// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { productSchema, ProductFormValues } from "../validators"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/features/audit/actions/audit.actions"
import { resolveUserProfileId } from "@/lib/supabase/resolve-user"

export async function createProduct(data: ProductFormValues) {
  try {
    const validated = productSchema.parse(data)
    const supabase = await createServerClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data: newProduct, error } = await supabase
      .from("inventory_products")
      .insert({
        external_code: validated.external_code,
        name: validated.name,
        normalized_name: validated.name.toLowerCase().trim(),
        category_id: validated.category_id,
        brand_id: (validated.brand_id === "none" || !validated.brand_id) ? null : validated.brand_id,
        cost_price: validated.cost_price,
        markup_percent: validated.markup_percent,
        min_stock: validated.min_stock,
        max_stock: validated.max_stock,
        is_for_resale: validated.is_for_resale,
        is_for_internal_use: validated.is_for_internal_use,
        notes: validated.notes,
        is_active: true,
        unit_type: 'UN' // Default for MVP
      })
      .select()
      .single()

    if (error) throw error

    if (validated.initial_quantity && validated.initial_quantity > 0) {
      let userProfileId = null
      if (user) {
        userProfileId = await resolveUserProfileId(supabase, user.id)
      }

      const { error: stockError } = await supabase
        .from("stock_movements")
        .insert({
          product_id: newProduct.id,
          movement_type: "initial_balance",
          movement_reason: "Saldo Inicial Cadastrado",
          source_type: "system",
          destination_type: "inventory",
          quantity: validated.initial_quantity,
          unit_cost_snapshot: newProduct.cost_price,
          unit_sale_snapshot: newProduct.sale_price_generated,
          total_cost_snapshot: newProduct.cost_price * validated.initial_quantity,
          total_sale_snapshot: newProduct.sale_price_generated * validated.initial_quantity,
          performed_by: userProfileId,
          movement_date: new Date().toISOString(),
          notes: "Gerado pelo cadastro de produto"
        })
      if (stockError) throw stockError
      
      await logAudit({
          action: 'INSERT',
          entity: 'stock_movements',
          entity_id: newProduct.id,
          observation: `Saldo inicial gerado: ${validated.initial_quantity}`
      })
    }

    await logAudit({
      action: 'INSERT',
      entity: 'inventory_products',
      entity_id: newProduct.id,
      newData: newProduct,
      observation: `Produto cadastrado: ${validated.name} (R$ ${validated.cost_price.toFixed(2)})`
    })

    revalidatePath("/estoque")
    return { success: true, data: newProduct }
  } catch (error: any) {
    console.error("Create Product Error:", error)
    if (error.code === '23505' || error.message?.includes('external_code_key')) {
      return { success: false, error: "Já existe um produto ou variação cadastrado com este código. Por favor, utilize um código único." }
    }
    return { success: false, error: error.message || "Erro ao criar produto" }
  }
}

export async function updateProduct(id: string, data: ProductFormValues) {
  try {
    const validated = productSchema.parse(data)
    const supabase = await createServerClient()

    const { data: updatedProduct, error } = await supabase
      .from("inventory_products")
      .update({
        external_code: validated.external_code,
        name: validated.name,
        normalized_name: validated.name.toLowerCase().trim(),
        category_id: validated.category_id,
        brand_id: (validated.brand_id === "none" || !validated.brand_id) ? null : validated.brand_id,
        cost_price: validated.cost_price,
        markup_percent: validated.markup_percent,
        min_stock: validated.min_stock,
        max_stock: validated.max_stock,
        is_for_resale: validated.is_for_resale,
        is_for_internal_use: validated.is_for_internal_use,
        notes: validated.notes,
      })
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    await logAudit({
      action: 'UPDATE',
      entity: 'inventory_products',
      entity_id: id,
      newData: updatedProduct,
      observation: `Produto alterado: ${validated.name}`
    })

    revalidatePath("/estoque")
    return { success: true, data: updatedProduct }
  } catch (error: any) {
    console.error("Update Product Error:", error)
    if (error.code === '23505' || error.message?.includes('external_code_key')) {
      return { success: false, error: "Já existe outro produto cadastrado com este código. Por favor, utilize um código único." }
    }
    return { success: false, error: error.message || "Erro ao atualizar produto" }
  }
}

export async function toggleProductStatus(id: string, currentStatus: boolean) {
  try {
    const supabase = await createServerClient()
    const { error } = await supabase
      .from("inventory_products")
      .update({ is_active: !currentStatus })
      .eq("id", id)

    if (error) throw error

    await logAudit({
      action: 'UPDATE',
      entity: 'inventory_products',
      entity_id: id,
      observation: `Status do produto alterado para ${!currentStatus ? 'Ativo' : 'Inativo'}`
    })

    revalidatePath("/estoque")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getProductCodesAction() {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    const { data, error } = await supabase
      .from("inventory_products")
      .select("id, external_code")
      
    if (error) throw error
    
    return { success: true, data }
  } catch (error: any) {
    console.error("Error fetching codes via service role:", error)
    return { success: false, data: [] }
  }
}
