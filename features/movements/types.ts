import { Database } from "@/types/supabase"

export type StockMovement = Database["public"]["Tables"]["stock_movements"]["Row"]
export type MovementType = Database["public"]["Enums"]["movement_type_enum"]

// Custom type to include related data usually fetched via joins
export type StockMovementWithRelations = StockMovement & {
  product?: {
    name: string
    sku: string | null
    category_id: string | null
  }
  performed_by_user?: {
    full_name: string
    email: string
  }
  location?: {
    name: string
  }
}

export interface MovementFilters {
  page: number
  perPage: number
  search?: string
  type?: MovementType | "all"
  startDate?: string
  endDate?: string
  productId?: string
  categoryId?: string
}
