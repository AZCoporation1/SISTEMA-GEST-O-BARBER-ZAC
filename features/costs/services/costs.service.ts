import { createClient } from "@/lib/supabase/client"
import type { FixedCostRow, VariableCostRow } from "@/types/supabase"
import type { CostFilters } from "../types"

export async function getFixedCosts(filters: CostFilters) {
  const supabase = createClient()
  
  let query = supabase
    .from("fixed_costs")
    .select("*", { count: "exact" })

  if (filters.search) {
    query = query.ilike("name", `%${filters.search}%`)
  }
  
  const from = (filters.page - 1) * filters.perPage
  const to = from + filters.perPage - 1
  
  query = query.range(from, to).order("due_day", { ascending: true, nullsFirst: false })

  const { data, error, count } = await query

  if (error) {
    console.error("Error fetching fixed costs:", error)
    throw new Error(error.message)
  }

  return {
    data: (data || []) as unknown as FixedCostRow[],
    count: count || 0
  }
}

export async function getVariableCosts(filters: CostFilters) {
  const supabase = createClient()
  
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
    data: (data || []) as unknown as VariableCostRow[],
    count: count || 0
  }
}
