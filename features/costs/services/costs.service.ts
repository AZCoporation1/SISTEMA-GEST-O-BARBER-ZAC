// @ts-nocheck
"use server"
import { createServerClient } from "@/lib/supabase/server"
import { CostFilters, FixedCost, VariableCost } from "../types"

// DB table: fixed_costs (not monthly_fixed_costs)
export async function getFixedCosts(filters: CostFilters) {
  const supabase = await createServerClient()
  
  let query = supabase
    .from("fixed_costs")
    .select("*", { count: "exact" })
    .is("deleted_at" as any, null)

  if (filters.search) {
    query = query.ilike("name", `%${filters.search}%`)
  }
  
  const from = (filters.page - 1) * filters.perPage
  const to = from + filters.perPage - 1
  
  query = (query as any).range(from, to).order("due_day", { ascending: true, nullsFirst: false })

  const { data, error, count } = await query

  if (error) {
    console.error("Error fetching fixed costs:", error)
    throw new Error(error.message)
  }

  return {
    data: data as FixedCost[],
    count: count || 0
  }
}

// DB table: variable_costs
export async function getVariableCosts(filters: CostFilters) {
  const supabase = await createServerClient()
  
  let query = supabase
    .from("variable_costs")
    .select("*", { count: "exact" })

  if (filters.search) {
    query = query.ilike("name", `%${filters.search}%`)
  }
  
  const from = (filters.page - 1) * filters.perPage
  const to = from + filters.perPage - 1
  
  query = query.range(from, to).order("occurred_on", { ascending: false })

  const { data, error, count } = await query

  if (error) {
    console.error("Error fetching variable costs:", error)
    throw new Error(error.message)
  }

  return {
    data: data as VariableCost[],
    count: count || 0
  }
}
