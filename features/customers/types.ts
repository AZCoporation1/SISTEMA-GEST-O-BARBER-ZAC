import { CustomerRow } from "@/types/supabase"

export type CustomerNode = CustomerRow

export interface CustomersFetchParams {
  page?: number
  perPage?: number
  search?: string
  status?: "all" | "active" | "inactive"
}

export interface CustomersListResponse {
  data: CustomerNode[]
  count: number
  page: number
  perPage: number
  totalPages: number
}
