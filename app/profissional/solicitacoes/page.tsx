'use client'

import { useAuth } from '@/components/auth-provider'
import { useMyRequests } from '@/features/professional-requests/hooks/useMyRequests'
import { cancelOwnRequest } from '@/features/professional-requests/actions/submit-request.actions'
import { REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS } from '@/features/professional-requests/types'
import { ClipboardList, XCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export default function SolicitacoesPage() {
  const { user } = useAuth()
  const { requests, loading, refetch } = useMyRequests(user?.id || null)
  const [filter, setFilter] = useState<string>('all')
  const [cancelling, setCancelling] = useState<string | null>(null)

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)

  const handleCancel = async (id: string) => {
    if (!confirm('Tem certeza que deseja cancelar esta solicitação?')) return
    setCancelling(id)
    const result = await cancelOwnRequest(id)
    if (result.success) {
      toast.success('Solicitação cancelada')
      refetch()
    } else {
      toast.error(result.error || 'Erro ao cancelar')
    }
    setCancelling(null)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Minhas Solicitações</h1>
          <p className="page-subtitle">{requests.length} solicitações no total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ marginBottom: 20 }}>
        {['all', 'pending', 'approved', 'rejected', 'cancelled'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: filter === status ? 'var(--accent-subtle)' : 'transparent',
              color: filter === status ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              borderColor: filter === status ? 'var(--accent-border)' : 'var(--border)',
            }}
          >
            {status === 'all' ? 'Todas' : REQUEST_STATUS_LABELS[status as keyof typeof REQUEST_STATUS_LABELS]}
          </button>
        ))}
      </div>

      {/* Requests List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 13 }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <ClipboardList className="empty-state-icon" />
          <div className="empty-state-title">Nenhuma solicitação encontrada</div>
          <div className="empty-state-description">Não há solicitações com o filtro selecionado.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(req => (
            <div key={req.id} className="request-card">
              <div className="request-card-header">
                <div>
                  <div className="request-card-title">{req.title}</div>
                  <div className="request-card-meta" style={{ marginTop: 4 }}>
                    <span>{REQUEST_TYPE_LABELS[req.request_type as keyof typeof REQUEST_TYPE_LABELS]}</span>
                    <span>{new Date(req.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <span className={`badge-stock badge-${req.status}`}>
                  {REQUEST_STATUS_LABELS[req.status as keyof typeof REQUEST_STATUS_LABELS]}
                </span>
              </div>

              {req.rejection_reason && (
                <div style={{ fontSize: 12, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.15)' }}>
                  <strong>Motivo da rejeição:</strong> {req.rejection_reason}
                </div>
              )}

              {req.admin_notes && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <strong>Nota do admin:</strong> {req.admin_notes}
                </div>
              )}

              {req.approved_at && (
                <div style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  ✓ Aprovada em {new Date(req.approved_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}

              {req.status === 'pending' && (
                <div className="request-card-actions">
                  <button
                    onClick={() => handleCancel(req.id)}
                    disabled={cancelling === req.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)',
                      background: 'var(--danger-bg)', color: 'var(--danger)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <XCircle size={14} />
                    {cancelling === req.id ? 'Cancelando...' : 'Cancelar'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
