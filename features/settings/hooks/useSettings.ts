"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getSettings } from "../services/settings.service"
import { updateSettings } from "../actions/settings.actions"
import { SettingsFormValues } from "../validators"
import { useToast } from "@/hooks/use-toast"

export function useAppSettings() {
  return useQuery({
    queryKey: ["appSettings"],
    queryFn: () => getSettings(),
  })
}

export function useSettingsMutations() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const updateMutation = useMutation({
    mutationFn: (data: SettingsFormValues) => updateSettings(data),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["appSettings"] })
        toast({ title: "Configurações salvas com sucesso!" })
      } else {
        toast({ title: "Erro ao salvar", description: res.error, variant: "destructive" })
      }
    },
    onError: (error: any) => {
      toast({ title: "Erro inesperado", description: error.message, variant: "destructive" })
    }
  })

  return {
    updateSettings: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  }
}
