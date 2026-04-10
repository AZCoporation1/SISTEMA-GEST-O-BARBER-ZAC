"use server"

import { createServerClient } from "@/lib/supabase/server"
import type { StockInconsistency } from "../types"

export async function fetchStockAlertsAction(): Promise<{ success: boolean; data?: StockInconsistency[]; error?: string }> {
  try {
    const supabase = await createServerClient()
    
    const { data, error } = await (supabase.from('vw_inventory_position') as any)
      .select('*')
      .order('product_name')

    if (error) {
      console.warn("Error fetching inventory positions for alerts:", error)
      return { success: true, data: [] }
    }

    const products = data || []
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
          external_code: null,
          category_name: p.category_name,
          min_stock: p.min_stock || 0,
          current_balance: balance,
          cost_price: p.cost_price || 0,
          anomaly_type: type,
          suggested_buy_qty: Math.max(0, (p.max_stock || 0) - balance),
          estimated_buy_cost: Math.max(0, (p.max_stock || 0) - balance) * (p.cost_price || 0)
        })
      }
    }

    return { success: true, data: anomalies }
  } catch (error: any) {
    console.error("Failed to fetch alerts:", error)
    return { success: false, error: error.message }
  }
}
