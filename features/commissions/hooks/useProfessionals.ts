"use client"

import { useQuery } from "@tanstack/react-query"
import {
  getProfessionals,
  getProfessionalSales,
  getProfessionalAdvances,
  getProfessionalClosures,
  getClosureById,
  getProductsForAdvance,
  getProfessionalSalesList,
  getProfessionalPerfumeSales,
} from "../services/professionals.service"

export function useProfessionals() {
  return useQuery({
    queryKey: ["professionals"],
    queryFn: getProfessionals,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  })
}

export function useProfessionalSales(
  professionalId: string | undefined,
  periodStart: string | undefined,
  periodEnd: string | undefined
) {
  return useQuery({
    queryKey: ["professionalSales", professionalId, periodStart, periodEnd],
    queryFn: () => getProfessionalSales(professionalId!, periodStart!, periodEnd!),
    enabled: !!professionalId && !!periodStart && !!periodEnd,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  })
}

export function useProfessionalAdvances(
  professionalId: string | undefined,
  periodStart?: string,
  periodEnd?: string
) {
  return useQuery({
    queryKey: ["professionalAdvances", professionalId, periodStart, periodEnd],
    queryFn: () => getProfessionalAdvances(professionalId!, periodStart, periodEnd),
    enabled: !!professionalId,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  })
}

export function useProfessionalClosures(professionalId?: string) {
  return useQuery({
    queryKey: ["professionalClosures", professionalId],
    queryFn: () => getProfessionalClosures(professionalId),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  })
}

export function useClosureById(closureId: string | undefined) {
  return useQuery({
    queryKey: ["closure", closureId],
    queryFn: () => getClosureById(closureId!),
    enabled: !!closureId,
  })
}

export function useProductsForAdvance() {
  return useQuery({
    queryKey: ["productsForAdvance"],
    queryFn: getProductsForAdvance,
  })
}

export function useProfessionalSalesList(
  professionalId: string | undefined,
  periodStart: string | undefined,
  periodEnd: string | undefined
) {
  return useQuery({
    queryKey: ["professionalSalesList", professionalId, periodStart, periodEnd],
    queryFn: () => getProfessionalSalesList(professionalId!, periodStart!, periodEnd!),
    enabled: !!professionalId && !!periodStart && !!periodEnd,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  })
}

export function useProfessionalPerfumeSales(
  professionalId: string | undefined,
  periodStart: string | undefined,
  periodEnd: string | undefined
) {
  return useQuery({
    queryKey: ["professionalPerfumeSales", professionalId, periodStart, periodEnd],
    queryFn: () => getProfessionalPerfumeSales(professionalId!, periodStart!, periodEnd!),
    enabled: !!professionalId && !!periodStart && !!periodEnd,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  })
}
