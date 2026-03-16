// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { productSchema, ProductFormValues } from "../validators"
import { revalidatePath } from "next/cache"

export async function createProduct(data: ProductFormValues) {
  try {
    const validated = productSchema.parse(data)
    const supabase = await createServerClient()
    
    const { data: newProduct, error } = await supabase
      .from("inventory_products")
      .insert({
        name: validated.name,
        normalized_name: validated.name.toLowerCase().trim(),
        category_id: validated.category_id,
        brand_id: validated.brand_id || null,
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

    revalidatePath("/estoque")
    return { success: true, data: newProduct }
  } catch (error: any) {
    console.error("Create Product Error:", error)
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
        name: validated.name,
        normalized_name: validated.name.toLowerCase().trim(),
        category_id: validated.category_id,
        brand_id: validated.brand_id || null,
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

    revalidatePath("/estoque")
    return { success: true, data: updatedProduct }
  } catch (error: any) {
    console.error("Update Product Error:", error)
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

    revalidatePath("/estoque")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
