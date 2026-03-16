"use client"

import { useQuery } from "@tanstack/react-query"
import { getFinancialMovements } from "../services/cash-flow.service"
import { CashFlowFilters } from "../types"

export function useCashFlow(filters: CashFlowFilters) {
  return useQuery({
    queryKey: ["cashFlow", filters],
    queryFn: () => getFinancialMovements(filters),
  })
}
