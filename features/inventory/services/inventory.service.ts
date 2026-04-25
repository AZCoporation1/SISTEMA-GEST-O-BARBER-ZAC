import { createClient } from "@/lib/supabase/client"
import type { VwInventoryPositionRow, InventoryCategoryRow, ProductBrandRow } from "@/types/supabase"

export interface InventoryFilters {
  search?: string
  categoryId?: string
  brandId?: string
  skuFamily?: string   // 'PERF' | 'BEBI' | 'INSU' | undefined
  status?: string
  page?: number
  perPage?: number      // 0 or undefined = fetch all (client-side pagination)
}

export async function getInventoryPositions(filters: InventoryFilters) {
  const supabase = createClient()
  
  let query = supabase.from("vw_inventory_position").select("*", { count: "exact" })

  // Text search — product name OR external_code
  if (filters.search) {
    query = query.or(`product_name.ilike.%${filters.search}%,external_code.ilike.%${filters.search}%`)
  }

  // Category filter — the view has `category_name`, NOT `category_id`.
  // We resolve the ID → name, then filter by `category_name`.
  if (filters.categoryId) {
    const { data: cat } = await supabase
      .from("inventory_categories")
      .select("name")
      .eq("id", filters.categoryId)
      .single() as { data: any }

    if (cat?.name) {
      query = query.eq("category_name", cat.name)
    }
  }

  // Brand filter — the view has `brand_name`, NOT `brand_id`.
  // We resolve the ID → name, then filter by `brand_name`.
  if (filters.brandId) {
    const { data: brand } = await supabase
      .from("product_brands")
      .select("name")
      .eq("id", filters.brandId)
      .single() as { data: any }

    if (brand?.name) {
      query = query.eq("brand_name", brand.name)
    }
  }

  // Smart SKU family filter — prefix-based
  if (filters.skuFamily) {
    query = query.ilike("external_code", `${filters.skuFamily}%`)
  }

  // Stock status filter — map UI values to DB values
  if (filters.status && filters.status !== "all") {
    switch (filters.status) {
      case "active":
        query = query.eq("is_active", true)
        break
      case "inactive":
        query = query.eq("is_active", false)
        break
      case "low_stock":
        query = query.eq("stock_status", "abaixo_do_minimo")
        break
      case "out_of_stock":
        query = query.eq("stock_status", "sem_estoque")
        break
      default:
        // For any raw stock_status value passed directly
        query = query.eq("stock_status", filters.status)
    }
  }

  // Server-side pagination: only apply .range() if perPage > 0
  // When perPage is 0 or undefined, fetch ALL matching items for client-side pagination
  if (filters.perPage && filters.perPage > 0 && filters.page) {
    const from = (filters.page - 1) * filters.perPage
    const to = from + filters.perPage - 1
    query = query.range(from, to)
  }
  
  // Sort by external_code for Smart SKU organization, then by product_name
  query = query.order("external_code", { ascending: true, nullsFirst: false }).order("product_name")

  const { data, error, count } = await query

  if (error) {
    console.error("Error fetching inventory positions:", error)
    throw new Error(error.message)
  }

  // Map resale/internal flags from the products table (not in the view)
  const posData = (data || []) as any[]
  if (posData.length > 0) {
    const productIds = posData.map(d => d.product_id)
    const { data: prodFlags } = await supabase
      .from("inventory_products")
      .select("id, is_for_resale, is_for_internal_use")
      .in("id", productIds)
      
    if (prodFlags) {
      const flagMap = new Map((prodFlags as any[]).map(p => [p.id, p]))
      posData.forEach(d => {
        const f = flagMap.get(d.product_id)
        if (f) {
          d.is_for_resale = f.is_for_resale
          d.is_for_internal_use = f.is_for_internal_use
        }
      })
    }
  }

  return {
    data: posData as unknown as VwInventoryPositionRow[],
    count: count || 0
  }
}

export async function getProductById(id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("inventory_products")
    .select(`*, category:category_id(*), brand:brand_id(*)`)
    .eq("id", id)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as any
}

/**
 * Returns only active categories that have at least one non-deleted product.
 * This eliminates ghost categories from the dropdown.
 */
export async function getCategories() {
  const supabase = createClient()

  // Get IDs of categories actually referenced by products
  const { data: usedCats } = await supabase
    .from("inventory_products")
    .select("category_id")
    .not("category_id", "is", null)
    .is("deleted_at", null)

  const usedCatIds = [...new Set((usedCats || []).map((r: any) => r.category_id).filter(Boolean))]

  if (usedCatIds.length === 0) {
    return [] as InventoryCategoryRow[]
  }

  const { data, error } = await supabase
    .from("inventory_categories")
    .select("*")
    .eq("is_active", true)
    .in("id", usedCatIds)
    .order("name")
    
  if (error) throw new Error(error.message)
  return data as unknown as InventoryCategoryRow[]
}

/**
 * Returns only active brands that have at least one non-deleted product.
 * This eliminates ghost brands and dirty entries from the dropdown.
 */
export async function getBrands() {
  const supabase = createClient()

  // Get IDs of brands actually referenced by products
  const { data: usedBrands } = await supabase
    .from("inventory_products")
    .select("brand_id")
    .not("brand_id", "is", null)
    .is("deleted_at", null)

  const usedBrandIds = [...new Set((usedBrands || []).map((r: any) => r.brand_id).filter(Boolean))]

  if (usedBrandIds.length === 0) {
    return [] as ProductBrandRow[]
  }

  const { data, error } = await supabase
    .from("product_brands")
    .select("*")
    .eq("is_active", true)
    .in("id", usedBrandIds)
    .order("name")
    
  if (error) throw new Error(error.message)
  return data as unknown as ProductBrandRow[]
}
