'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  detectPushSupport,
  detectPlatform,
  getIOSPushStatus,
  getPermissionStatus,
  isInstalledAsPWA,
  requestAndRegisterPush,
  unregisterCurrentDevice,
  isProviderConfigured,
} from '../lib/pushClient'
import type { PermissionStatus, PushPlatform } from '../types'

export type PushState =
  | 'loading'
  | 'not_supported'
  | 'ios_needs_install'
  | 'provider_not_configured'
  | 'permission_default'
  | 'permission_denied'
  | 'ready'
  | 'active'
  | 'error'

export function useNotificationPermission() {
  const queryClient = useQueryClient()
  const [pushState, setPushState] = useState<PushState>('loading')
  const [isPushSupported, setIsPushSupported] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [platform, setPlatform] = useState<PushPlatform>('unknown')
  const [isIOS, setIsIOS] = useState(false)
  const [needsIOSInstall, setNeedsIOSInstall] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const support = detectPushSupport()
    const plat = detectPlatform()
    const iosStatus = getIOSPushStatus()
    const standalone = isInstalledAsPWA()
    const perm = getPermissionStatus()
    const configured = isProviderConfigured()

    setIsPushSupported(support.supported)
    setPlatform(plat)
    setIsIOS(iosStatus.isIOS)
    setNeedsIOSInstall(iosStatus.needsInstall)
    setIsStandalone(standalone)
    setPermissionStatus(perm)

    if (!support.supported) setPushState('not_supported')
    else if (iosStatus.needsInstall) setPushState('ios_needs_install')
    else if (!configured) setPushState('provider_not_configured')
    else if (perm === 'denied') setPushState('permission_denied')
    else if (perm === 'default') setPushState('permission_default')
    else setPushState('ready')

    setIsLoading(false)
  }, [])

  const updateSubscriptionStatus = useCallback((subscribed: boolean) => {
    setIsSubscribed(subscribed)
    if (subscribed) setPushState('active')
  }, [])

  const requestPermission = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await requestAndRegisterPush()
      if (result.success) {
        setPushState('active')
        setPermissionStatus('granted')
        setIsSubscribed(true)
        queryClient.invalidateQueries({ queryKey: ['client-notifications'] })
        return { success: true }
      } else {
        const newPerm = getPermissionStatus()
        setPermissionStatus(newPerm)
        setPushState(newPerm === 'denied' ? 'permission_denied' : 'permission_default')
        setError(result.error || null)
        return { success: false, error: result.error }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao ativar.'
      setPushState('error')
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setIsLoading(false)
    }
  }, [queryClient])

  const deactivate = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await unregisterCurrentDevice()
      if (result.success) {
        setPushState('ready')
        setIsSubscribed(false)
        queryClient.invalidateQueries({ queryKey: ['client-notifications'] })
        return { success: true }
      }
      setError(result.error || null)
      return { success: false, error: result.error }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao desativar.'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setIsLoading(false)
    }
  }, [queryClient])

  return {
    pushState,
    isPushSupported,
    permissionStatus,
    isSubscribed,
    isStandalone,
    platform,
    isIOS,
    needsIOSInstall,
    isLoading,
    error,
    requestPermission,
    deactivate,
    updateSubscriptionStatus,
  }
}
