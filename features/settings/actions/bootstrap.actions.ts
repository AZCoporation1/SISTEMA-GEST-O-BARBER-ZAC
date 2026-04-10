// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { logAudit } from "@/features/audit/actions/audit.actions"

/**
 * Idempotent bootstrap for required payment methods.
 * Called from admin/settings/go-live — NEVER from sales hot path.
 *
 * If payment_methods table has any active records, does nothing.
 * If empty, inserts the 4 standard methods.
 */
export async function ensureRequiredPaymentMethods() {
  const supabase = await createServerClient()

  try {
    // Check if payment methods already exist
    const { data: existing, error: checkError } = await supabase
      .from("payment_methods")
      .select("id")
      .eq("is_active", true)
      .limit(1)

    if (checkError) throw checkError

    if (existing && existing.length > 0) {
      return {
        success: true,
        message: "Formas de pagamento já existem. Nenhuma ação necessária.",
        seeded: false
      }
    }

    // Insert the 4 standard payment methods
    const methods = [
      { name: "Dinheiro", is_active: true },
      { name: "Pix", is_active: true },
      { name: "Cartão de Débito", is_active: true },
      { name: "Cartão de Crédito", is_active: true },
    ]

    const { error: insertError } = await supabase
      .from("payment_methods")
      .insert(methods)

    if (insertError) throw insertError

    await logAudit({
      action: 'INSERT',
      entity: 'payment_methods',
      entity_id: 'bootstrap',
      newData: { methods: methods.map(m => m.name) },
      observation: "Bootstrap: formas de pagamento padrão inseridas (Dinheiro, Pix, Débito, Crédito)."
    })

    return {
      success: true,
      message: "Formas de pagamento padrão inseridas com sucesso.",
      seeded: true
    }
  } catch (error: any) {
    console.error("Bootstrap Payment Methods Error:", error)
    return { success: false, error: error.message || "Erro ao inserir formas de pagamento." }
  }
}
