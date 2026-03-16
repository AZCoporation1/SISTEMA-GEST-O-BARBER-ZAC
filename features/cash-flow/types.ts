import { Database } from "@/types/supabase"

export type FinancialMovement = Database["public"]["Tables"]["financial_movements"]["Row"]

export interface CashFlowFilters {
  period: "month" | "week" | "day" | "year"
  date?: string // Reference date for the period
}

export interface CashFlowSummary {
  totalRevenue: number
  totalSales: number
  totalOtherIncome: number
  totalExpenses: number
  totalFixedCosts: number
  totalVariableCosts: number
  netProfit: number
  profitMargin: number
}
