// @ts-nocheck
"use client"

import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

/**
 * Fetch perfume sales with filters, pagination, and joins
 */
export async function fetchPerfumeSales(params: {
  page?: number
  perPage?: number
  search?: string
  status?: string
  professionalId?: string
  startDate?: string
  endDate?: string
}) {
  const { page = 1, perPage = 20, search, status, professionalId, startDate, endDate } = params

  let query = supabase
    .from('perfume_sales')
    .select(`
      *,
      professional:collaborators(name, display_name),
      customer:customers(full_name, mobile_phone),
      installments:perfume_sale_installments(*)
    `, { count: 'exact' })
    .order('sale_date', { ascending: false })

  if (search) {
    query = query.or(`perfume_name_snapshot.ilike.%${search}%,customer_name_snapshot.ilike.%${search}%`)
  }
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  if (professionalId) {
    query = query.eq('professional_id', professionalId)
  }
  if (startDate) {
    query = query.gte('sale_date', startDate)
  }
  if (endDate) {
    query = query.lte('sale_date', endDate)
  }

  const from = (page - 1) * perPage
  const to = from + perPage - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) throw error

  return {
    data: data || [],
    count: count || 0,
    page,
    perPage,
    totalPages: Math.ceil((count || 0) / perPage),
  }
}

/**
 * Fetch perfume-eligible products from inventory
 * Priority: Smart SKU prefix PERF, then perfumaria category, then all resale products
 */
export async function fetchPerfumeProducts() {
  // First try PERF SKU prefix
  const { data: perfProducts } = await supabase
    .from('inventory_products')
    .select('id, name, external_code, sku, cost_price, sale_price_generated, sale_price_cash, sale_price_installment, is_active, is_for_resale, category_id')
    .eq('is_active', true)
    .eq('is_for_resale', true)
    .or('external_code.ilike.PERF%,sku.ilike.PERF%')
    .is('deleted_at', null)
    .order('name')

  if (perfProducts && perfProducts.length > 0) {
    return perfProducts
  }

  // Fallback: check for category named perfumaria
  const { data: perfCategory } = await supabase
    .from('inventory_categories')
    .select('id')
    .ilike('name', '%perfum%')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (perfCategory) {
    const { data: catProducts } = await supabase
      .from('inventory_products')
      .select('id, name, external_code, sku, cost_price, sale_price_generated, sale_price_cash, sale_price_installment, is_active, is_for_resale, category_id')
      .eq('is_active', true)
      .eq('is_for_resale', true)
      .eq('category_id', perfCategory.id)
      .is('deleted_at', null)
      .order('name')

    if (catProducts && catProducts.length > 0) {
      return catProducts
    }
  }

  // Final fallback: all active resale products
  const { data: allResale } = await supabase
    .from('inventory_products')
    .select('id, name, external_code, sku, cost_price, sale_price_generated, sale_price_cash, sale_price_installment, is_active, is_for_resale, category_id')
    .eq('is_active', true)
    .eq('is_for_resale', true)
    .is('deleted_at', null)
    .order('name')

  return allResale || []
}

/**
 * Fetch professionals (active collaborators)
 */
export async function fetchProfessionals() {
  const { data } = await supabase
    .from('collaborators')
    .select('id, name, display_name, default_commission_percent, is_active')
    .eq('is_active', true)
    .order('name')

  return data || []
}

/**
 * Fetch customers for autocomplete
 */
export async function searchCustomers(term: string) {
  const normalizedTerm = term.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  const { data } = await supabase
    .from('customers')
    .select('id, full_name, mobile_phone, phone, email')
    .or(`normalized_name.ilike.%${normalizedTerm}%,full_name.ilike.%${term}%,mobile_phone.ilike.%${term}%`)
    .eq('is_active', true)
    .limit(10)

  return data || []
}

/**
 * Fetch installments for a specific sale
 */
export async function fetchSaleInstallments(saleId: string) {
  const { data } = await supabase
    .from('perfume_sale_installments')
    .select('*')
    .eq('perfume_sale_id', saleId)
    .order('installment_number')

  return data || []
}

/**
 * Fetch all open/overdue installments (debtors view)
 */
export async function fetchOverdueInstallments() {
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('perfume_sale_installments')
    .select(`
      *,
      perfume_sale:perfume_sales(
        id, customer_name_snapshot, customer_phone_snapshot, perfume_name_snapshot,
        professional_id, total_price, customer_id,
        professional:collaborators(name, display_name)
      )
    `)
    .in('status', ['open', 'overdue'])
    .order('due_date', { ascending: true })

  // Mark overdue ones
  const result = (data || []).map(inst => ({
    ...inst,
    is_overdue: inst.due_date < today && inst.status === 'open',
    computed_status: inst.due_date < today && inst.status === 'open' ? 'overdue' : inst.status,
  }))

  return result
}

/**
 * Fetch perfume client summaries (grouped by customer)
 */
export async function fetchPerfumeClientSummaries() {
  const { data: sales } = await supabase
    .from('perfume_sales')
    .select(`
      *,
      installments:perfume_sale_installments(*)
    `)
    .neq('status', 'cancelled')
    .order('sale_date', { ascending: false })

  if (!sales) return []

  const clientMap: Record<string, any> = {}

  for (const sale of sales) {
    const key = sale.customer_id || `walkin_${sale.customer_name_snapshot}_${sale.customer_phone_snapshot}`

    if (!clientMap[key]) {
      clientMap[key] = {
        customer_id: sale.customer_id,
        customer_name: sale.customer_name_snapshot,
        customer_phone: sale.customer_phone_snapshot,
        total_purchases: 0,
        total_amount: 0,
        total_paid: 0,
        total_pending: 0,
        overdue_count: 0,
        sales: [],
      }
    }

    clientMap[key].total_purchases++
    clientMap[key].total_amount += Number(sale.total_price)
    clientMap[key].sales.push(sale)

    if (sale.status === 'completed' || sale.status === 'receivable_settled') {
      clientMap[key].total_paid += Number(sale.total_price)
    } else if (sale.status === 'receivable_open') {
      const paidInst = (sale.installments || []).filter((i: any) => i.status === 'paid')
      const paidAmount = paidInst.reduce((sum: number, i: any) => sum + Number(i.amount), 0)
      clientMap[key].total_paid += paidAmount
      clientMap[key].total_pending += Number(sale.total_price) - paidAmount

      const today = new Date().toISOString().split('T')[0]
      const overdueInst = (sale.installments || []).filter((i: any) =>
        (i.status === 'open' || i.status === 'overdue') && i.due_date < today
      )
      clientMap[key].overdue_count += overdueInst.length
    }
  }

  return Object.values(clientMap)
}

/**
 * Fetch payment methods
 */
export async function fetchPaymentMethods() {
  const { data } = await supabase
    .from('payment_methods')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name')

  return data || []
}

/**
 * Fetch perfume sales for a professional in a date range (for commission integration)
 */
export async function fetchProfessionalPerfumeSales(
  professionalId: string,
  startDate: string,
  endDate: string
) {
  const { data } = await supabase
    .from('perfume_sales')
    .select('*')
    .eq('professional_id', professionalId)
    .neq('status', 'cancelled')
    .gte('sale_date', startDate)
    .lte('sale_date', endDate)

  return data || []
}
