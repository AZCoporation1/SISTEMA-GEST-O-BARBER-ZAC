import { Sidebar } from '@/components/layout/Sidebar'
import { AiCommandBar } from '@/features/ai-operator/components/AiCommandBar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <main className="page-content">
          {children}
        </main>
      </div>
      <AiCommandBar />
    </div>
  )
}
