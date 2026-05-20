import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchServices, saveService, deleteService, fetchServiceCategories } from "../actions/services.actions"
import { ServicesFetchParams } from "../types"
import { ServiceFormValues } from "../validators"
import { toast } from "sonner"

export function useServices(params: ServicesFetchParams) {
  return useQuery({
    queryKey: ["services", params],
    queryFn: () => fetchServices(params),
  })
}

export function useServiceCategories() {
  return useQuery({
    queryKey: ["service_categories"],
    queryFn: () => fetchServiceCategories(),
  })
}

export function useServiceMutations() {
  const queryClient = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: async (data: ServiceFormValues) => {
      const res = await saveService(data)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      toast.success("Serviço salvo com sucesso!")
      queryClient.invalidateQueries({ queryKey: ["services"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro desconhecido.")
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteService(id)
      if (!res.success) {
        const error = new Error(res.error) as any
        error.hasLinkedSales = (res as any).hasLinkedSales
        throw error
      }
      return res
    },
    onSuccess: () => {
      toast.success("Serviço excluído com sucesso!")
      queryClient.invalidateQueries({ queryKey: ["services"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao excluir serviço.")
    }
  })

  return {
    saveService: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    deleteService: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  }
}

