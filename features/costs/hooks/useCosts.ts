"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFixedCosts, getVariableCosts } from "../services/costs.service"
import { createFixedCost, toggleFixedCostStatus, createVariableCost } from "../actions/costs.actions"
import { CostFilters, FixedCostFormValues, VariableCostFormValues } from "../types"
import { useToast } from "@/hooks/use-toast"

export function useFixedCosts(filters: CostFilters) {
  return useQuery({
    queryKey: ["fixedCosts", filters],
    queryFn: () => getFixedCosts(filters),
  })
}

export function useVariableCosts(filters: CostFilters) {
  return useQuery({
    queryKey: ["variableCosts", filters],
    queryFn: () => getVariableCosts(filters),
  })
}

export function useCostMutations() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const createFixedMutation = useMutation({
    mutationFn: (data: FixedCostFormValues) => createFixedCost(data),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["fixedCosts"] })
        toast({ title: "Custo fixo cadastrado!" })
      } else {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      }
    }
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, currentStatus }: { id: string, currentStatus: boolean }) => toggleFixedCostStatus(id, currentStatus),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["fixedCosts"] })
        toast({ title: "Status alterado." })
      } else {
        toast({ title: "Erro ao alterar", description: res.error, variant: "destructive" })
      }
    }
  })

  const createVariableMutation = useMutation({
    mutationFn: (data: VariableCostFormValues) => createVariableCost(data),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["variableCosts"] })
        toast({ title: "Custo variável registrado!" })
      } else {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      }
    }
  })

  return {
    createFixedCost: createFixedMutation.mutateAsync,
    isCreatingFixed: createFixedMutation.isPending,
    toggleStatus: toggleMutation.mutateAsync,
    isToggling: toggleMutation.isPending,
    createVariableCost: createVariableMutation.mutateAsync,
    isCreatingVariable: createVariableMutation.isPending,
  }
}
