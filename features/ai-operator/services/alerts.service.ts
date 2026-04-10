import { createClient } from "@/lib/supabase/client"
import type { VwInventoryPositionRow } from "@/types/supabase"
import { getProductCodesAction } from "@/features/inventory/actions/inventory.actions"

export interface StockInconsistency {
  product_id: string
  name: string
  external_code: string | null
  category_name: string | null
  min_stock: number
  current_balance: number
  cost_price: number
  anomaly_type: 'negative_stock' | 'zero_stock' | 'critical_stock' | 'missing_cost'
  suggested_buy_qty: number
  estimated_buy_cost: number
}

export async function getStockInconsistencies(): Promise<StockInconsistency[]> {
  const supabase = createClient()

  // Use the inventory position view which has the correct balance from the ledger
  const { data, error } = await supabase
    .from('vw_inventory_position')
    .select('*')
    .order('product_name')

  if (error) {
    console.warn("Error fetching inventory positions for alerts:", error)
    return []
  }

  const products = (data || []) as unknown as VwInventoryPositionRow[]
  
  // Fetch external_codes for display (not in the view)
  // Using Server Action to bypass RLS on inventory_products
  const codesRes = await getProductCodesAction()
  const codeMap = new Map((codesRes.data || []).map((c: any) => [c.id, c.external_code]))
  
  const anomalies: StockInconsistency[] = []

  for (const p of products) {
    let type: StockInconsistency['anomaly_type'] | null = null
    const balance = p.current_balance || 0
    
    if (balance < 0) type = 'negative_stock'
    else if (balance === 0) type = 'zero_stock'
    else if (balance <= (p.min_stock || 0) && p.min_stock > 0) type = 'critical_stock'
    else if (!p.cost_price || p.cost_price <= 0) type = 'missing_cost'

    if (type) {
      anomalies.push({
        product_id: p.product_id,
        name: p.product_name,
        external_code: codeMap.get(p.product_id) || null,
        category_name: p.category_name,
        min_stock: p.min_stock || 0,
        current_balance: balance,
        cost_price: p.cost_price,
        anomaly_type: type,
        suggested_buy_qty: Math.max(0, (p.max_stock || 0) - balance),
        estimated_buy_cost: Math.max(0, (p.max_stock || 0) - balance) * (p.cost_price || 0)
      })
    }
  }

  return anomalies
}
