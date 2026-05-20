/**
 * Barber Zac — Reception Service (Client-side queries)
 * All mutations go through server actions. This file is read-only queries.
 */

import { createClient } from '@/lib/supabase/client'
import type { ReceptionStaffRow, ReceptionAdvanceRow, ReceptionClosureRow } from '../types'

// ── Staff ─────────────────────────────────────────────────

export async function getReceptionStaff(): Promise<ReceptionStaffRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('reception_staff')
    .select('*')
    .eq('is_active', true)
    .order('display_name')

  if (error) throw new Error(error.message)
  return (data || []) as ReceptionStaffRow[]
}

// ── Advances ──────────────────────────────────────────────

export async function getReceptionAdvances(
  staffId: string,
  periodStart?: string,
  periodEnd?: string,
  statusFilter?: string
): Promise<ReceptionAdvanceRow[]> {
  const supabase = createClient()
  let query = supabase
    .from('reception_advances')
    .select('*')
    .eq('staff_id', staffId)
    .order('occurred_at', { ascending: false })

  if (periodStart) query = query.gte('period_start', periodStart)
  if (periodEnd) query = query.lte('period_end', periodEnd)
  if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data || []) as ReceptionAdvanceRow[]
}

// ── Closures ──────────────────────────────────────────────

export async function getReceptionClosures(
  staffId?: string,
  limit: number = 30
): Promise<(ReceptionClosureRow & { staff?: { display_name: string; full_name: string } | null })[]> {
  const supabase = createClient()
  let query = supabase
    .from('reception_closures')
    .select('*, staff:staff_id(display_name, full_name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (staffId) query = query.eq('staff_id', staffId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data || []) as any
}

export async function getReceptionDraftClosure(
  staffId: string,
  periodStart: string,
  periodEnd: string
): Promise<ReceptionClosureRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('reception_closures')
    .select('*')
    .eq('staff_id', staffId)
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as ReceptionClosureRow | null
}

// ── Products for stock withdrawal ─────────────────────────

export async function getProductsForWithdrawal() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('vw_inventory_position')
    .select('product_id, product_name, sale_price, current_balance, category_name')
    .gt('current_balance', 0)
    .order('product_name')

  if (error) throw new Error(error.message)
  return (data || []) as {
    product_id: string
    product_name: string
    sale_price: number
    current_balance: number
    category_name: string | null
  }[]
}
