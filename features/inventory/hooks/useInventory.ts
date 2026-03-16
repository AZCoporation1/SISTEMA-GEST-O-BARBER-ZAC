"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getInventoryPositions, getCategories, getBrands } from "../services/inventory.service"
import { createProduct, updateProduct, toggleProductStatus } from "../actions/inventory.actions"
import { InventoryFilters } from "../types"
import { ProductFormValues } from "../validators"
import { useToast } from "@/hooks/use-toast"

export function useInventory(filters: InventoryFilters) {
  return useQuery({
    queryKey: ["inventory", filters],
    queryFn: () => getInventoryPositions(filters),
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories()
  })
}

export function useBrands() {
  return useQuery({
    queryKey: ["brands"],
    queryFn: () => getBrands()
  })
}

export function useProductMutations() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const createMutation = useMutation({
    mutationFn: (data: ProductFormValues) => createProduct(data),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["inventory"] })
        toast({ title: "Produto criado com sucesso!" })
      } else {
        toast({ title: "Erro ao criar", description: res.error, variant: "destructive" })
      }
    },
    onError: (error: any) => {
      toast({ title: "Erro inesperado", description: error.message, variant: "destructive" })
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: ProductFormValues }) => updateProduct(id, data),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["inventory"] })
        toast({ title: "Produto atualizado com sucesso!" })
      } else {
        toast({ title: "Erro ao atualizar", description: res.error, variant: "destructive" })
      }
    },
    onError: (error: any) => {
      toast({ title: "Erro inesperado", description: error.message, variant: "destructive" })
    }
  })

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, currentStatus }: { id: string, currentStatus: boolean }) => toggleProductStatus(id, currentStatus),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["inventory"] })
        toast({ title: "Status alterado com sucesso!" })
      } else {
        toast({ title: "Erro ao alterar status", description: res.error, variant: "destructive" })
      }
    }
  })

  return {
    createProduct: createMutation.mutateAsync,
    updateProduct: updateMutation.mutateAsync,
    toggleStatus: toggleStatusMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isToggling: toggleStatusMutation.isPending
  }
}
