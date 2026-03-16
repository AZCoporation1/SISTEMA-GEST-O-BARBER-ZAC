import { Database } from "@/types/supabase"

export type Product = Database["public"]["Tables"]["inventory_products"]["Row"]
export type Category = Database["public"]["Tables"]["inventory_categories"]["Row"]
export type Brand = Database["public"]["Tables"]["product_brands"]["Row"]

export type ProductWithRelations = Product & {
  category?: Category | null
  brand?: Brand | null
}

export type InventoryPosition = Database["public"]["Views"]["vw_inventory_position"]["Row"]

export interface InventoryFilters {
  search?: string
  categoryId?: string
  brandId?: string
  status?: "all" | "active" | "inactive" | "low_stock" | "out_of_stock"
  page: number
  perPage: number
}
