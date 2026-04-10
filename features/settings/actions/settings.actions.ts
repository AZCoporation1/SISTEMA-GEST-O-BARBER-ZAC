// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { settingsSchema, SettingsFormValues } from "../validators"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/features/audit/actions/audit.actions"

export async function updateSettings(data: SettingsFormValues) {
  try {
    const validated = settingsSchema.parse(data)
    const supabase = await createServerClient()

    // Get existing settings to know its ID, or insert if none exists
    const { data: existing } = await supabase.from("app_settings").select("id, organization_name").limit(1).single()

    let result;
    const oldName = existing?.organization_name || null

    if (existing) {
      const { data: updated, error } = await supabase
        .from("app_settings")
        .update({
          organization_name: validated.organization_name,
          currency: validated.currency,
          timezone: validated.timezone,
          default_markup: validated.default_markup,
          low_stock_alert_enabled: validated.low_stock_alert_enabled,
          critical_stock_alert_enabled: validated.critical_stock_alert_enabled,
          ai_enabled: validated.ai_enabled,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id)
        .select()
        .single()

      if (error) throw error
      result = updated
    } else {
      const { data: inserted, error } = await supabase
        .from("app_settings")
        .insert({
          organization_name: validated.organization_name,
          currency: validated.currency,
          timezone: validated.timezone,
          default_markup: validated.default_markup,
          low_stock_alert_enabled: validated.low_stock_alert_enabled,
          critical_stock_alert_enabled: validated.critical_stock_alert_enabled,
          ai_enabled: validated.ai_enabled,
        })
        .select()
        .single()

      if (error) throw error
      result = inserted
    }

    // Audit log for settings changes
    await logAudit({
      action: 'UPDATE',
      entity: 'app_settings',
      entity_id: result?.id || 'settings',
      oldData: oldName !== validated.organization_name ? { organization_name: oldName } : null,
      newData: result,
      observation: `Configurações atualizadas. Nome: "${validated.organization_name}"`
    })

    // Revalidate ALL layout paths so the name update propagates everywhere
    revalidatePath("/", "layout")
    revalidatePath("/configuracoes")
    revalidatePath("/dashboard")

    return { success: true, data: result }
  } catch (error: any) {
    console.error("Update Settings Error:", error)
    return { success: false, error: error.message || "Erro ao salvar configurações" }
  }
}
