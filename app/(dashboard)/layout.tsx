'use client'

import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { AiCommandBar } from '@/features/ai-operator/components/AiCommandBar'
import { SidebarProvider, useSidebarCollapsed } from '@/components/layout/SidebarContext'

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarCollapsed()

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="page-content">
          {children}
        </main>
      </div>
      <AiCommandBar />
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <DashboardShell>{children}</DashboardShell>
    </SidebarProvider>
  )
}
