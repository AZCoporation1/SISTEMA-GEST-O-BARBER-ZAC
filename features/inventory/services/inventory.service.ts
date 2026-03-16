// @ts-nocheck
"use server"
import { createServerClient } from "@/lib/supabase/server"
import { Product, ProductWithRelations, InventoryPosition, InventoryFilters } from "../types"

export async function getInventoryPositions(filters: InventoryFilters) {
  const supabase = await createServerClient()
  
  let query = supabase.from("vw_inventory_position").select("*", { count: "exact" })

  if (filters.search) {
    query = query.ilike("product_name", `%${filters.search}%`)
  }
  if (filters.categoryId) {
    query = query.eq("category_id", filters.categoryId)
  }
  if (filters.status && filters.status !== "all") {
    query = query.eq("stock_status", filters.status)
  }

  // Pagination
  const from = (filters.page - 1) * filters.perPage
  const to = from + filters.perPage - 1
  
  query = query.range(from, to).order("product_name")

  const { data, error, count } = await query

  if (error) {
    console.error("Error fetching inventory positions:", error)
    throw new Error(error.message)
  }

  return {
    data: data as InventoryPosition[],
    count: count || 0
  }
}

export async function getProductById(id: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("inventory_products")
    .select(`*, category:category_id(*), brand:brand_id(*)`)
    .eq("id", id)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as ProductWithRelations
}

export async function getCategories() {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("inventory_categories")
    .select("*")
    .eq("is_active", true)
    .order("name")
    
  if (error) throw new Error(error.message)
  return data
}

export async function getBrands() {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("product_brands")
    .select("*")
    .eq("is_active", true)
    .order("name")
    
  if (error) throw new Error(error.message)
  return data
}
