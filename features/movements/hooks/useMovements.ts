"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getStockMovements } from "../services/movements.service"
import { createMovement } from "../actions/movements.actions"
import { MovementFilters } from "../types"
import { MovementFormValues } from "../validators"
import { useToast } from "@/hooks/use-toast"

export function useMovements(filters: MovementFilters) {
  return useQuery({
    queryKey: ["movements", filters],
    queryFn: () => getStockMovements(filters),
  })
}

export function useMovementMutations() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const createMutation = useMutation({
    mutationFn: (data: MovementFormValues) => createMovement(data),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["movements"] })
        queryClient.invalidateQueries({ queryKey: ["inventory"] })
        toast({ title: "Movimentação registrada com sucesso!" })
      } else {
        toast({ title: "Erro ao registrar", description: res.error, variant: "destructive" })
      }
    },
    onError: (error: any) => {
      toast({ title: "Erro inesperado", description: error.message, variant: "destructive" })
    }
  })

  return {
    createMovement: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  }
}
