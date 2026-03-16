import { Database } from "@/types/supabase"

export type CashSession = Database["public"]["Tables"]["cash_sessions"]["Row"]
export type CashEntry = Database["public"]["Tables"]["cash_entries"]["Row"]

export type CashEntryWithRelations = CashEntry & {
  payment_method?: { name: string } | null
  created_user?: { full_name: string } | null
}

export type CashSessionWithRelations = CashSession & {
  opened_by_user?: { full_name: string } | null
  closed_by_user?: { full_name: string } | null
  entries?: CashEntryWithRelations[]
}

export interface CashFilters {
  page: number
  perPage: number
  sessionId?: string
  date?: string
}
