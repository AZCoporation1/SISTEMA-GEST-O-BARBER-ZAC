import { createClient } from "@/lib/supabase/client"
import type { StockMovementRow } from "@/types/supabase"
import type { MovementFilters, StockMovementWithRelations } from "../types"

export async function getStockMovements(filters: MovementFilters) {
  const supabase = createClient()
  
  let query = supabase
    .from("stock_movements")
    .select(`
      *,
      product:product_id (
        name,
        sku,
        category_id
      ),
      performed_by_user:performed_by (
        full_name,
        email
      ),
      location:location_id (
        name
      )
    `, { count: "exact" })

  if (filters.type && filters.type !== "all") {
    query = query.eq("movement_type", filters.type)
  }
  if (filters.productId) {
    query = query.eq("product_id", filters.productId)
  }
  if (filters.startDate) {
    query = query.gte("movement_date", filters.startDate)
  }
  if (filters.endDate) {
    query = query.lte("movement_date", filters.endDate)
  }

  const from = (filters.page - 1) * filters.perPage
  const to = from + filters.perPage - 1
  
  query = query.range(from, to).order("created_at", { ascending: false })

  const { data, error, count } = await query

  if (error) {
    console.error("Error fetching stock movements:", error)
    throw new Error(error.message)
  }

  let filteredData = data as any as StockMovementWithRelations[]
  if (filters.search) {
    const term = filters.search.toLowerCase()
    filteredData = filteredData.filter(m => 
      m.product?.name?.toLowerCase().includes(term) || 
      (m.notes && m.notes.toLowerCase().includes(term)) ||
      (m.movement_reason && m.movement_reason.toLowerCase().includes(term))
    )
  }

  return {
    data: filteredData,
    count: count || 0
  }
}
