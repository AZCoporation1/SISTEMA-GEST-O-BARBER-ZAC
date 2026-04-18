import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchCustomers, saveCustomer } from "../actions/customers.actions"
import { CustomersFetchParams } from "../types"
import { CustomerFormValues } from "../validators"
import { toast } from "sonner"

export function useCustomers(params: CustomersFetchParams) {
  return useQuery({
    queryKey: ["customers", params],
    queryFn: () => fetchCustomers(params),
  })
}

export function useCustomerMutations() {
  const queryClient = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: async (data: CustomerFormValues) => {
      const res = await saveCustomer(data)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      toast.success("Cliente salvo com sucesso!")
      queryClient.invalidateQueries({ queryKey: ["customers"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro desconhecido.")
    }
  })

  return {
    saveCustomer: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending
  }
}
