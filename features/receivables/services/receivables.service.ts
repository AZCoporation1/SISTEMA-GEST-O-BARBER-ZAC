// @ts-nocheck
import { createClient } from "@/lib/supabase/client"
import type { ReceivableWithRelations, ReceivableFilters } from "../types"

export async function getReceivablesClient(filters: ReceivableFilters) {
  const supabase = createClient()
  const page = filters.page || 1
  const perPage = filters.perPage || 20

  let query = supabase
    .from("accounts_receivable")
    .select(`
      *,
      customer:customer_id (full_name, phone, mobile_phone),
      professional:professional_id (name)
    `, { count: "exact" })

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status)
  }
  if (filters.customerId) {
    query = query.eq("customer_id", filters.customerId)
  }
  if (filters.professionalId) {
    query = query.eq("professional_id", filters.professionalId)
  }
  if (filters.startDate) {
    query = query.gte("due_date", filters.startDate)
  }
  if (filters.endDate) {
    query = query.lte("due_date", filters.endDate)
  }
  if (filters.search) {
    query = query.or(`customer_name_snapshot.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
  }

  const from = (page - 1) * perPage
  const to = from + perPage - 1
  query = query.range(from, to).order("due_date", { ascending: true })

  const { data, error, count } = await query

  if (error) {
    console.error("Error fetching receivables:", error)
    throw new Error(error.message)
  }

  return {
    data: (data || []) as unknown as ReceivableWithRelations[],
    count: count || 0,
  }
}

export async function getReceivableSummaryClient() {
  const supabase = createClient()
  const today = new Date().toISOString().split("T")[0]
  const monthStart = today.substring(0, 7) + "-01"

  const { data: openData } = await supabase
    .from("accounts_receivable")
    .select("amount, amount_paid")
    .in("status", ["open", "partial", "overdue"])

  const totalOpen = (openData || []).reduce((sum, r) => sum + (Number(r.amount) - Number(r.amount_paid)), 0)

  const { data: overdueData } = await supabase
    .from("accounts_receivable")
    .select("amount, amount_paid")
    .in("status", ["open", "partial"])
    .lt("due_date", today)

  const totalOverdue = (overdueData || []).reduce((sum, r) => sum + (Number(r.amount) - Number(r.amount_paid)), 0)

  const { data: dueTodayData } = await supabase
    .from("accounts_receivable")
    .select("amount, amount_paid")
    .in("status", ["open", "partial"])
    .eq("due_date", today)

  const { data: receivedData } = await supabase
    .from("accounts_receivable_payments")
    .select("amount")
    .eq("status", "active")
    .gte("paid_at", monthStart)

  const receivedThisMonth = (receivedData || []).reduce((sum, r) => sum + Number(r.amount), 0)

  const { count } = await supabase
    .from("accounts_receivable")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "partial", "overdue"])

  return {
    totalOpen,
    totalOverdue,
    dueTodayCount: dueTodayData?.length || 0,
    dueTodayAmount: (dueTodayData || []).reduce((sum, r) => sum + (Number(r.amount) - Number(r.amount_paid)), 0),
    receivedThisMonth,
    totalReceivables: count || 0,
  }
}

export async function getCustomersList() {
  const supabase = createClient()
  const { data } = await supabase.from("customers").select("id, full_name").order("full_name")
  return data || []
}

export async function getCollaboratorsList() {
  const supabase = createClient()
  const { data } = await supabase.from("collaborators").select("id, name").eq("is_active", true).order("name")
  return data || []
}
