// @ts-nocheck
"use client"

import { useState, useCallback, useEffect } from "react"
import { Plus, Lock, Calendar, ChevronLeft, ChevronRight, Settings, Clock, Repeat } from "lucide-react"
import AgendaDayGrid from "@/features/agenda/components/AgendaDayGrid"
import AgendaCalendarPicker from "@/features/agenda/components/AgendaCalendarPicker"
import AgendaKPIs from "@/features/agenda/components/AgendaKPIs"
import AppointmentDialog from "@/features/agenda/components/AppointmentDialog"
import AppointmentDetailSheet from "@/features/agenda/components/AppointmentDetailSheet"
import CommandSheet from "@/features/agenda/components/CommandSheet"
import BlockDialog from "@/features/agenda/components/BlockDialog"
import AgendaSettingsDialog from "@/features/agenda/components/AgendaSettingsDialog"
import WaitlistSheet from "@/features/agenda/components/WaitlistSheet"
import AgendaMobileView from "@/features/agenda/components/AgendaMobileView"
import RecurrenceDialog from "@/features/agenda/components/RecurrenceDialog"
import { useAgendaData, useAgendaSettings, useProfessionals, useWorkingHours, useBookableServices } from "@/features/agenda/hooks/useAgenda"
import { useAuth } from "@/components/auth-provider"
import type { AppointmentWithRelations, AppointmentWaitlistRow } from "@/features/agenda/types"
import { WEEKDAY_LABELS } from "@/features/agenda/types"

function getToday() {
  const d = new Date()
  return d.toISOString().split("T")[0]
}

function formatDatePtBr(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00")
  const weekday = WEEKDAY_LABELS[d.getDay()]
  const day = d.getDate()
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  return `${weekday}, ${day} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= breakpoint)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [breakpoint])
  return isMobile
}

export default function AgendaPageClient() {
  const [selectedDate, setSelectedDate] = useState(getToday)
  const { appointments, blocks, loading, refresh } = useAgendaData(selectedDate)
  const { settings, refresh: refreshSettings } = useAgendaSettings()
  const { professionals } = useProfessionals()
  const { hours: workingHours, refresh: refreshHours } = useWorkingHours()
  const { services } = useBookableServices()
  const { user, hasAdminAccess, isProfessional } = useAuth()
  const isMobile = useIsMobile()

  // Determine professional restriction for `professional` role
  const restrictToProfessionalId = isProfessional && !hasAdminAccess
    ? user?.collaboratorId || null
    : null

  // Dialog states
  const [showAppointmentDialog, setShowAppointmentDialog] = useState(false)
  const [showBlockDialog, setShowBlockDialog] = useState(false)
  const [showDetailSheet, setShowDetailSheet] = useState(false)
  const [showCommandSheet, setShowCommandSheet] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [showWaitlistSheet, setShowWaitlistSheet] = useState(false)
  const [showRecurrenceDialog, setShowRecurrenceDialog] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithRelations | null>(null)
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithRelations | null>(null)
  const [defaultSlot, setDefaultSlot] = useState<{ professionalId: string; time: string } | null>(null)
  const [showMobileCalendar, setShowMobileCalendar] = useState(false)

  // Handlers
  const handleSlotClick = useCallback((professionalId: string, time: string) => {
    setDefaultSlot({ professionalId, time })
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

  const handleWaitlistConvert = useCallback((item: AppointmentWaitlistRow) => {
    setDefaultSlot(null)
    setEditingAppointment(null)
    setShowAppointmentDialog(true)
    // Pre-fill will happen through the dialog's defaults
  }, [])

  const prevDay = () => {
    const d = new Date(selectedDate + "T12:00:00")
    d.setDate(d.getDate() - 1)
    setSelectedDate(d.toISOString().split("T")[0])
  }

  const nextDay = () => {
    const d = new Date(selectedDate + "T12:00:00")
    d.setDate(d.getDate() + 1)
    setSelectedDate(d.toISOString().split("T")[0])
  }

  const handleSettingsSaved = () => {
    refreshSettings()
    refreshHours()
  }

  // Filter appointments for professional role
  const visibleAppointments = restrictToProfessionalId
    ? appointments.filter(a => a.professional_id === restrictToProfessionalId)
    : appointments

  const visibleBlocks = restrictToProfessionalId
    ? blocks.filter(b => b.professional_id === restrictToProfessionalId)
    : blocks

  const visibleProfessionals = restrictToProfessionalId
    ? professionals.filter(p => p.id === restrictToProfessionalId)
    : professionals

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Agenda</h1>
          <p className="page-subtitle">Agendamentos, bloqueios e comanda integrada</p>
        </div>
        <div className="page-actions">
          {/* Waitlist button */}
          <button
            onClick={() => setShowWaitlistSheet(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 14px",
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Clock size={14} />
            {isMobile ? "" : "Espera"}
          </button>

          {/* Recurrence button */}
          <button
            onClick={() => setShowRecurrenceDialog(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 14px",
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Repeat size={14} />
            {isMobile ? "" : "Recorrência"}
          </button>

          {/* Block button */}
          <button
            onClick={() => setShowBlockDialog(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 14px",
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Lock size={14} />
            {isMobile ? "" : "Bloquear"}
          </button>

          {/* Settings button — admin only */}
          {hasAdminAccess && (
            <button
              onClick={() => setShowSettingsDialog(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 14px",
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-secondary)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <Settings size={14} />
              {isMobile ? "" : "Config"}
            </button>
          )}

          {/* New appointment */}
          <button
            onClick={() => {
              setDefaultSlot(null)
              setEditingAppointment(null)
              setShowAppointmentDialog(true)
            }}
            className="btn-primary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 16px",
              borderRadius: 8,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Plus size={14} />
            {isMobile ? "" : "Novo Agendamento"}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <AgendaKPIs
        appointments={visibleAppointments}
        blocks={visibleBlocks}
        workingHours={workingHours}
        professionals={visibleProfessionals}
        loading={loading}
        date={selectedDate}
      />

      {/* Date Navigation */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 16,
      }}>
        <button
          onClick={prevDay}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 8px",
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
          }}
        >
          <ChevronLeft size={16} />
        </button>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: isMobile ? "pointer" : "default",
        }} onClick={() => isMobile && setShowMobileCalendar(!showMobileCalendar)}>
          <Calendar size={15} style={{ color: "var(--accent)" }} />
          <span style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
          }}>
            {formatDatePtBr(selectedDate)}
          </span>
          {selectedDate === getToday() && (
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 100,
              background: "var(--success-bg)",
              color: "var(--success)",
              border: "1px solid rgba(16,185,129,0.2)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}>
              Hoje
            </span>
          )}
        </div>
        <button
          onClick={nextDay}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 8px",
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
          }}
        >
          <ChevronRight size={16} />
        </button>
        {selectedDate !== getToday() && (
          <button
            onClick={() => setSelectedDate(getToday())}
            style={{
              padding: "5px 10px",
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-muted)",
              fontSize: 10,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Hoje
          </button>
        )}
      </div>

      {/* Mobile Calendar Dropdown */}
      {isMobile && showMobileCalendar && (
        <div style={{ marginBottom: 16 }}>
          <AgendaCalendarPicker
            selectedDate={selectedDate}
            onDateChange={(d) => { setSelectedDate(d); setShowMobileCalendar(false) }}
          />
        </div>
      )}

      {/* Layout: Desktop vs Mobile */}
      {isMobile ? (
        <AgendaMobileView
          date={selectedDate}
          appointments={visibleAppointments}
          blocks={visibleBlocks}
          professionals={visibleProfessionals}
          workingHours={workingHours}
          onSlotClick={(time, profId) => handleSlotClick(profId, time)}
          onAppointmentClick={handleAppointmentClick}
          restrictToProfessionalId={restrictToProfessionalId}
        />
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          gap: 16,
          alignItems: "flex-start",
        }}>
          {/* Sidebar: Calendar Picker */}
          <div style={{ position: "sticky", top: 72 }}>
            <AgendaCalendarPicker
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
            />
          </div>

          {/* Main: Day Grid */}
          <AgendaDayGrid
            appointments={visibleAppointments}
            blocks={visibleBlocks}
            professionals={visibleProfessionals}
            workingHours={workingHours}
            settings={settings}
            selectedDate={selectedDate}
            onSlotClick={handleSlotClick}
            onAppointmentClick={handleAppointmentClick}
          />
        </div>
      )}

      {/* ═══ Dialogs ═══ */}
      <AppointmentDialog
        open={showAppointmentDialog}
        onClose={() => { setShowAppointmentDialog(false); setEditingAppointment(null) }}
        onSaved={refresh}
        professionals={professionals}
        services={services}
        defaultDate={selectedDate}
        defaultTime={defaultSlot?.time}
        defaultProfessionalId={defaultSlot?.professionalId}
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
        professionals={professionals}
        defaultDate={selectedDate}
      />

      {/* New Phase 2 Dialogs */}
      <AgendaSettingsDialog
        open={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        onSaved={handleSettingsSaved}
        settings={settings}
        professionals={professionals}
        workingHours={workingHours}
      />

      <WaitlistSheet
        open={showWaitlistSheet}
        onClose={() => setShowWaitlistSheet(false)}
        onConvertToAppointment={handleWaitlistConvert}
        professionals={professionals}
        services={services}
      />

      <RecurrenceDialog
        open={showRecurrenceDialog}
        onClose={() => setShowRecurrenceDialog(false)}
        onSaved={refresh}
        professionals={professionals}
        services={services}
        defaultDate={selectedDate}
      />

      {/* CSS animation for sheets */}
      <style jsx global>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
