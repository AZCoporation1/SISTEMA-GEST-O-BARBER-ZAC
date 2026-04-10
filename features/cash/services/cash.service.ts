import { createClient } from "@/lib/supabase/client"
import type { CashSessionRow, CashEntryRow, PaymentMethodRow } from "@/types/supabase"
import type { CashFilters, CashSessionWithRelations } from "../types"

export async function getActiveCashSession() {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from("cash_sessions")
    .select(`
      *,
      opened_by_user:opened_by (full_name),
      closed_by_user:closed_by (full_name),
      entries:cash_entries (
        *,
        payment_method:payment_method_id (name)
      )
    `)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching active cash session:", error)
    throw new Error(error.message)
  }

  return data as CashSessionWithRelations | null
}

export async function getCashSessions(filters: CashFilters) {
  const supabase = createClient()
  
  let query = supabase
    .from("cash_sessions")
    .select(`
      *,
      opened_by_user:opened_by (full_name),
      closed_by_user:closed_by (full_name)
    `, { count: "exact" })

  if (filters.date) {
    const start = new Date(filters.date)
    start.setHours(0,0,0,0)
    const end = new Date(filters.date)
    end.setHours(23,59,59,999)
    query = query.gte("opened_at", start.toISOString()).lte("opened_at", end.toISOString())
  }

  const from = (filters.page - 1) * filters.perPage
  const to = from + filters.perPage - 1
  
  query = query.range(from, to).order("opened_at", { ascending: false })

  const { data, error, count } = await query

  if (error) {
    console.error("Error fetching cash sessions:", error)
    throw new Error(error.message)
  }

  return {
    data: data as any as CashSessionWithRelations[],
    count: count || 0
  }
}

export async function getPaymentMethods() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("payment_methods")
    .select("*")
    .eq("is_active", true)
    
  if (error) throw error
  return data as unknown as PaymentMethodRow[]
}
