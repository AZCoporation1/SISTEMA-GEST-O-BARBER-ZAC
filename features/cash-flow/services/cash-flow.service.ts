import { createClient } from "@/lib/supabase/client"
import type { FinancialMovementRow } from "@/types/supabase"
import type { CashFlowFilters, CashFlowSummary, FinancialMovement } from "../types"

export async function getFinancialMovements(filters: CashFlowFilters) {
  const supabase = createClient()
  
  let query = supabase
    .from("financial_movements")
    .select("*")

  let startDate = new Date()
  let endDate = new Date()
  
  if (filters.date) {
    startDate = new Date(filters.date)
    endDate = new Date(filters.date)
  }

  if (filters.period === "day") {
    startDate.setHours(0,0,0,0)
    endDate.setHours(23,59,59,999)
  } else if (filters.period === "week") {
    const day = startDate.getDay()
    const diff = startDate.getDate() - day + (day == 0 ? -6 : 1)
    startDate = new Date(startDate.setDate(diff))
    startDate.setHours(0,0,0,0)
    
    endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 6)
    endDate.setHours(23,59,59,999)
  } else if (filters.period === "month") {
    startDate.setDate(1)
    startDate.setHours(0,0,0,0)
    
    endDate.setMonth(endDate.getMonth() + 1)
    endDate.setDate(0)
    endDate.setHours(23,59,59,999)
  }

  query = query.gte("occurred_on", startDate.toISOString())
               .lte("occurred_on", endDate.toISOString())

  const { data, error } = await query

  if (error) {
    console.error("Error fetching financial movements:", error)
    throw new Error(error.message)
  }

  const movements = (data || []) as unknown as FinancialMovement[]
  
  const summary: CashFlowSummary = {
     totalRevenue: 0,
     totalSales: 0,
     totalOtherIncome: 0,
     totalExpenses: 0,
     totalFixedCosts: 0,
     totalVariableCosts: 0,
     netProfit: 0,
     profitMargin: 0
  }

  movements.forEach(m => {
    if (m.movement_type === "received") {
      summary.totalRevenue += m.amount
      if (m.category === "Vendas") summary.totalSales += m.amount
      else summary.totalOtherIncome += m.amount
    } else if (m.movement_type === "paid") {
      summary.totalExpenses += m.amount
      if (m.origin_type === "fixed_cost") summary.totalFixedCosts += m.amount
      else summary.totalVariableCosts += m.amount
    }
  })

  summary.netProfit = summary.totalRevenue - summary.totalExpenses
  summary.profitMargin = summary.totalRevenue > 0 ? (summary.netProfit / summary.totalRevenue) * 100 : 0

  return { movements, summary, periodStr: `${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}` }
}
