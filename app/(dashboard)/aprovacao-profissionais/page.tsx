'use client'

import { useAuth } from '@/components/auth-provider'
import { useApprovalQueue } from '@/features/professional-requests/hooks/useApprovalQueue'
import { approveRequest, rejectRequest, generateImpactPreview } from '@/features/professional-requests/actions/approve-request.actions'
import { REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS } from '@/features/professional-requests/types'
import type { ApprovalImpact } from '@/features/professional-requests/types'
import { ShieldCheck, Clock, CheckCircle2, XCircle, AlertTriangle, Package, Wallet, TrendingDown, DollarSign, Eye } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function AprovacaoProfissionaisPage() {
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const { requests, loading, refetch, pendingCount, groupedByProfessional } = useApprovalQueue({ status: statusFilter as any })

  // Professional names lookup
  const [profNames, setProfNames] = useState<Record<string, string>>({})
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null)
  const [impact, setImpact] = useState<ApprovalImpact | null>(null)
  const [loadingImpact, setLoadingImpact] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)

  // Fetch professional names
  useEffect(() => {
    const ids = [...new Set(requests.map(r => r.professional_id))]
    if (ids.length === 0) return

    const supabase = createClient()
    supabase.from('collaborators').select('id, name, display_name').in('id', ids).then(({ data }) => {
      const map: Record<string, string> = {};
      (data as any[])?.forEach((c: any) => { map[c.id] = c.display_name || c.name })
      setProfNames(map)
    })
  }, [requests])

  // Load impact preview
  const loadImpact = async (requestId: string) => {
    setSelectedRequest(requestId)
    setLoadingImpact(true)
    setImpact(null)
    const result = await generateImpactPreview(requestId)
    if (result.success && result.data) {
      setImpact(result.data)
    } else {
      toast.error(result.error || 'Erro ao carregar impacto')
    }
    setLoadingImpact(false)
  }

  const handleApprove = async () => {
    if (!selectedRequest) return
    if (!confirm('Confirma APROVAÇÃO? As alterações serão aplicadas ao sistema.')) return

    setProcessing(true)
    const result = await approveRequest({ request_id: selectedRequest, admin_notes: adminNotes || undefined })
    if (result.success) {
      toast.success('Solicitação aprovada e registros oficiais criados!')
      setSelectedRequest(null)
      setImpact(null)
      setAdminNotes('')
      refetch()
    } else {
      toast.error(result.error || 'Erro ao aprovar')
    }
    setProcessing(false)
  }

  const handleReject = async () => {
    if (!selectedRequest) return
    if (rejectionReason.trim().length < 3) {
      toast.error('Motivo da rejeição é obrigatório')
      return
    }

    setProcessing(true)
    const result = await rejectRequest({ request_id: selectedRequest, rejection_reason: rejectionReason.trim() })
    if (result.success) {
      toast.success('Solicitação rejeitada')
      setSelectedRequest(null)
      setShowRejectModal(false)
      setRejectionReason('')
      refetch()
    } else {
      toast.error(result.error || 'Erro ao rejeitar')
    }
    setProcessing(false)
  }

  const selectedReq = requests.find(r => r.id === selectedRequest)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Aprovação Profissionais</h1>
          <p className="page-subtitle">
            {pendingCount > 0 ? `${pendingCount} solicitação(ões) aguardando aprovação` : 'Nenhuma solicitação pendente'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ marginBottom: 20 }}>
        {['pending', 'approved', 'rejected', 'cancelled'].map(status => (
          <button
            key={status}
            onClick={() => { setStatusFilter(status); setSelectedRequest(null) }}
            style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: statusFilter === status ? 'var(--accent-subtle)' : 'transparent',
              color: statusFilter === status ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              borderColor: statusFilter === status ? 'var(--accent-border)' : 'var(--border)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {REQUEST_STATUS_LABELS[status as keyof typeof REQUEST_STATUS_LABELS]}
            {status === 'pending' && pendingCount > 0 && (
              <span style={{ background: 'var(--warning)', color: '#000', borderRadius: 100, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedRequest ? '1fr 1fr' : '1fr', gap: 16 }}>
        {/* ── LEFT: Request List (grouped by professional) ── */}
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Carregando...</div>
          ) : Object.keys(groupedByProfessional).length === 0 ? (
            <div className="empty-state">
              <ShieldCheck className="empty-state-icon" />
              <div className="empty-state-title">Nenhuma solicitação</div>
              <div className="empty-state-description">
                Não há solicitações com o status selecionado.
              </div>
            </div>
          ) : (
            Object.entries(groupedByProfessional).map(([profId, reqs]) => (
              <div key={profId} className="section-card" style={{ marginBottom: 12 }}>
                <div className="section-card-header">
                  <span className="section-card-title">
                    {profNames[profId] || 'Profissional'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{reqs.length} solicitação(ões)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {reqs.map(req => (
                    <div
                      key={req.id}
                      className="request-card"
                      style={{
                        borderRadius: 0, border: 'none', borderBottom: '1px solid var(--border)',
                        cursor: statusFilter === 'pending' ? 'pointer' : 'default',
                        background: selectedRequest === req.id ? 'var(--accent-subtle)' : 'transparent',
                      }}
                      onClick={() => statusFilter === 'pending' && loadImpact(req.id)}
                    >
                      <div className="request-card-header">
                        <div>
                          <div className="request-card-title">{req.title}</div>
                          <div className="request-card-meta" style={{ marginTop: 4 }}>
                            <span>{REQUEST_TYPE_LABELS[req.request_type as keyof typeof REQUEST_TYPE_LABELS]}</span>
                            <span>{new Date(req.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                        {statusFilter === 'pending' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); loadImpact(req.id) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--accent-border)', background: 'var(--accent-subtle)', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            <Eye size={12} />
                            Revisar
                          </button>
                        )}
                      </div>

                      {req.rejection_reason && (
                        <div style={{ fontSize: 12, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '6px 10px', borderRadius: 6 }}>
                          Motivo: {req.rejection_reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── RIGHT: Impact Preview Panel ── */}
        {selectedRequest && (
          <div className="section-card" style={{ position: 'sticky', top: 72, alignSelf: 'start' }}>
            <div className="section-card-header">
              <span className="section-card-title">Prévia de Impacto</span>
            </div>
            <div className="section-card-body">
              {loadingImpact ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>Calculando impacto...</div>
              ) : impact ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Request title */}
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedReq?.title}
                  </div>

                  {/* Stock Impact */}
                  {impact.stock.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>Impacto no Estoque</div>
                      <div className="impact-grid">
                        {impact.stock.map((s, i) => (
                          <div key={i} className="impact-item">
                            <div className="impact-icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                              <Package size={16} />
                            </div>
                            <div>
                              <div className="impact-label">{s.product_name}</div>
                              <div className="impact-value" style={{ color: 'var(--danger)' }}>{s.quantity_change} un</div>
                              {s.current_balance !== undefined && (
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Saldo atual: {s.current_balance}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cash Impact */}
                  {impact.cash && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>Impacto no Caixa</div>
                      <div className="impact-item">
                        <div className="impact-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                          <DollarSign size={16} />
                        </div>
                        <div>
                          <div className="impact-label">{impact.cash.category}</div>
                          <div className="impact-value" style={{ color: 'var(--success)' }}>+R$ {impact.cash.amount.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Financial Impact */}
                  {impact.financial && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>Fluxo Financeiro</div>
                      <div className="impact-item">
                        <div className="impact-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
                          <TrendingDown size={16} />
                        </div>
                        <div>
                          <div className="impact-label">{impact.financial.category}</div>
                          <div className="impact-value">R$ {impact.financial.amount.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Commission Impact */}
                  {impact.commission && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>Comissão</div>
                      <div className="impact-item">
                        <div className="impact-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                          <Wallet size={16} />
                        </div>
                        <div>
                          <div className="impact-label">{impact.commission.professional_name} ({impact.commission.percent}%)</div>
                          <div className="impact-value" style={{ color: 'var(--warning)' }}>R$ {impact.commission.amount.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Receivable Impact */}
                  {impact.receivable && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>A Receber (Parcelas)</div>
                      <div className="impact-item">
                        <div className="impact-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
                          <Clock size={16} />
                        </div>
                        <div>
                          <div className="impact-label">{impact.receivable.installments}x · Venc. dia {impact.receivable.due_day}</div>
                          <div className="impact-value">R$ {impact.receivable.total.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Admin notes */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                      Notas do Admin (opcional)
                    </label>
                    <textarea
                      value={adminNotes}
                      onChange={e => setAdminNotes(e.target.value)}
                      rows={2}
                      placeholder="Observações sobre a aprovação..."
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    <button
                      onClick={handleApprove}
                      disabled={processing}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(16,185,129,0.3)',
                        background: 'var(--success-bg)', color: 'var(--success)',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <CheckCircle2 size={16} />
                      {processing ? 'Processando...' : 'Aprovar'}
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={processing}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)',
                        background: 'var(--danger-bg)', color: 'var(--danger)',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <XCircle size={16} />
                      Rejeitar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20,
        }}>
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, maxWidth: 440, width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Rejeitar Solicitação</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Informe o motivo da rejeição</div>
              </div>
            </div>

            <textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              rows={3}
              placeholder="Motivo da rejeição (obrigatório)..."
              autoFocus
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', marginBottom: 16 }}
            />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowRejectModal(false); setRejectionReason('') }}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={processing || rejectionReason.trim().length < 3}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)',
                  background: 'var(--danger)', color: '#fff',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  opacity: rejectionReason.trim().length < 3 ? 0.5 : 1,
                }}
              >
                {processing ? 'Rejeitando...' : 'Confirmar Rejeição'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Responsive: collapse to single column on mobile */}
      <style jsx global>{`
        @media (max-width: 1024px) {
          .section-card[style*="sticky"] {
            position: relative !important;
            top: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
