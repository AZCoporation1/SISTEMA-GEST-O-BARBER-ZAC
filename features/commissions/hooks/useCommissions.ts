"use client"

import { useQuery } from "@tanstack/react-query"
import { getCommissionEntries, getCommissionSummary, getCollaborators } from "../services/commissions.service"
import { CommissionFilters } from "../types"

export function useCommissionEntries(filters: CommissionFilters) {
  return useQuery({
    queryKey: ["commissionEntries", filters],
    queryFn: () => getCommissionEntries(filters),
  })
}

export function useCommissionSummary() {
  return useQuery({
    queryKey: ["commissionSummary"],
    queryFn: () => getCommissionSummary(),
  })
}

export function useCommissionCollaborators() {
  return useQuery({
    queryKey: ["commissionCollaborators"],
    queryFn: () => getCollaborators(),
  })
}
