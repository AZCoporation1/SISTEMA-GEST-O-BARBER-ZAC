import { createClient } from "@/lib/supabase/client"
import type { SaleRow, PaymentMethodRow, CustomerRow, CollaboratorRow } from "@/types/supabase"
import type { SalesFilters, SaleWithRelations } from "../types"

export async function getSales(filters: SalesFilters) {
  const supabase = createClient()
  
  let query = supabase
    .from("sales")
    .select(`
      *,
      items:sale_items (*),
      collaborator:collaborator_id (name),
      customer:customer_id (full_name),
      payment_method:payment_method_id (name)
    `, { count: "exact" })

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status)
  }
  if (filters.startDate) {
    query = query.gte("sale_date", filters.startDate)
  }
  if (filters.endDate) {
    query = query.lte("sale_date", filters.endDate)
  }

  const from = (filters.page - 1) * filters.perPage
  const to = from + filters.perPage - 1
  
  query = query.range(from, to).order("created_at", { ascending: false })

  const { data, error, count } = await query

  if (error) {
    console.error("Error fetching sales:", error)
    throw new Error(error.message)
  }

  return {
    data: data as any as SaleWithRelations[],
    count: count || 0
  }
}

// [PERF/B4] Select only columns used by POSView dropdowns
export async function getPaymentMethods() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, name, is_active")
    .eq("is_active", true)
    .order("name")
  
  if (error) throw new Error(error.message)
  return (data || []) as Pick<PaymentMethodRow, 'id' | 'name' | 'is_active'>[]
}

// [PERF/B4] Select only columns used by POSView customer dropdown
export async function getCustomers() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("customers")
    .select("id, full_name")
    .order("full_name")
  
  if (error) throw new Error(error.message)
  return (data || []) as Pick<CustomerRow, 'id' | 'full_name'>[]
}

// [PERF/B4] Select only columns used by POSView collaborator dropdown
export async function getCollaborators() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("collaborators")
    .select("id, name, is_active")
    .eq("is_active", true)
    .order("name")
  
  if (error) throw new Error(error.message)
  return (data || []) as Pick<CollaboratorRow, 'id' | 'name' | 'is_active'>[]
}
