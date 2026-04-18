"use server"

import { createServerClient } from "@/lib/supabase/server"
import { logAudit } from "@/features/audit/actions/audit.actions"
import { resolveUserProfileId } from "@/lib/supabase/resolve-user"

export async function processServicesImport(data: any[]) {
  const supabase = await createServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

  let inserted = 0
  let updated = 0
  const errors: string[] = []

  // Ensure categories are pre-fetched or created on the fly
  const { data: categoriesData } = await supabase.from("service_categories").select("id, normalized_name")
  const categoryMap = new Map((categoriesData || []).map((c: any) => [c.normalized_name, c.id]))

  for (const [index, row] of data.entries()) {
    try {
      const name = row["Descrição"] || row["Nome"] || row["name"]
      if (!name) continue // ignore empty lines

      let price = parseFloat(String(row["Valor"] || "0").replace(/[^0-9,-]+/g,"").replace(",", "."))
      if (isNaN(price)) price = 0

      let duration = parseInt(String(row["Tempo"] || "30").replace(/[^0-9]+/g,""))
      if (isNaN(duration)) duration = 30

      let commissionStr = String(row["Comissão"] || "0").replace("%", "").replace(",", ".")
      let commission = parseFloat(commissionStr)
      if (isNaN(commission)) commission = 0

      const rawCategory = typeof row["Categoria"] === 'string' ? row["Categoria"].trim() : null
      let categoryId = null

      if (rawCategory) {
        const normCat = rawCategory.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        if (categoryMap.has(normCat)) {
          categoryId = categoryMap.get(normCat)
        } else {
          // create category
          const { data: newCat } = await (supabase as any).from("service_categories").insert({
            name: rawCategory,
            normalized_name: normCat,
            is_active: true
          }).select().single()
          if (newCat) {
            categoryId = newCat.id
            categoryMap.set(normCat, newCat.id)
          }
        }
      }

      let is_active = true
      const rawAvailable = String(row["Disponível"] || row["Ativo"] || '').toLowerCase()
      if (rawAvailable === "não" || rawAvailable === "nao" || rawAvailable === "false" || rawAvailable === "0") {
         is_active = false
      }

      const normalizedName = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

      const payload = {
        name,
        normalized_name: normalizedName,
        price,
        duration_minutes: duration,
        commission_percent: commission,
        category_id: categoryId,
        is_active,
        is_bookable: true,
        show_price: true,
        simultaneous_slots: 1,
        price_type: "fixed"
      }

      // Check if service already exists
      const { data: existing } = await (supabase as any).from("services").select("id").eq("normalized_name", normalizedName).maybeSingle()

      if (existing) {
        // Update
        const { error } = await (supabase as any).from("services").update(payload).eq("id", existing.id)
        if (error) throw error
        updated++
      } else {
        // Insert
        const { error } = await (supabase as any).from("services").insert({ ...payload, created_by: userProfileId })
        if (error) throw error
        inserted++
      }

    } catch (err: any) {
      errors.push(`Linha ${index + 2} (${row["Descrição"] || 'Sem Nome'}): ${err.message}`)
    }
  }

  await logAudit({
    action: "IMPORT",
    entity: "services",
    entity_id: "batch",
    observation: `Importação em lote de serviços via planilha. Inseridos: ${inserted}, Atualizados: ${updated}, Erros: ${errors.length}`
  })

  return { success: true, inserted, updated, errors }
}
