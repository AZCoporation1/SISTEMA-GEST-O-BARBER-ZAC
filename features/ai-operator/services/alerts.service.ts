// @ts-nocheck
import { createServerClient } from '@/lib/supabase/server'
import { StockInconsistency } from '../types'

export async function getStockInconsistencies(): Promise<StockInconsistency[]> {
  const supabase = await createServerClient()

  // During MVP / Mock phase before View is fully created on user DB, fallback defensively
  try {
    const { data, error } = await supabase
      .from('vw_stock_inconsistencies')
      .select('*')
      .order('anomaly_type', { ascending: true })

    if (error) {
      console.warn("vw_stock_inconsistencies view might not exist yet:", error)
      return _getDefensiveStockFallback()
    }
    
    return data as StockInconsistency[]
  } catch (e) {
    return _getDefensiveStockFallback()
  }
}

// Fallback logic executing logic in NodeJS if View is missing
async function _getDefensiveStockFallback(): Promise<StockInconsistency[]> {
  const supabase = await createServerClient()
  const { data: products } = await supabase.from('inventory_products').select('*, inventory_categories(name)')
  
  if (!products) return []

  const anomalies: StockInconsistency[] = []

  for (const p of products) {
    if (p.status !== 'active') continue

    let type: any = null
    if (p.qty_current < 0) type = 'negative_stock'
    else if (p.qty_current === 0) type = 'zero_stock'
    else if (p.qty_current <= p.qty_min) type = 'critical_stock'
    else if (!p.cost_price || p.cost_price <= 0) type = 'missing_cost'

    if (type) {
      anomalies.push({
        product_id: p.id,
        name: p.name,
        code: p.code,
        category_name: p.inventory_categories?.name,
        qty_min: p.qty_min || 0,
        qty_current: p.qty_current || 0,
        cost_price: p.cost_price,
        anomaly_type: type,
        suggested_buy_qty: Math.max(0, (p.qty_max || 0) - (p.qty_current || 0)),
        estimated_buy_cost: Math.max(0, (p.qty_max || 0) - (p.qty_current || 0)) * (p.cost_price || 0)
      })
    }
  }

  return anomalies
}
