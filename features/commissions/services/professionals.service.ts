/**
 * Barber Zac — Professionals Service (Client-side queries)
 */

import { createClient } from '@/lib/supabase/client'
import type {
  CollaboratorRow,
  ProfessionalAdvanceRow,
  ProfessionalClosureRow,
} from '@/types/supabase'

// ── Professionals ────────────────────────────────────────

export async function getProfessionals() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('collaborators')
    .select('*')
    .eq('role', 'barbeiro')
    .eq('is_active', true)
    .order('name')

  if (error) throw new Error(error.message)
  return data as unknown as CollaboratorRow[]
}

// ── Professional Sales (for commission calculation) ──────

export interface ProfessionalSalesResult {
  grossTotal: number
  salesCount: number
  servicesCount: number
  productsCount: number
  itemsQuantity: number
  ticketMedio: number
}

export async function getProfessionalSales(
  professionalId: string,
  periodStart: string,
  periodEnd: string
): Promise<ProfessionalSalesResult> {
  const supabase = createClient()

  const { data: sales, error } = await supabase
    .from('sales')
    .select(`
      id,
      total,
      subtotal,
      items:sale_items (id, item_type, quantity, total)
    `)
    .eq('collaborator_id', professionalId)
    .eq('status', 'completed')
    .gte('sale_date', periodStart)
    .lte('sale_date', periodEnd)

  if (error) throw new Error(error.message)

  let grossTotal = 0
  let salesCount = 0
  let servicesCount = 0
  let productsCount = 0
  let itemsQuantity = 0

  for (const sale of ((sales || []) as any[])) {
    salesCount++
    grossTotal += Number(sale.total) || 0
    const items = sale.items || []
    for (const item of items) {
      itemsQuantity += Number(item.quantity) || 0
      if (item.item_type === 'service') servicesCount++
      if (item.item_type === 'product') productsCount++
    }
  }

  return {
    grossTotal,
    salesCount,
    servicesCount,
    productsCount,
    itemsQuantity,
    ticketMedio: salesCount > 0 ? grossTotal / salesCount : 0,
  }
}

// ── Professional Advances ────────────────────────────────

export async function getProfessionalAdvances(
  professionalId: string,
  periodStart?: string,
  periodEnd?: string,
  statusFilter?: string
) {
  const supabase = createClient()

  let query = supabase
    .from('professional_advances')
    .select('*')
    .eq('professional_id', professionalId)
    .order('occurred_at', { ascending: false })

  if (periodStart) {
    query = query.gte('occurred_at', periodStart)
  }
  if (periodEnd) {
    query = query.lte('occurred_at', periodEnd)
  }
  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as unknown as ProfessionalAdvanceRow[]
}

// ── Professional Closures ────────────────────────────────

export async function getProfessionalClosures(
  professionalId?: string,
  limit: number = 20
) {
  const supabase = createClient()

  let query = supabase
    .from('professional_closures')
    .select(`
      *,
      professional:professional_id (name, display_name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (professionalId) {
    query = query.eq('professional_id', professionalId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as unknown as (ProfessionalClosureRow & {
    professional?: { name: string; display_name: string | null } | null
  })[]
}

export async function getClosureById(closureId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('professional_closures')
    .select(`
      *,
      professional:professional_id (name, display_name)
    `)
    .eq('id', closureId)
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as ProfessionalClosureRow & {
    professional?: { name: string; display_name: string | null } | null
  }
}

// ── Products for advance picker ──────────────────────────

export async function getProductsForAdvance() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('vw_inventory_position')
    .select('product_id, product_name, sale_price, current_balance, category_name')
    .gt('current_balance', 0)
    .order('product_name')

  if (error) throw new Error(error.message)
  return data || []
}
