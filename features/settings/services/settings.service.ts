// @ts-nocheck
"use server"
import { createServerClient } from "@/lib/supabase/server"
import { AppSettings } from "../types"

export async function getSettings() {
  const supabase = await createServerClient()
  
  // Since there's usually only one settings row per organization, we can just grab the first one
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 is no rows
    console.error("Error fetching settings:", error)
    throw new Error(error.message)
  }

  // Return default fallbacks if no row exists yet
  if (!data) {
    return {
      organization_name: "Barber Zac",
      currency: "BRL",
      timezone: "America/Sao_Paulo",
      default_markup: 60,
      low_stock_alert_enabled: true,
      critical_stock_alert_enabled: true,
      ai_enabled: true,
    } as AppSettings
  }

  return data as AppSettings
}
