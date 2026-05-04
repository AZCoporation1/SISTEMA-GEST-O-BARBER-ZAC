// @ts-nocheck
'use client'

import { useAuth } from '@/components/auth-provider'
import { useState, useMemo } from 'react'
import { useProfessionals, useProfessionalClosures } from '@/features/commissions/hooks/useProfessionals'
import { ProfessionalHistoryView } from '@/features/commissions/components/ProfessionalHistoryView'
import {
  getCurrentFortnightPeriod,
  getRecentPeriods,
  periodToISO,
  formatFortnightPeriodCompact,
} from '@/features/commissions/services/periodUtils'
import {
  AlertCircle, Calendar, ChevronDown,
} from 'lucide-react'
import Link from 'next/link'

export default function ContaPage() {
  const { user, hasAdminAccess } = useAuth()
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(0)
  const [showPeriodPicker, setShowPeriodPicker] = useState(false)

  const collabId = user?.collaboratorId

  // ── Period ──
  const periods = useMemo(() => getRecentPeriods(8), [])
  const currentPeriod = periods[selectedPeriodIdx]
  const iso = periodToISO(currentPeriod)

  // ── Professional info ──
  const { data: allProfessionals } = useProfessionals()
  const myProfile = useMemo(
    () => (allProfessionals || []).find(p => p.id === collabId),
    [allProfessionals, collabId]
  )
  const commissionPercent = Number(myProfile?.default_commission_percent) || 47
  const displayName = myProfile?.display_name || myProfile?.name || user?.displayName || user?.fullName || '—'

  // ── Missing collaborator ──
  if (!collabId) {
    return (
      <div>
        <div className="page-header">
          <div><h1 className="page-title">Minha Conta</h1><p className="page-subtitle">Resumo do período e comissões</p></div>
        </div>
        <div className="section-card">
          <div className="section-card-body">
            <div className="empty-state" style={{ border: 'none', margin: 0, padding: '48px 24px' }}>
              <AlertCircle className="empty-state-icon" />
              <div className="empty-state-title">Perfil não vinculado</div>
              <div className="empty-state-description">Seu usuário ainda não está vinculado a um profissional. Fale com o administrador.</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ═══ HEADER — Professional + Period ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, fontWeight: 800, color: 'var(--accent)', flexShrink: 0,
        }}>
          {displayName[0]?.toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{commissionPercent}% comissão</span>
          </div>
        </div>
      </div>

      {/* Period selector */}
      <button
        onClick={() => setShowPeriodPicker(!showPeriodPicker)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={14} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {selectedPeriodIdx === 0 ? '⏱ Atual: ' : ''}{formatFortnightPeriodCompact(currentPeriod)}
          </span>
        </div>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: showPeriodPicker ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
      </button>

      {showPeriodPicker && (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
          marginBottom: 16, overflow: 'hidden',
        }}>
          {periods.map((p, i) => (
            <button
              key={i}
              onClick={() => { setSelectedPeriodIdx(i); setShowPeriodPicker(false) }}
              style={{
                width: '100%', padding: '10px 14px', background: i === selectedPeriodIdx ? 'var(--accent-subtle)' : 'transparent',
                border: 'none', borderBottom: '1px solid var(--border)', textAlign: 'left',
                fontSize: 12, fontWeight: i === selectedPeriodIdx ? 700 : 500,
                color: i === selectedPeriodIdx ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {i === 0 ? '⏱ Atual: ' : ''}{formatFortnightPeriodCompact(p)}
            </button>
          ))}
        </div>
      )}

      {/* ═══ REUSE THE SAME LEDGER — admin sees actions, professional sees read-only ═══ */}
      <ProfessionalHistoryView
        professionalId={collabId}
        professionalName={displayName}
        periodStart={iso.start}
        periodEnd={iso.end}
        periodLabel={currentPeriod.label}
        isAdmin={hasAdminAccess}
      />

      {/* Quick agenda link */}
      <Link href="/profissional/agenda" style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
        textDecoration: 'none', transition: 'border-color 150ms', marginTop: 16,
      }}>
        <Calendar size={18} style={{ color: 'var(--accent)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Minha Agenda</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ver horários e atendimentos</div>
        </div>
        <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>›</span>
      </Link>
    </div>
  )
}
