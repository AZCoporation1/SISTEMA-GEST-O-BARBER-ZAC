import { createClient } from "@/lib/supabase/client"
import type { AppSettingsRow } from "@/types/supabase"

export async function getSettings(): Promise<AppSettingsRow> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error("Error fetching settings:", error)
    throw new Error(error.message)
  }

  if (!data) {
    return {
      id: '',
      organization_name: "Barber Zac",
      currency: "BRL",
      timezone: "America/Sao_Paulo",
      default_markup: 60,
      low_stock_alert_enabled: true,
      critical_stock_alert_enabled: true,
      ai_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  return data as unknown as AppSettingsRow
}
