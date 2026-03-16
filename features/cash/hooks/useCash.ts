"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getActiveCashSession, getCashSessions, getPaymentMethods } from "../services/cash.service"
import { openCashSession, closeCashSession, addCashEntry } from "../actions/cash.actions"
import { CashFilters } from "../types"
import { OpenSessionValues, CloseSessionValues, CashEntryValues } from "../validators"
import { useToast } from "@/hooks/use-toast"

export function useActiveCashSession() {
  return useQuery({
    queryKey: ["activeCashSession"],
    queryFn: () => getActiveCashSession(),
  })
}

export function useCashHistory(filters: CashFilters) {
  return useQuery({
    queryKey: ["cashHistory", filters],
    queryFn: () => getCashSessions(filters),
  })
}

export function useCashDependencies() {
  return useQuery({
    queryKey: ["paymentMethods"],
    queryFn: () => getPaymentMethods(),
  })
}

export function useCashMutations() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["activeCashSession"] })
    queryClient.invalidateQueries({ queryKey: ["cashHistory"] })
  }

  const openMutation = useMutation({
    mutationFn: (data: OpenSessionValues) => openCashSession(data),
    onSuccess: (res) => {
      if (res.success) {
        invalidate()
        toast({ title: "Caixa aberto com sucesso!" })
      } else {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      }
    }
  })

  const closeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: CloseSessionValues }) => closeCashSession(id, data),
    onSuccess: (res) => {
      if (res.success) {
        invalidate()
        toast({ title: "Caixa fechado com sucesso!" })
      } else {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      }
    }
  })

  const addEntryMutation = useMutation({
    mutationFn: (data: CashEntryValues) => addCashEntry(data),
    onSuccess: (res) => {
      if (res.success) {
        invalidate()
        toast({ title: "Lançamento adicionado!" })
      } else {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      }
    }
  })

  return {
    openSession: openMutation.mutateAsync,
    isOpening: openMutation.isPending,
    closeSession: closeMutation.mutateAsync,
    isClosing: closeMutation.isPending,
    addEntry: addEntryMutation.mutateAsync,
    isAdding: addEntryMutation.isPending,
  }
}
