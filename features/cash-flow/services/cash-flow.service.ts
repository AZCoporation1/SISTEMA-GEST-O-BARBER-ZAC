// @ts-nocheck
"use server"
import { createServerClient } from "@/lib/supabase/server"
import { CashFlowFilters, CashFlowSummary, FinancialMovement } from "../types"

export async function getFinancialMovements(filters: CashFlowFilters) {
  const supabase = await createServerClient()
  
  let query = supabase
    .from("financial_movements")
    .select("*")

  // For MVP we just load all in the given period.
  // Date boundaries based on filters
  let startDate = new Date();
  let endDate = new Date();
  
  if (filters.date) {
    startDate = new Date(filters.date)
    endDate = new Date(filters.date)
  }

  if (filters.period === "day") {
    startDate.setHours(0,0,0,0)
    endDate.setHours(23,59,59,999)
  } else if (filters.period === "week") {
    // Rough week boundary
    const day = startDate.getDay()
    const diff = startDate.getDate() - day + (day == 0 ? -6 : 1); 
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

  const movements = data as FinancialMovement[]
  
  // Calculate summary
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
    if (m.movement_type === "income") {
      summary.totalRevenue += m.amount
      if (m.category === "Vendas") summary.totalSales += m.amount
      else summary.totalOtherIncome += m.amount
    } else {
      summary.totalExpenses += m.amount
      if (m.category === "Custo Fixo") summary.totalFixedCosts += m.amount
      else summary.totalVariableCosts += m.amount // Cash register outflows, etc
    }
  })

  summary.netProfit = summary.totalRevenue - summary.totalExpenses
  summary.profitMargin = summary.totalRevenue > 0 ? (summary.netProfit / summary.totalRevenue) * 100 : 0

  return { movements, summary, periodStr: `${startDate.toLocaleDateString()} a ${endDate.toLocaleDateString()}` }
}
