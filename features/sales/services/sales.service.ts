// @ts-nocheck
"use server"
import { createServerClient } from "@/lib/supabase/server"
import { SalesFilters, SaleWithRelations } from "../types"
import { Database } from "@/types/supabase"

export async function getSales(filters: SalesFilters) {
  const supabase = await createServerClient()
  
  let query = supabase
    .from("sales")
    .select(`
      *,
      items:sale_items (*),
      collaborator:collaborator_id (full_name),
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

  // search locally after fetch for MVP due to relation search complexity
  
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

export async function getPaymentMethods() {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("payment_methods")
    .select("*")
    .eq("is_active", true)
    .order("name")
  
  if (error) throw new Error(error.message)
  return data
}

export async function getCustomers() {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("full_name")
  
  if (error) throw new Error(error.message)
  return data
}

export async function getCollaborators() {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("collaborators")
    .select("*")
    .eq("is_active", true)
    .order("name")
  
  if (error) throw new Error(error.message)
  return data
}
