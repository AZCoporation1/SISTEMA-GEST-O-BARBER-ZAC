'use client'

import { useAuth } from '@/components/auth-provider'
import { useMyRequests } from '@/features/professional-requests/hooks/useMyRequests'
import { REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS } from '@/features/professional-requests/types'
import { ClipboardList, Clock, CheckCircle2, XCircle, PlusCircle } from 'lucide-react'
import Link from 'next/link'

export default function ProfissionalDashboard() {
  const { user } = useAuth()
  const { requests, loading } = useMyRequests(user?.id || null)

  const pending = requests.filter(r => r.status === 'pending').length
  const approved = requests.filter(r => r.status === 'approved').length
  const rejected = requests.filter(r => r.status === 'rejected').length
  const recent = requests.slice(0, 5)

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Olá, {user?.displayName || user?.fullName} 👋
          </h1>
          <p className="page-subtitle">Painel do Profissional — Instituto Barber Zac</p>
        </div>
        <div className="page-actions">
          <Link
            href="/profissional/registrar"
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, fontSize: 13, textDecoration: 'none' }}
          >
            <PlusCircle size={16} />
            Registrar
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Pendentes</span>
            <div className="kpi-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'var(--warning)' }}>{loading ? '—' : pending}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Aprovadas</span>
            <div className="kpi-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>{loading ? '—' : approved}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Rejeitadas</span>
            <div className="kpi-icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
              <XCircle size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'var(--danger)' }}>{loading ? '—' : rejected}</div>
        </div>
      </div>

      {/* Recent Requests */}
      <div className="section-card">
        <div className="section-card-header">
          <span className="section-card-title">Últimas Solicitações</span>
          <Link
            href="/profissional/solicitacoes"
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
          >
            Ver todas →
          </Link>
        </div>
        <div className="section-card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
              Carregando...
            </div>
          ) : recent.length === 0 ? (
            <div className="empty-state">
              <ClipboardList className="empty-state-icon" />
              <div className="empty-state-title">Nenhuma solicitação</div>
              <div className="empty-state-description">
                Registre vendas e serviços para que a administração aprove.
              </div>
              <Link
                href="/profissional/registrar"
                className="btn-primary"
                style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, fontSize: 13, textDecoration: 'none' }}
              >
                <PlusCircle size={14} />
                Registrar agora
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recent.map(req => (
                <div key={req.id} className="request-card" style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid var(--border)' }}>
                  <div className="request-card-header">
                    <div>
                      <div className="request-card-title">{req.title}</div>
                      <div className="request-card-meta" style={{ marginTop: 4 }}>
                        <span>{REQUEST_TYPE_LABELS[req.request_type as keyof typeof REQUEST_TYPE_LABELS] || req.request_type}</span>
                        <span>{new Date(req.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    <span className={`badge-stock badge-${req.status}`}>
                      {REQUEST_STATUS_LABELS[req.status as keyof typeof REQUEST_STATUS_LABELS] || req.status}
                    </span>
                  </div>
                  {req.rejection_reason && (
                    <div style={{ fontSize: 12, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '6px 10px', borderRadius: 6 }}>
                      Motivo: {req.rejection_reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
