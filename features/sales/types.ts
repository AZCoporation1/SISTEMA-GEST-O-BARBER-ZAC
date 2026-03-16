import { Database } from "@/types/supabase"

export type Sale = Database["public"]["Tables"]["sales"]["Row"]
export type SaleItem = Database["public"]["Tables"]["sale_items"]["Row"]

export type SaleWithRelations = Sale & {
  items: SaleItem[]
  collaborator?: { full_name: string } | null
  customer?: { full_name: string } | null
  payment_method?: { name: string } | null
}

export interface SalesFilters {
  page: number
  perPage: number
  search?: string
  startDate?: string
  endDate?: string
  status?: string
}

export type CartItem = {
  id: string; // temp id for cart
  type: 'product' | 'service';
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unitCost: number; // Snapshot for history
  discount: number;
}
