// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { ImportedProductRow } from "../types"
import { createAuditLog } from "@/features/ai-operator/services/ai.service"

/**
 * Perform a server-side bulk upsert for importing products from spreadsheet.
 * Tries to match by `code`. If exists, updates; if not, inserts.
 */
export async function importProducts(rows: ImportedProductRow[]) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: "Usuário não autenticado." }
  }

  try {
    // Need category IDs mapping
    const { data: categories } = await supabase.from("inventory_categories").select("id, name")
    let categoryMap = new Map<string, string>()
    
    // Auto-create missing categories just in case
    for (const row of rows) {
      if (!categoryMap.has(row.categoria.toLowerCase())) {
        const existingCat = categories?.find(c => c.name.toLowerCase() === row.categoria.toLowerCase())
        if (existingCat) {
          categoryMap.set(row.categoria.toLowerCase(), existingCat.id)
        } else {
          // Create new category
          const { data: newCat } = await supabase.from("inventory_categories").insert({
            name: row.categoria,
            description: "Categoria importada via planilha"
          }).select().single()
          if (newCat) {
             categoryMap.set(row.categoria.toLowerCase(), newCat.id)
             categories?.push(newCat) // pseudo-cache update
          }
        }
      }
    }

    const upsertData = rows.map(r => ({
      code: r.codigo,
      name: r.nome_produto,
      category_id: categoryMap.get(r.categoria.toLowerCase()) || null,
      brand: r.marca || null,
      cost_price: r.custo,
      markup_percentage: r.markup,
      sell_price: r.preco_venda,
      qty_min: r.estoque_minimo,
      qty_max: r.estoque_maximo,
      qty_current: r.saldo_atual,
      // Default false for auto_reorder for imported ones
      auto_reorder: false,
      status: r.status === "Ativo" ? "active" : "inactive"
    }))

    // Upserting requires unique constraint on code, which is set in DB schema.
    const { data, error } = await supabase
      .from("inventory_products")
      .upsert(upsertData, { onConflict: 'code', ignoreDuplicates: false })
      .select()

    if (error) {
      throw error
    }

    await createAuditLog(
      "inventory_products", 
      "bulk", 
      "import_upsert", 
      null, 
      { num_rows: upsertData.length }
    )

    return { success: true, count: data.length }
    
  } catch (error: any) {
    console.error("Import upsert error:", error)
    return { success: false, error: error.message || "Falha desconhecida no upsert." }
  }
}
