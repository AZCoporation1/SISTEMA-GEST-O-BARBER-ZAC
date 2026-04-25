import type { VwInventoryPositionRow, InventoryProductRow, InventoryCategoryRow, ProductBrandRow } from "@/types/supabase"

export type Product = InventoryProductRow
export type Category = InventoryCategoryRow
export type Brand = ProductBrandRow

export type ProductWithRelations = Product & {
  category?: Category | null
  brand?: Brand | null
}

export type InventoryPosition = VwInventoryPositionRow

export interface InventoryFilters {
  search?: string
  categoryId?: string
  brandId?: string
  skuFamily?: string
  status?: "all" | "active" | "inactive" | "low_stock" | "out_of_stock" | "sem_estoque" | "abaixo_do_minimo" | "acima_do_maximo" | "normal"
  page?: number
  perPage?: number
}
