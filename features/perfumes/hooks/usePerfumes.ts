"use client"

import { useQuery } from "@tanstack/react-query"
import {
  fetchPerfumeSales,
  fetchPerfumeProducts,
  fetchProfessionals,
  fetchOverdueInstallments,
  fetchPerfumeClientSummaries,
  fetchPaymentMethods,
  fetchSaleInstallments,
} from "../services/perfumes.service"
import type { PerfumeSalesFilters } from "../types"

export function usePerfumeSales(filters: PerfumeSalesFilters) {
  return useQuery({
    queryKey: ["perfumeSales", filters],
    queryFn: () => fetchPerfumeSales(filters),
  })
}

export function usePerfumeProducts() {
  return useQuery({
    queryKey: ["perfumeProducts"],
    queryFn: fetchPerfumeProducts,
    staleTime: 1000 * 60 * 5,
  })
}

export function usePerfumeProfessionals() {
  return useQuery({
    queryKey: ["perfumeProfessionals"],
    queryFn: fetchProfessionals,
    staleTime: 1000 * 60 * 5,
  })
}

export function useOverdueInstallments() {
  return useQuery({
    queryKey: ["perfumeOverdueInstallments"],
    queryFn: fetchOverdueInstallments,
    refetchInterval: 1000 * 60 * 2, // refetch every 2 min for overdue detection
  })
}

export function usePerfumeClientSummaries() {
  return useQuery({
    queryKey: ["perfumeClientSummaries"],
    queryFn: fetchPerfumeClientSummaries,
  })
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ["paymentMethods"],
    queryFn: fetchPaymentMethods,
    staleTime: 1000 * 60 * 10,
  })
}

export function useSaleInstallments(saleId: string | null) {
  return useQuery({
    queryKey: ["perfumeInstallments", saleId],
    queryFn: () => fetchSaleInstallments(saleId!),
    enabled: !!saleId,
  })
}
