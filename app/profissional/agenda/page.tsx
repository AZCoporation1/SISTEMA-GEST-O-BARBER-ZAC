// @ts-nocheck
'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/components/auth-provider'
import AgendaMobileView from '@/features/agenda/components/AgendaMobileView'
import AppointmentDialog from '@/features/agenda/components/AppointmentDialog'
import AppointmentDetailSheet from '@/features/agenda/components/AppointmentDetailSheet'
import CommandSheet from '@/features/agenda/components/CommandSheet'
import BlockDialog from '@/features/agenda/components/BlockDialog'
import { useAgendaData, useAgendaSettings, useProfessionals as useAgendaProfessionals, useWorkingHours, useBookableServices } from '@/features/agenda/hooks/useAgenda'
import type { AppointmentWithRelations } from '@/features/agenda/types'
import { Users, Calendar } from 'lucide-react'

function getToday() {
  return new Date().toISOString().split('T')[0]
}

export default function ProfessionalAgendaPage() {
  const { user, hasAdminAccess, isProfessional } = useAuth()
  const [selectedDate, setSelectedDate] = useState(getToday)

  // Data hooks — same as admin agenda
  const { appointments: rawAppointments, blocks: rawBlocks, loading, refresh } = useAgendaData(selectedDate)
  const { settings } = useAgendaSettings()
  const { professionals: rawProfessionals } = useAgendaProfessionals()
  const { hours: rawWorkingHours } = useWorkingHours()
  const { services: rawServices } = useBookableServices()

  // Safe defaults
  const appointments = rawAppointments ?? []
  const blocks = rawBlocks ?? []
  const professionals = rawProfessionals ?? []
  const workingHours = rawWorkingHours ?? []
  const services = rawServices ?? []

  // Permission: professional sees only own agenda
  const restrictToProfessionalId = isProfessional && !hasAdminAccess
    ? user?.collaboratorId || null
    : null

  // Filter for professional role
  const visibleAppointments = restrictToProfessionalId
    ? appointments.filter(a => a.professional_id === restrictToProfessionalId)
    : appointments

  const visibleBlocks = restrictToProfessionalId
    ? blocks.filter(b => b.professional_id === restrictToProfessionalId)
    : blocks

  const visibleProfessionals = restrictToProfessionalId
    ? professionals.filter(p => p.id === restrictToProfessionalId)
    : professionals

  // Dialog states
  const [showAppointmentDialog, setShowAppointmentDialog] = useState(false)
  const [showBlockDialog, setShowBlockDialog] = useState(false)
  const [showDetailSheet, setShowDetailSheet] = useState(false)
  const [showCommandSheet, setShowCommandSheet] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithRelations | null>(null)
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithRelations | null>(null)
  const [defaultSlot, setDefaultSlot] = useState<{ professionalId: string; time: string } | null>(null)

  // Handlers
  const handleSlotClick = useCallback((time: string, profId: string) => {
    setDefaultSlot({ professionalId: profId, time })
    setEditingAppointment(null)
    setShowAppointmentDialog(true)
  }, [])

  const handleAppointmentClick = useCallback((appt: AppointmentWithRelations) => {
    setSelectedAppointment(appt)
    setShowDetailSheet(true)
  }, [])

  const handleEdit = useCallback((appt: AppointmentWithRelations) => {
    setEditingAppointment(appt)
    setDefaultSlot(null)
    setShowAppointmentDialog(true)
  }, [])

  const handleOpenCommand = useCallback((appt: AppointmentWithRelations) => {
    setSelectedAppointment(appt)
    setShowCommandSheet(true)
  }, [])

  // ── Missing collaborator linkage ──
  if (isProfessional && !user?.collaboratorId) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Users size={36} style={{ opacity: 0.3, margin: '0 auto 16px', color: 'var(--text-muted)' }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Vínculo não encontrado
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Seu usuário ainda não está vinculado a um profissional.<br />
          Fale com o administrador.
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={20} style={{ color: 'var(--accent)' }} />
            Minha Agenda
          </h1>
          <p className="page-subtitle">Seus horários e atendimentos</p>
        </div>
      </div>

      {/* Reuse the exact same mobile view from the admin agenda */}
      <AgendaMobileView
        date={selectedDate}
        appointments={visibleAppointments}
        blocks={visibleBlocks}
        professionals={visibleProfessionals}
        workingHours={workingHours}
        settings={settings}
        onSlotClick={handleSlotClick}
        onAppointmentClick={handleAppointmentClick}
        onBlockUnblocked={refresh}
        onDateChange={setSelectedDate}
        onNewAppointment={() => {
          setDefaultSlot(null)
          setEditingAppointment(null)
          setShowAppointmentDialog(true)
        }}
        onNewBlock={() => setShowBlockDialog(true)}
        onOpenWaitlist={() => {}}
        restrictToProfessionalId={restrictToProfessionalId}
        hasAdminAccess={hasAdminAccess}
        isProfessional={isProfessional}
      />

      {/* ═══ Dialogs (same as admin, reused) ═══ */}
      <AppointmentDialog
        open={showAppointmentDialog}
        onClose={() => { setShowAppointmentDialog(false); setEditingAppointment(null) }}
        onSaved={refresh}
        professionals={professionals}
        services={services}
        defaultDate={selectedDate}
        defaultTime={defaultSlot?.time}
        defaultProfessionalId={defaultSlot?.professionalId || restrictToProfessionalId || undefined}
        editingAppointment={editingAppointment}
      />

      <AppointmentDetailSheet
        appointment={selectedAppointment}
        open={showDetailSheet}
        onClose={() => setShowDetailSheet(false)}
        onRefresh={refresh}
        onEdit={handleEdit}
        onOpenCommand={handleOpenCommand}
      />

      <CommandSheet
        appointment={selectedAppointment}
        open={showCommandSheet}
        onClose={() => setShowCommandSheet(false)}
        onCompleted={refresh}
      />

      <BlockDialog
        open={showBlockDialog}
        onClose={() => setShowBlockDialog(false)}
        onSaved={refresh}
        professionals={restrictToProfessionalId ? visibleProfessionals : professionals}
        defaultDate={selectedDate}
      />
    </div>
  )
}
