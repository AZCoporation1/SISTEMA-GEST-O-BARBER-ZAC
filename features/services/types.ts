import { ServiceRow, ServiceCategoryRow } from "@/types/supabase"

export type ServiceNode = ServiceRow & {
  category?: Pick<ServiceCategoryRow, "id" | "name"> | null
}

export interface ServicesFetchParams {
  search?: string
  status?: "all" | "active" | "inactive"
  categoryId?: string
  page?: number
  perPage?: number
}

export interface ServicesListResponse {
  data: ServiceNode[]
  count: number
  page: number
  perPage: number
  totalPages: number
}
