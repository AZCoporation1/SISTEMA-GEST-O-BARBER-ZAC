// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { ImportedProductRow } from "../types"
import { logAudit } from "@/features/audit/actions/audit.actions"
import { resolveUserProfileId } from "@/lib/supabase/resolve-user"

/**
 * Perform a server-side bulk upsert for importing products from spreadsheet.
 * Tries to match by `external_code`. If exists, updates; if not, inserts.
 *
 * CRITICAL COST POLICY:
 * - If incoming cost_price is 0 and product already exists → preserve existing cost_price
 * - If incoming cost_price is 0 and product is new → cost_price stays 0 (flagged for manual review)
 * - Never infer cost from sale price
 *
 * MAX STOCK SAFETY:
 * - If max_stock is 0 or less → fallback to Math.max(min_stock + 1, 10)
 */
export async function importProducts(rows: ImportedProductRow[]) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: "Usuário não autenticado." }
  }

  try {
    // 1. Resolve Categories
    const { data: categories } = await supabase.from("inventory_categories").select("id, name")
    let categoryMap = new Map<string, string>()
    if (categories) {
       for (const cat of categories) categoryMap.set(cat.name.toLowerCase().trim(), cat.id)
    }

    // 2. Resolve Brands
    const { data: brands } = await supabase.from("product_brands").select("id, name")
    let brandMap = new Map<string, string>()
    if (brands) {
       for (const b of brands) brandMap.set(b.name.toLowerCase().trim(), b.id)
    }

    // Auto-create missing categories and brands
    for (const row of rows) {
      const catKey = row.categoria.toLowerCase().trim()
      if (catKey && catKey !== 'sem categoria' && !categoryMap.has(catKey)) {
        const { data: newCat } = await supabase.from("inventory_categories").insert({
          name: row.categoria,
          normalized_name: row.categoria.toLowerCase().trim(),
          is_active: true,
          sort_order: 0
        }).select().single()
        if (newCat) categoryMap.set(catKey, newCat.id)
      }

      if (row.marca) {
        const brandKey = row.marca.toLowerCase().trim()
        if (brandKey && !brandMap.has(brandKey)) {
          const { data: newBrand } = await supabase.from("product_brands").insert({
            name: row.marca,
            normalized_name: row.marca.toLowerCase().trim(),
            is_active: true
          }).select().single()
          if (newBrand) brandMap.set(brandKey, newBrand.id)
        }
      }
    }

    // Resolve user profile for performed_by
    const userProfileId = await resolveUserProfileId(supabase, user.id)

    // 3. Fetch existing products by external_code for cost preservation
    const existingCodes = rows.map(r => r.codigo).filter(Boolean)
    const { data: existingProducts } = await supabase
      .from("inventory_products")
      .select("id, external_code, cost_price")
      .in("external_code", existingCodes)

    const existingCostMap = new Map<string, number>()
    if (existingProducts) {
      existingProducts.forEach((p: any) => {
        if (p.external_code) {
          existingCostMap.set(p.external_code.toUpperCase().trim(), p.cost_price || 0)
        }
      })
    }

    // Determine resale/internal flags by prefix
    const resolveFlags = (code: string) => {
      const upper = code.toUpperCase().trim()
      if (upper.startsWith('PERF')) return { is_for_resale: true, is_for_internal_use: false }
      if (upper.startsWith('BEBI')) return { is_for_resale: true, is_for_internal_use: false }
      // INSU varies — default both true for new products
      return { is_for_resale: true, is_for_internal_use: true }
    }

    // Prepare upsert payload
    const upsertData = rows.map(r => {
      // MAX STOCK SAFETY — ensure it's never 0 or less
      let safeMaxStock = r.estoque_maximo
      if (!safeMaxStock || safeMaxStock <= 0) {
        safeMaxStock = Math.max((r.estoque_minimo || 0) + 1, 10)
      }
      // Ensure max > min
      if (safeMaxStock <= (r.estoque_minimo || 0)) {
        safeMaxStock = (r.estoque_minimo || 0) + 1
      }

      // COST PRESERVATION — if incoming cost is 0 and product exists, keep existing
      let costPrice = r.custo || 0
      if (costPrice === 0) {
        const existingCost = existingCostMap.get(r.codigo.toUpperCase().trim())
        if (existingCost && existingCost > 0) {
          costPrice = existingCost
        }
      }

      const flags = resolveFlags(r.codigo)

      return {
        external_code: r.codigo,
        name: r.nome_produto,
        normalized_name: r.nome_produto.toLowerCase().trim(),
        category_id: categoryMap.get(r.categoria.toLowerCase().trim()) || null,
        brand_id: r.marca ? brandMap.get(r.marca.toLowerCase().trim()) || null : null,
        cost_price: costPrice,
        markup_percent: r.markup || 0,
        min_stock: r.estoque_minimo || 0,
        max_stock: safeMaxStock,
        is_for_resale: flags.is_for_resale,
        is_for_internal_use: flags.is_for_internal_use,
        is_active: r.status === "Ativo",
        unit_type: 'UN'
      }
    })

    const { data: upsertedProducts, error: upsertError } = await supabase
      .from("inventory_products")
      .upsert(upsertData, { onConflict: 'external_code', ignoreDuplicates: false })
      .select("id, external_code")

    if (upsertError) throw upsertError

    // Ledger Handling: Compute balance difference via stock_movements
    const productIds = upsertedProducts.map((p: any) => p.id)
    const { data: positions } = await supabase
      .from("vw_inventory_position")
      .select("product_id, current_balance")
      .in("product_id", productIds)
      
    const positionMap = new Map<string, number>()
    if (positions) {
      positions.forEach((p: any) => positionMap.set(p.product_id, p.current_balance))
    }

    const movementPayloads = []
    for (const row of rows) {
      const dbProduct = upsertedProducts.find((p: any) => p.external_code === row.codigo)
      if (!dbProduct) continue

      const rawBalance = row.saldo_atual

      const isInvalid = 
        rawBalance === undefined || 
        rawBalance === null || 
        rawBalance === "" || 
        (typeof rawBalance === 'string' && rawBalance.trim() === "") ||
        isNaN(Number(rawBalance));

      const targetBalance = isInvalid ? (positionMap.get(dbProduct.id) || 0) : Number(rawBalance);
      const currentBalance = positionMap.get(dbProduct.id) || 0;
      const diff = targetBalance - currentBalance;

      if (diff !== 0 && !isNaN(diff) && isFinite(diff)) {
        movementPayloads.push({
          product_id: dbProduct.id,
          movement_type: diff > 0 ? (currentBalance === 0 ? "initial_balance" : "manual_adjustment_in") : "manual_adjustment_out",
          movement_reason: "Ajuste via Planilha/Importação",
          source_type: "import_wizard",
          destination_type: "inventory",
          quantity: diff,
          performed_by: userProfileId,
          movement_date: new Date().toISOString(),
          notes: `Sincronização Bulk. Saldo desejado: ${targetBalance}`
        })
      }
    }

    if (movementPayloads.length > 0) {
      const { error: moveError } = await supabase
        .from("stock_movements")
        .insert(movementPayloads)

      if (moveError) throw moveError
    }

    await logAudit({
      action: 'IMPORT',
      entity: 'inventory_products',
      entity_id: 'bulk_import',
      newData: { upserted_rows: upsertData.length, generated_movements: movementPayloads.length },
      observation: `Importação em lote via planilha. ${upsertData.length} produtos sincronizados, ${movementPayloads.length} ajustes gerados.`
    })

    return { success: true, count: upsertedProducts.length }
    
  } catch (error: any) {
    console.error("Import upsert error:", error)
    return { success: false, error: error.message || "Falha desconhecida no upsert." }
  }
}
