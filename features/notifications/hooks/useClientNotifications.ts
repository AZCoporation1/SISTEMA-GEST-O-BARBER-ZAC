'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/components/auth-provider'
import {
  getClientNotifications,
  getClientUnreadCount,
  getClientSubscriptionStatus,
} from '../actions/notification.client-actions'

export function useClientNotifications(limit = 10) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id

  const notificationsQuery = useQuery({
    queryKey: ['client-notifications', 'inbox', userId, limit],
    queryFn: () => getClientNotifications(limit, 0),
    enabled: !!userId,
    staleTime: 60_000,
  })

  const unreadCountQuery = useQuery({
    queryKey: ['client-notifications', 'unread-count', userId],
    queryFn: () => getClientUnreadCount(),
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 120_000,
  })

  const subscriptionStatusQuery = useQuery({
    queryKey: ['client-notifications', 'subscription-status', userId],
    queryFn: () => getClientSubscriptionStatus(),
    enabled: !!userId,
    staleTime: 300_000,
  })

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['client-notifications'] })
  }

  return {
    notifications: notificationsQuery.data?.data || [],
    totalNotifications: notificationsQuery.data?.total || 0,
    isLoadingNotifications: notificationsQuery.isLoading,
    unreadCount: unreadCountQuery.data?.count || 0,
    isLoadingUnread: unreadCountQuery.isLoading,
    hasActiveSubscription: subscriptionStatusQuery.data?.hasActiveSubscription || false,
    deviceCount: subscriptionStatusQuery.data?.deviceCount || 0,
    isLoadingSubscription: subscriptionStatusQuery.isLoading,
    invalidateAll,
    refetchNotifications: notificationsQuery.refetch,
    refetchUnread: unreadCountQuery.refetch,
  }
}
