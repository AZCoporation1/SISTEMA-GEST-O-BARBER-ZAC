import { Database } from "@/types/supabase"

export type AppSettings = Database["public"]["Tables"]["app_settings"]["Row"]
