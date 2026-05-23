'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

const SIDEBAR_COLLAPSED_KEY = 'barber-zac-sidebar-collapsed'

interface SidebarContextValue {
  collapsed: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => {},
})

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (stored === 'true') {
      setCollapsed(true)
    } else if (stored === null && window.matchMedia('(max-width: 1200px)').matches) {
      // Auto-collapse on notebook when no explicit preference saved
      setCollapsed(true)
    }
  }, [])

  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      return next
    })
  }, [])

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebarCollapsed() {
  return useContext(SidebarContext)
}
