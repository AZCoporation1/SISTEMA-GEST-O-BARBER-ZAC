import { Database } from "@/types/supabase"

export type CommissionEntry = Database["public"]["Tables"]["commission_entries"]["Row"]
export type CommissionProfile = Database["public"]["Tables"]["commission_profiles"]["Row"]
export type CommissionRule = Database["public"]["Tables"]["commission_rules"]["Row"]
export type CommissionPeriod = Database["public"]["Tables"]["commission_periods"]["Row"]

export type CommissionEntryWithRelations = CommissionEntry & {
  collaborator?: { name: string } | null
  sale?: { sale_date: string; total: number | null } | null
}

export interface CommissionFilters {
  collaboratorId?: string
  month?: string  // YYYY-MM
  status?: string
  page: number
  perPage: number
}
