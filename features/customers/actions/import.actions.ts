"use server"

import { createServerClient } from "@/lib/supabase/server"
import { logAudit } from "@/features/audit/actions/audit.actions"
import { revalidatePath } from "next/cache"

export async function importCustomersBatch(records: any[]) {
  try {
    const supabase = await createServerClient()
    
    let imported = 0
    let updated = 0
    let skipped = 0

    for (const record of records) {
      // Basic normalizations
      const rawFullName = record['Nome'] || record['nome'] || record['Nome Completo'] || 'Sem Nome'
      const normalizedName = rawFullName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
      const mobile_phone = record['Celular']?.toString().replace(/\D/g, '') || null
      const cpf = record['CPF']?.toString().replace(/\D/g, '') || null
      const email = record['Email']?.toString().toLowerCase().trim() || record['e-mail']?.toString().toLowerCase().trim() || null

      const getSafeDate = (d: any) => {
        if (!d) return null
        const val = new Date(d)
        return isNaN(val.getTime()) ? null : val.toISOString()
      }

      const payload = {
        full_name: rawFullName,
        normalized_name: normalizedName,
        mobile_phone,
        email,
        cpf,
        birth_date: getSafeDate(record['Data Nascimento'] || record['Nascimento'] || record['Aniversario']),
        address_line: record['Endereço'] || record['endereco'] || null,
        address_number: record['Número'] || record['numero'] || null,
        complement: record['Complemento'] || record['complemento'] || null,
        neighborhood: record['Bairro'] || record['bairro'] || null,
        city: record['Cidade'] || record['cidade'] || null,
        state: record['Estado'] || record['UF'] || record['uf'] || null,
        postal_code: record['CEP']?.toString().replace(/\D/g, '') || null,
        referral_source: record['ComoSoube'] || record['origem'] || null,
        legacy_login: record['Login'] || record['login'] || null,
        notes: record['Observação'] || record['obs'] || null,
        is_active: true
      }

      // Deduplication rules
      let matchQuery: any = supabase.from("customers").select("id").limit(1)

      if (cpf) {
        matchQuery = matchQuery.eq("cpf", cpf)
      } else if (mobile_phone && mobile_phone.length >= 10) {
        matchQuery = matchQuery.eq("mobile_phone", mobile_phone)
      } else if (email) {
        matchQuery = matchQuery.eq("email", email)
      } else {
        matchQuery = matchQuery.eq("normalized_name", normalizedName)
        if (mobile_phone) {
           matchQuery = matchQuery.eq("mobile_phone", mobile_phone)
        }
      }

      const { data: existingMatch, error: matchError } = await matchQuery

      if (existingMatch && existingMatch.length > 0) {
        // Update existing
        const targetId = existingMatch[0].id
        const { error: updateError } = await (supabase as any).from("customers").update(payload).eq("id", targetId)
        if (!updateError) {
          updated++
          // Fast-path audit to save time, could be optimized as batch but it's okay for typical spreadsheet sizes
          await logAudit({
            action: 'UPDATE',
            entity: 'customers',
            entity_id: targetId,
            observation: `Cliente atualizado via importação (Planilha)`
          })
        } else {
          skipped++
        }
      } else {
        // Insert new
        const { data: inserted, error: insertError } = await (supabase as any).from("customers").insert(payload).select("id").single()
        if (!insertError) {
          imported++
          await logAudit({
            action: 'INSERT',
            entity: 'customers',
            entity_id: inserted.id,
            observation: `Cliente importado via Planilha`
          })
        } else {
          skipped++
        }
      }
    }

    revalidatePath("/clientes")
    return { success: true, imported, updated, skipped }
  } catch (err: any) {
    console.error("Import error:", err)
    return { success: false, error: err.message || "Erro na importação em lote." }
  }
}
