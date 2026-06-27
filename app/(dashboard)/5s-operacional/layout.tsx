'use client'

import { useAuth } from '@/components/auth-provider'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CheckSquare, LayoutDashboard, AlertCircle, Clock, BarChart3, Settings } from 'lucide-react'
import { ReactNode } from 'react'

export default function Operational5sLayout({ children }: { children: ReactNode }) {
  const { hasAdminAccess, isLoading } = useAuth()
  const pathname = usePathname()

  if (isLoading) {
    return (
      <div className="flex w-full h-[60vh] items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!hasAdminAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center max-w-md mx-auto">
        <AlertCircle size={48} className="text-[var(--danger)] mb-4" />
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Acesso Negado</h1>
        <p className="text-[var(--text-secondary)] mb-6">
          Você não tem permissão para acessar a gestão operacional do módulo 5S.
        </p>
        <Link href="/dashboard" className="px-4 py-2 bg-[var(--accent)] text-[#000] font-bold rounded-lg hover:bg-[var(--accent-light)] transition-colors">
          Voltar ao Dashboard
        </Link>
      </div>
    )
  }

  const tabs = [
    { href: '/5s-operacional', label: 'Visão Geral', icon: LayoutDashboard, exact: true },
    { href: '/5s-operacional/checklist', label: 'Checklist (O Padrão)', icon: CheckSquare },
    { href: '/5s-operacional/pendencias', label: 'Pendências', icon: AlertCircle },
    { href: '/5s-operacional/historico', label: 'Histórico', icon: Clock },
    { href: '/5s-operacional/relatorios', label: 'Relatórios', icon: BarChart3 },
    { href: '/5s-operacional/configuracoes', label: 'Configurações', icon: Settings },
  ]

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="page-header flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <CheckSquare className="text-[var(--accent)]" size={24} /> 5S Operacional
          </h1>
          <p className="page-subtitle">Disciplina diária. Padrão visível. Gestão contínua.</p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--warning)] bg-[var(--warning-bg)]">
          <span className="w-2 h-2 rounded-full bg-[var(--warning)] animate-pulse" />
          <span className="text-[11px] font-bold tracking-wider text-[var(--warning)] uppercase">
            Módulo em preparação operacional
          </span>
        </div>
      </div>

      {/* Tabs Sub-navigation */}
      <div className="border-b border-[var(--border)] overflow-x-auto hide-scrollbar">
        <nav className="flex gap-1 min-w-max pb-px">
          {tabs.map((tab) => {
            const isActive = tab.exact 
              ? pathname === tab.href 
              : pathname.startsWith(tab.href)
            
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap
                  ${isActive 
                    ? 'border-[var(--accent)] text-[var(--accent)]' 
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
                  }
                `}
              >
                <tab.icon size={16} />
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Content Area */}
      <div className="pt-2">
        {children}
      </div>
    </div>
  )
}
