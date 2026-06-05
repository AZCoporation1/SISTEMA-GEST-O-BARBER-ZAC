// @ts-nocheck
/**
 * Barber Zac — Professional Ledger Service
 * 
 * Unified view of all data that affects a professional's fortnight account.
 * Uses canonical sources:
 *   - sales → for sales/services revenue
 *   - professional_advances → for advances/deductions
 *   - perfume_sales → for perfume commissions
 *   - professional_closures → for closure history
 *   - audit_logs → for audit trail
 * 
 * Does NOT duplicate values from cash/financial — those are linkage/history only.
 */

import { createClient } from '@/lib/supabase/client'
import type { ProfessionalLedger, ProfessionalLedgerSummary } from '../types'

export async function getProfessionalLedger(
  professionalId: string,
  periodStart: string,
  periodEnd: string
): Promise<ProfessionalLedger> {
  const supabase = createClient()

  // ── 1. Sales (canonical source for revenue) ──
  // Include ALL statuses so we can show cancelled ones with badge
  const { data: allSales } = await supabase
    .from('sales')
    .select(`
      id, total, subtotal, sale_date, status,
      payment_method_id, customer_name_snapshot, customer_id, notes,
      collaborator_id,
      items:sale_items (id, item_type, quantity, total, unit_price_snapshot, product_id, service_name, service_id)
    `)
    .eq('collaborator_id', professionalId)
    .gte('sale_date', periodStart)
    .lte('sale_date', periodEnd)
    .order('sale_date', { ascending: false })

  const sales = allSales || []

  // Calculate summary from COMPLETED sales only (cancelled don't count)
  const completedSales = sales.filter(s => s.status === 'completed')
  let grossTotal = 0
  let salesCount = 0
  let servicesCount = 0
  let productsCount = 0
  let itemsQuantity = 0

  for (const sale of completedSales) {
    salesCount++
    grossTotal += Number(sale.total) || 0
    const items = (sale as any).items || []
    for (const item of items) {
      itemsQuantity += Number(item.quantity) || 0
      if (item.item_type === 'service') servicesCount++
      if (item.item_type === 'product') productsCount++
    }
  }

  // ── 2. Professional info ──
  const { data: professional } = await supabase
    .from('collaborators')
    .select('id, name, display_name, default_commission_percent')
    .eq('id', professionalId)
    .single()

  const commissionPercent = Number(professional?.default_commission_percent) || 47

  // ── 3. Advances (canonical source for deductions) ──
  const { data: allAdvances } = await supabase
    .from('professional_advances')
    .select('*')
    .eq('professional_id', professionalId)
    .gte('occurred_at', periodStart)
    .lte('occurred_at', periodEnd)
    .order('occurred_at', { ascending: false })

  const advances = allAdvances || []

  // Stock withdrawals = subset of advances with type stock_consumption
  const stockWithdrawals = advances.filter(a => a.type === 'stock_consumption')

  // Only ACTIVE non-deferred advances count toward deduction
  const activeAdvances = advances.filter(
    a => a.status === 'active' && !a.carry_over_to_next_period
  )
  const advancesTotal = activeAdvances.reduce(
    (sum, a) => sum + (Number(a.total_amount) || 0), 0
  )
  const stockWithdrawalsTotal = stockWithdrawals
    .filter(a => a.status === 'active')
    .reduce((sum, a) => sum + (Number(a.total_amount) || 0), 0)

  // ── 4. Perfume sales (canonical source for perfume commissions) ──
  const { data: allPerfumeSales } = await supabase
    .from('perfume_sales')
    .select(`
      id, total_price, commission_amount_snapshot, perfume_name_snapshot,
      quantity, sale_date, status, payment_mode, installment_count,
      customer_name_snapshot, customer_id,
      cancelled_by, cancelled_at, cancellation_reason
    `)
    .eq('professional_id', professionalId)
    .gte('sale_date', periodStart)
    .lte('sale_date', periodEnd)
    .order('sale_date', { ascending: false })

  const perfumeSales = allPerfumeSales || []

  // Only non-cancelled perfumes count for commission
  const activePerfumes = perfumeSales.filter(ps => ps.status !== 'cancelled')
  let perfumeGrossTotal = 0
  let perfumeCommissionTotal = 0

  for (const ps of activePerfumes) {
    perfumeGrossTotal += Number(ps.total_price) || 0
    perfumeCommissionTotal += Number(ps.commission_amount_snapshot) || 0
  }

  // ── 5. Closures ──
  const { data: allClosures } = await supabase
    .from('professional_closures')
    .select(`
      *,
      professional:professional_id (name, display_name)
    `)
    .eq('professional_id', professionalId)
    .order('created_at', { ascending: false })
    .limit(20)

  const closures = allClosures || []

  // ── 5b. Subscription Payments (for subscription commissions) ──
  const { data: allSubPayments } = await supabase
    .from('subscription_payments')
    .select(`
      id, amount, status, payment_method, paid_at,
      subscription:subscription_id(customer_id, customers(full_name), subscription_plans(display_name))
    `)
    .eq('professional_id', professionalId)
    .gte('paid_at', periodStart)
    .lte('paid_at', periodEnd)
    .order('paid_at', { ascending: false })

  const subscriptionPayments = allSubPayments || []
  const activeSubPayments = subscriptionPayments.filter(p => p.status === 'paid')
  
  let subscriptionGrossTotal = 0
  let subscriptionCommissionTotal = 0

  for (const p of activeSubPayments) {
    const amt = Number(p.amount) || 0
    subscriptionGrossTotal += amt
    subscriptionCommissionTotal += amt * (commissionPercent / 100)
  }

  // ── 6. Audit events (filtered by relevant entities) ──
  // We collect all entity_ids that belong to this professional
  const relevantEntityIds = new Set<string>()
  sales.forEach(s => relevantEntityIds.add(s.id))
  advances.forEach(a => relevantEntityIds.add(a.id))
  perfumeSales.forEach(ps => relevantEntityIds.add(ps.id))
  subscriptionPayments.forEach(sp => relevantEntityIds.add(sp.id))
  closures.forEach(c => relevantEntityIds.add(c.id))

  let auditEvents: any[] = []
  if (relevantEntityIds.size > 0) {
    const entityIdsArray = Array.from(relevantEntityIds).slice(0, 50)
    const { data: auditData } = await supabase
      .from('audit_logs')
      .select('*, actor:actor_id(full_name)')
      .in('entity_id', entityIdsArray)
      .order('created_at', { ascending: false })
      .limit(100)

    auditEvents = auditData || []
  }

  // ── 7. Calculate summary ──
  const barberShareFromSales = grossTotal * (commissionPercent / 100)
  const barbershopShare = grossTotal - barberShareFromSales
  const barberShare = barberShareFromSales + perfumeCommissionTotal + subscriptionCommissionTotal
  const netPayable = barberShare - advancesTotal

  const summary: ProfessionalLedgerSummary = {
    grossTotal,
    salesCount,
    servicesCount,
    productsCount,
    itemsQuantity,
    ticketMedio: salesCount > 0 ? grossTotal / salesCount : 0,
    commissionPercent,
    barberShareFromSales,
    barbershopShare,
    perfumeGrossTotal,
    perfumeCommissionTotal,
    perfumeSalesCount: activePerfumes.length,
    subscriptionGrossTotal,
    subscriptionCommissionTotal,
    subscriptionPaymentsCount: activeSubPayments.length,
    barberShare,
    advancesTotal,
    stockWithdrawalsTotal,
    netPayable,
  }

  return {
    summary,
    sales,
    advances,
    stockWithdrawals,
    perfumeSales,
    subscriptionPayments,
    closures,
    auditEvents,
  }
}
