import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchServices, saveService, fetchServiceCategories } from "../actions/services.actions"
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

  return {
    saveService: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending
  }
}
