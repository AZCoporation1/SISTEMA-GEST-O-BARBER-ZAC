import { createClient } from "@/lib/supabase/client"
import type { CommissionEntryRow, CollaboratorRow, VwCommissionSummaryRow } from "@/types/supabase"
import type { CommissionFilters, CommissionEntryWithRelations } from "../types"

export async function getCommissionEntries(filters: CommissionFilters) {
  const supabase = createClient()

  let query = supabase
    .from("commission_entries")
    .select(`
      *,
      collaborator:collaborator_id (name),
      sale:sale_id (sale_date, total)
    `, { count: "exact" })

  if (filters.collaboratorId) {
    query = query.eq("collaborator_id", filters.collaboratorId)
  }
  if (filters.month) {
    const start = new Date(`${filters.month}-01`)
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)
    query = query.gte("competence_date", start.toISOString())
                 .lt("competence_date", end.toISOString())
  }
  if (filters.status) {
    query = query.eq("status", filters.status)
  }

  const from = (filters.page - 1) * filters.perPage
  const to = from + filters.perPage - 1

  query = query.range(from, to).order("competence_date", { ascending: false })

  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { data: (data || []) as any as CommissionEntryWithRelations[], count: count || 0 }
}

export async function getCommissionSummary() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("vw_commission_summary")
    .select("*")
    .order("month", { ascending: false })
    .limit(12)

  if (error) throw new Error(error.message)
  return data as unknown as VwCommissionSummaryRow[]
}

export async function getCollaborators() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("collaborators")
    .select("id, name")
    .eq("is_active", true)
    .order("name")
  if (error) throw error
  return data as unknown as Pick<CollaboratorRow, 'id' | 'name'>[]
}
