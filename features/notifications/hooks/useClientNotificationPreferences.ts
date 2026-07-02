'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/components/auth-provider'
import {
  getMyNotificationPreferences,
  updateNotificationPreferences,
} from '../actions/notification.actions'
import type { NotificationPreferencesInput } from '../types'

export function useClientNotificationPreferences() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id

  const preferencesQuery = useQuery({
    queryKey: ['client-notifications', 'preferences', userId],
    queryFn: () => getMyNotificationPreferences(),
    enabled: !!userId,
    staleTime: 300_000,
  })

  const updateMutation = useMutation({
    mutationFn: (prefs: NotificationPreferencesInput) => updateNotificationPreferences(prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-notifications', 'preferences'] })
    },
  })

  return {
    preferences: preferencesQuery.data?.data || null,
    isLoading: preferencesQuery.isLoading,
    isUpdating: updateMutation.isPending,
    updatePreferences: updateMutation.mutate,
    updateError: updateMutation.error?.message || null,
  }
}
