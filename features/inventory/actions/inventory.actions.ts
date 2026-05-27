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

async function getProductDependencySummary(supabase: any, productId: string) {
  const tables = [
    { name: 'stock_movements', column: 'product_id' },
    { name: 'stock_adjustments', column: 'product_id' },
    { name: 'sale_items', column: 'product_id' },
    { name: 'perfume_sales', column: 'inventory_product_id' },
    { name: 'reception_advances', column: 'product_id' },
    { name: 'professional_advances', column: 'product_id' },
    { name: 'purchase_order_items', column: 'product_id' },
    { name: 'commission_rules', column: 'product_id' },
    { name: 'professional_requests', column: 'inventory_product_id' },
    { name: 'appointment_command_items', column: 'product_id' },
  ]
  
  const counts: Record<string, number> = {}
  
  await Promise.all(
    tables.map(async (t) => {
      const { count, error } = await supabase
        .from(t.name)
        .select('id', { count: 'exact', head: true })
        .eq(t.column, productId)
      
      if (error) {
        console.error(`Error counting dependencies in table ${t.name}:`, error)
        counts[t.name] = 0
      } else {
        counts[t.name] = count || 0
      }
    })
  )
  
  return counts
}

export async function getProductDependencySummaryAction(productId: string) {
  try {
    const supabase = await createServerClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "Usuário não autenticado." }
    }
    
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, system_role")
      .eq("auth_user_id", user.id)
      .single()
      
    const isAdmin = profile && (profile.role === 'admin' || profile.role === 'gestor' || profile.system_role === 'admin_total' || profile.system_role === 'owner_admin_professional')
    if (!isAdmin) {
      return { success: false, error: "Acesso negado. Apenas administradores/donos podem consultar dependências." }
    }
    
    const summary = await getProductDependencySummary(supabase, productId)
    return { success: true, data: summary }
  } catch (error: any) {
    console.error("Error in getProductDependencySummaryAction:", error)
    return { success: false, error: error.message || "Erro ao obter dependências." }
  }
}

export async function forceDeleteProductAction(productId: string, reason: string) {
  try {
    const supabase = await createServerClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "Usuário não autenticado." }
    }
    
    const { data: profile, error: profileErr } = await supabase
      .from("user_profiles")
      .select("role, system_role")
      .eq("auth_user_id", user.id)
      .single()
      
    if (profileErr || !profile) {
      return { success: false, error: "Perfil do usuário não encontrado." }
    }
    
    const isAdmin = profile.role === 'admin' || profile.role === 'gestor' || profile.system_role === 'admin_total' || profile.system_role === 'owner_admin_professional'
    if (!isAdmin) {
      return { success: false, error: "Acesso negado. Apenas administradores/donos podem excluir produtos definitivamente." }
    }
    
    const userProfileId = await resolveUserProfileId(supabase, user.id)
    
    const { data: product, error: productErr } = await supabase
      .from("inventory_products")
      .select("*")
      .eq("id", productId)
      .single()
      
    if (productErr || !product) {
      return { success: false, error: "Produto não encontrado." }
    }
    
    const summary = await getProductDependencySummary(supabase, productId)
    const hasHistory = Object.values(summary).reduce((acc, count) => acc + count, 0) > 0
    const modeStr = hasHistory ? 'forced_archive' : 'hard_delete'
    
    const snapshotData = {
      original_product_id: productId,
      product_snapshot: product,
      deletion_mode: modeStr,
      reason: reason || null,
      dependency_summary: summary,
      deleted_by: userProfileId,
      deleted_at: new Date().toISOString()
    }
    
    const { data: snapshot, error: snapErr } = await supabase
      .from("inventory_product_deletion_snapshots")
      .insert(snapshotData)
      .select()
      .single()
      
    if (snapErr) {
      console.error("Error creating deletion snapshot:", snapErr)
      throw new Error(`Falha ao registrar snapshot de exclusão: ${snapErr.message}`)
    }
    
    let mode: 'hard_delete' | 'forced_archive' = 'hard_delete'
    let updatedProduct = null
    
    if (!hasHistory) {
      const { error: deleteErr } = await supabase
        .from("inventory_products")
        .delete()
        .eq("id", productId)
        
      if (deleteErr) {
        console.warn("Physical delete failed. Falling back to operational delete:", deleteErr.message)
        mode = 'forced_archive'
      } else {
        mode = 'hard_delete'
      }
    } else {
      mode = 'forced_archive'
    }
    
    if (mode === 'forced_archive') {
      const { data: updated, error: updateErr } = await supabase
        .from("inventory_products")
        .update({
          is_deleted: true,
          is_active: false,
          deleted_at: new Date().toISOString(),
          deleted_by: userProfileId,
          deletion_reason: reason || null,
          deletion_mode: 'forced_archive',
          deleted_snapshot_id: snapshot.id
        })
        .eq("id", productId)
        .select()
        .single()
        
      if (updateErr) {
        throw new Error(`Falha ao realizar a exclusão operacional forçada: ${updateErr.message}`)
      }
      updatedProduct = updated
    }
    
    await logAudit({
      action: 'DELETE',
      entity: 'inventory_products',
      entity_id: productId,
      oldData: product,
      newData: updatedProduct,
      observation: `Exclusão definitiva. Modo: ${mode}. Motivo: ${reason || "Não informado"}. Dependências: ${JSON.stringify(summary)}`
    })
    
    revalidatePath("/estoque")
    return {
      success: true,
      mode: mode,
      message: "Produto excluído definitivamente do estoque operacional."
    }
  } catch (error: any) {
    console.error("Error in forceDeleteProductAction:", error)
    return { success: false, error: error.message || "Erro ao excluir produto." }
  }
}

