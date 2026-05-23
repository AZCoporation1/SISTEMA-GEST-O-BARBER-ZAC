"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getReceivablesClient, getReceivableSummaryClient, getCustomersList, getCollaboratorsList } from "../services/receivables.service"
import { receiveInstallment, cancelReceivable, reverseInstallmentPayment } from "../actions/receivables.actions"
import type { ReceivableFilters } from "../types"
import { useToast } from "@/hooks/use-toast"

export function useReceivables(filters: ReceivableFilters) {
  return useQuery({
    queryKey: ["receivables", filters],
    queryFn: () => getReceivablesClient(filters),
  })
}

export function useReceivableSummary() {
  return useQuery({
    queryKey: ["receivable-summary"],
    queryFn: getReceivableSummaryClient,
  })
}

export function useReceivableDependencies() {
  const customers = useQuery({ queryKey: ["ar-customers"], queryFn: getCustomersList })
  const collaborators = useQuery({ queryKey: ["ar-collaborators"], queryFn: getCollaboratorsList })

  return {
    customers: customers.data || [],
    collaborators: collaborators.data || [],
    isLoading: customers.isLoading || collaborators.isLoading,
  }
}

export function useReceivableMutations() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["receivables"] })
    queryClient.invalidateQueries({ queryKey: ["receivable-summary"] })
    queryClient.invalidateQueries({ queryKey: ["cash"] })
    queryClient.invalidateQueries({ queryKey: ["sales"] })
  }

  const receiveMutation = useMutation({
    mutationFn: (params: Parameters<typeof receiveInstallment>[0]) => receiveInstallment(params),
    onSuccess: (res) => {
      if (res.success) {
        invalidateAll()
        toast({ title: "Parcela recebida com sucesso!" })
      } else {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      }
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelReceivable(id, reason),
    onSuccess: (res) => {
      if (res.success) {
        invalidateAll()
        toast({ title: "Parcela cancelada." })
      } else {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      }
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  })

  const reverseMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => reverseInstallmentPayment(id, reason),
    onSuccess: (res) => {
      if (res.success) {
        invalidateAll()
        toast({ title: "Pagamento estornado." })
      } else {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      }
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  })

  return {
    receivePayment: receiveMutation.mutateAsync,
    isReceiving: receiveMutation.isPending,
    cancelReceivable: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
    reversePayment: reverseMutation.mutateAsync,
    isReversing: reverseMutation.isPending,
  }
}
