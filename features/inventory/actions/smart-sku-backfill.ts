// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { logAudit } from "@/features/audit/actions/audit.actions"
import { isValidSmartSKU, formatSmartSKU, SmartSKUPrefix } from "@/features/inventory/utils/code-parser"

/**
 * Determines the Smart SKU prefix for a given category name.
 */
function resolvePrefix(categoryName: string | null | undefined): SmartSKUPrefix {
  if (!categoryName) return 'INSU'
  const lower = categoryName.toLowerCase().trim()

  // PERF — Perfumaria
  if (lower.includes('perfum') || lower.includes('fragranc') || lower.includes('amadeirad')
    || lower.includes('oriental') || lower.includes('floral') || lower.includes('aromátic')
    || lower.includes('fougère') || lower.includes('bergamot') || lower.includes('baunilha')
    || lower.includes('especiad') || lower.includes('bolso') || lower.includes('cabelo')
    || lower.includes('frutado') || lower.includes('gourmet')) {
    return 'PERF'
  }

  // BEBI — Bebidas e Conveniência
  if (lower.includes('bebid') || lower.includes('refrigerant') || lower.includes('energétic')
    || lower.includes('água') || lower.includes('cervej') || lower.includes('conveniênc')
    || lower.includes('coca') || lower.includes('suco')) {
    return 'BEBI'
  }

  // Everything else → INSU
  return 'INSU'
}

/**
 * Backfill existing products with Smart SKU external_codes.
 * 
 * Rules:
 * 1. If external_code is already a valid Smart SKU → KEEP IT
 * 2. If external_code is empty/null/legacy → assign new Smart SKU
 * 3. Prefix determined by category name
 * 4. Sequential numbers within each prefix family, ordered by product name
 * 5. Idempotent — safe to run multiple times
 * 6. Never duplicates codes
 */
export async function backfillSmartSKUs() {
  const supabase = await createServerClient()

  try {
    // 1. Read all active products with their categories
    const { data: products, error: prodError } = await supabase
      .from("inventory_products")
      .select("id, external_code, name, normalized_name, category_id, is_for_resale, is_for_internal_use")
      .is("deleted_at", null)
      .order("name")

    if (prodError) throw prodError
    if (!products || products.length === 0) {
      return { success: true, message: "Nenhum produto encontrado para backfill.", updated: 0 }
    }

    // 2. Read categories
    const { data: categories } = await supabase
      .from("inventory_categories")
      .select("id, name")

    const categoryMap = new Map<string, string>()
    if (categories) {
      categories.forEach((c: any) => categoryMap.set(c.id, c.name))
    }

    // 3. Separate products into those that need migration vs those already valid
    const alreadyValid: string[] = [] // external_codes already taken
    const needsMigration: Array<{ id: string; name: string; categoryName: string | null; prefix: SmartSKUPrefix }> = []

    for (const p of products) {
      if (p.external_code && isValidSmartSKU(p.external_code)) {
        alreadyValid.push(p.external_code.toUpperCase().trim())
      } else {
        const catName = p.category_id ? categoryMap.get(p.category_id) || null : null
        const prefix = resolvePrefix(catName)
        needsMigration.push({
          id: p.id,
          name: p.name,
          categoryName: catName,
          prefix
        })
      }
    }

    if (needsMigration.length === 0) {
      return { success: true, message: "Todos os produtos já possuem Smart SKU válido.", updated: 0 }
    }

    // 4. Find the highest existing number for each prefix to avoid collisions
    const maxNumbers: Record<SmartSKUPrefix, number> = { PERF: 0, BEBI: 0, INSU: 0 }
    for (const code of alreadyValid) {
      const match = code.match(/^(PERF|BEBI|INSU)\s+(\d+)$/i)
      if (match) {
        const prefix = match[1].toUpperCase() as SmartSKUPrefix
        const num = parseInt(match[2], 10)
        if (num > maxNumbers[prefix]) {
          maxNumbers[prefix] = num
        }
      }
    }

    // 5. Assign new codes sequentially per prefix, sorted by name within each group
    const grouped: Record<SmartSKUPrefix, typeof needsMigration> = { PERF: [], BEBI: [], INSU: [] }
    needsMigration.forEach(p => grouped[p.prefix].push(p))

    const updates: Array<{ id: string; external_code: string }> = []
    const warnings: string[] = []

    for (const prefix of ['PERF', 'BEBI', 'INSU'] as SmartSKUPrefix[]) {
      const group = grouped[prefix].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      let counter = maxNumbers[prefix]

      for (const product of group) {
        counter++
        const newCode = formatSmartSKU(prefix, counter)
        
        // Safety: check for collision (should not happen given maxNumbers logic)
        if (alreadyValid.includes(newCode.toUpperCase())) {
          warnings.push(`Colisão evitada para ${product.name}: ${newCode} já existe. Pulando.`)
          continue
        }

        updates.push({ id: product.id, external_code: newCode })
        alreadyValid.push(newCode.toUpperCase())
      }
    }

    // 6. Apply updates one-by-one to respect unique constraint safely
    let successCount = 0
    const errors: string[] = []

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from("inventory_products")
        .update({ external_code: update.external_code })
        .eq("id", update.id)

      if (updateError) {
        errors.push(`Falha ao atualizar ${update.external_code}: ${updateError.message}`)
      } else {
        successCount++
      }
    }

    // 7. Audit log
    await logAudit({
      action: 'UPDATE',
      entity: 'inventory_products',
      entity_id: 'smart_sku_backfill',
      newData: { updated: successCount, errors: errors.length, warnings: warnings.length },
      observation: `Backfill Smart SKU concluído. ${successCount} produtos atualizados.`
    })

    return {
      success: true,
      message: `Backfill concluído: ${successCount} produtos atualizados.`,
      updated: successCount,
      warnings,
      errors
    }
  } catch (error: any) {
    console.error("Smart SKU Backfill Error:", error)
    return { success: false, error: error.message || "Erro no backfill de Smart SKU." }
  }
}
