"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getSales, getPaymentMethods, getCustomers, getCollaborators } from "../services/sales.service"
import { processSale } from "../actions/sales.actions"
import { SalesFilters } from "../types"
import { SaleFormValues } from "../validators"
import { useToast } from "@/hooks/use-toast"

export function useSales(filters: SalesFilters) {
  return useQuery({
    queryKey: ["sales", filters],
    queryFn: () => getSales(filters),
  })
}

export function usePOSDependencies() {
  const methods = useQuery({ queryKey: ["paymentMethods"], queryFn: getPaymentMethods })
  const customers = useQuery({ queryKey: ["customers"], queryFn: getCustomers })
  const collaborators = useQuery({ queryKey: ["collaborators"], queryFn: getCollaborators })

  return {
    paymentMethods: methods.data || [],
    customers: customers.data || [],
    collaborators: collaborators.data || [],
    isLoading: methods.isLoading || customers.isLoading || collaborators.isLoading
  }
}

export function usePOSMutations() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const processMutation = useMutation({
    mutationFn: (data: SaleFormValues) => processSale(data),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["sales"] })
        queryClient.invalidateQueries({ queryKey: ["inventory"] })
        queryClient.invalidateQueries({ queryKey: ["cash"] })
        toast({ title: "Venda concluída com sucesso!" })
      } else {
        toast({ title: "Erro no PDV", description: res.error, variant: "destructive" })
      }
    },
    onError: (error: any) => {
      toast({ title: "Erro inesperado", description: error.message, variant: "destructive" })
    }
  })

  return {
    processSale: processMutation.mutateAsync,
    isProcessing: processMutation.isPending,
  }
}
