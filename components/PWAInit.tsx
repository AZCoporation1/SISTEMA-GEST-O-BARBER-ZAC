'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/pwa/register-sw'

export function PWAInit() {
  useEffect(() => {
    registerServiceWorker()
  }, [])

  return null
}
