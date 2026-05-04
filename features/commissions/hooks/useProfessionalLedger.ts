"use client"

import { useQuery } from "@tanstack/react-query"
import { getProfessionalLedger } from "../services/professionalLedger.service"

export function useProfessionalLedger(
  professionalId: string | undefined,
  periodStart: string | undefined,
  periodEnd: string | undefined
) {
  return useQuery({
    queryKey: ["professionalLedger", professionalId, periodStart, periodEnd],
    queryFn: () => getProfessionalLedger(professionalId!, periodStart!, periodEnd!),
    enabled: !!professionalId && !!periodStart && !!periodEnd,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  })
}
