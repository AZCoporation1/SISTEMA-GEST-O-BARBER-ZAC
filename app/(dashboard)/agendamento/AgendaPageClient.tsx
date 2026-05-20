// @ts-nocheck
"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { Plus, Lock, Calendar, ChevronLeft, ChevronRight, Settings, Clock, Repeat, AlertTriangle, X } from "lucide-react"
import { fetchCancelledAppointmentsByDate, type CancelledAppointmentInfo } from "@/features/agenda/services/agenda.service"
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
import ProfessionalViewSelector from "@/features/agenda/components/ProfessionalViewSelector"
import RecurrenceDialog from "@/features/agenda/components/RecurrenceDialog"
import AgendaRuntimeDiagnostics from "@/features/agenda/components/AgendaRuntimeDiagnostics"
import MobileBlockActionSheet from "@/features/agenda/components/MobileBlockActionSheet"
import MobileSlotActionSheet from "@/features/agenda/components/MobileSlotActionSheet"
import { useAgendaData, useAgendaSettings, useProfessionals, useWorkingHours, useBookableServices } from "@/features/agenda/hooks/useAgenda"
import { useAuth } from "@/components/auth-provider"
import type { AppointmentWithRelations, AppointmentBlockRow, AppointmentWaitlistRow } from "@/features/agenda/types"
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
  const { appointments: rawAppointments, blocks: rawBlocks, loading, refresh } = useAgendaData(selectedDate)
  const { settings, refresh: refreshSettings } = useAgendaSettings()
  const { professionals: rawProfessionals } = useProfessionals()
  const { hours: rawWorkingHours, refresh: refreshHours } = useWorkingHours()
  const { services: rawServices } = useBookableServices()
  const { user, hasAdminAccess, isProfessional } = useAuth()
  const isMobile = useIsMobile()

  // ── Safe defaults — prevent undefined.map/filter crashes ──
  const appointments = rawAppointments ?? []
  const blocks = rawBlocks ?? []
  const professionals = rawProfessionals ?? []
  const workingHours = rawWorkingHours ?? []
  const services = rawServices ?? []

  // ═══════════════════════════════════════════════════════════════
  // PROFESSIONAL VIEW SELECTOR — localStorage-backed selection
  // ═══════════════════════════════════════════════════════════════
  const STORAGE_KEY = "barber-zac:agenda-selected-professionals"

  const [selectedProfIds, setSelectedProfIds] = useState<string[]>([])
  const [selectorInitialized, setSelectorInitialized] = useState(false)

  // Initialize from localStorage or default to first professional
  useEffect(() => {
    if (professionals.length === 0) return
    if (selectorInitialized) return

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        // Filter out professionals that no longer exist
        const valid = parsed.filter(id => professionals.some(p => p.id === id))
        if (valid.length > 0) {
          setSelectedProfIds(valid)
          setSelectorInitialized(true)
          return
        }
      }
    } catch {}

    // Default: first professional only
    setSelectedProfIds([professionals[0].id])
    setSelectorInitialized(true)
  }, [professionals, selectorInitialized])

  // Persist to localStorage on change
  useEffect(() => {
    if (!selectorInitialized || selectedProfIds.length === 0) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedProfIds))
    } catch {}
  }, [selectedProfIds, selectorInitialized])

  const handleSelectionChange = useCallback((ids: string[]) => {
    // Never allow empty selection
    if (ids.length === 0) return
    setSelectedProfIds(ids)
  }, [])

  // ── Cancellation banner state ──
  const [cancelledToday, setCancelledToday] = useState<CancelledAppointmentInfo[]>([])
  const [cancelBannerDismissed, setCancelBannerDismissed] = useState(false)

  useEffect(() => {
    setCancelBannerDismissed(false)
    fetchCancelledAppointmentsByDate(selectedDate)
      .then(setCancelledToday)
      .catch(() => setCancelledToday([]))
  }, [selectedDate, appointments])

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
  const [selectedBlock, setSelectedBlock] = useState<AppointmentBlockRow | null>(null)
  const [showBlockSheet, setShowBlockSheet] = useState(false)
  const [showSlotSheet, setShowSlotSheet] = useState(false)

  // Handlers
  const handleSlotClick = useCallback((professionalId: string, time: string) => {
    setDefaultSlot({ professionalId, time })
    setEditingAppointment(null)
    setShowSlotSheet(true)
  }, [])

  const handleAppointmentClick = useCallback((appt: AppointmentWithRelations) => {
    setSelectedAppointment(appt)
    setShowDetailSheet(true)
  }, [])

  const handleBlockClick = useCallback((block: AppointmentBlockRow) => {
    setSelectedBlock(block)
    setShowBlockSheet(true)
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

  // ── Desktop grid professionals: filtered by selector ──
  const gridProfessionals = useMemo(() => {
    if (restrictToProfessionalId) {
      return visibleProfessionals
    }
    if (selectedProfIds.length === 0) {
      return professionals.length > 0 ? [professionals[0]] : []
    }
    // Maintain original order from professionals array
    return professionals.filter(p => selectedProfIds.includes(p.id))
  }, [restrictToProfessionalId, visibleProfessionals, selectedProfIds, professionals])

  // ── Desktop grid filtered appointments & blocks ──
  const gridAppointments = useMemo(() => {
    if (restrictToProfessionalId) return visibleAppointments
    const ids = new Set(gridProfessionals.map(p => p.id))
    return appointments.filter(a => ids.has(a.professional_id))
  }, [restrictToProfessionalId, visibleAppointments, gridProfessionals, appointments])

  const gridBlocks = useMemo(() => {
    if (restrictToProfessionalId) return visibleBlocks
    const ids = new Set(gridProfessionals.map(p => p.id))
    return blocks.filter(b => ids.has(b.professional_id))
  }, [restrictToProfessionalId, visibleBlocks, gridProfessionals, blocks])

  return (
    <div className="page-content">
      <AgendaRuntimeDiagnostics />
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
            onClick={() => { setDefaultSlot(null); setShowBlockDialog(true) }}
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

      {/* Cancellation Banner — internal signaling */}
      {cancelledToday.length > 0 && !cancelBannerDismissed && (
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "10px 14px",
          marginBottom: 12,
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.15)",
          borderRadius: 10,
          fontSize: 12,
        }}>
          <AlertTriangle size={16} style={{ color: "var(--destructive, #ef4444)", flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: "var(--destructive, #ef4444)", marginBottom: 4, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {cancelledToday.length} cancelamento{cancelledToday.length > 1 ? 's' : ''} neste dia
            </div>
            {cancelledToday.slice(0, 3).map(c => {
              const time = new Date(c.start_at).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
              const reason = c.cancellation_reason?.replace('[CLIENTE] ', '') || ''
              return (
                <div key={c.id} style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 600 }}>{time}</span> — {c.customer_name_snapshot || 'Cliente'} · {c.service_name_snapshot}{c.professional?.name ? ` c/ ${c.professional.name}` : ''}{reason ? ` · "${reason}"` : ''}
                </div>
              )
            })}
            {cancelledToday.length > 3 && (
              <div style={{ color: "var(--text-muted)", fontStyle: "italic", marginTop: 2 }}>
                +{cancelledToday.length - 3} outro{cancelledToday.length - 3 > 1 ? 's' : ''}
              </div>
            )}
          </div>
          <button
            onClick={() => setCancelBannerDismissed(true)}
            style={{
              background: "none",
              border: "none",
              padding: 4,
              cursor: "pointer",
              color: "var(--text-muted)",
              flexShrink: 0,
              borderRadius: 6,
            }}
            title="Dispensar"
          >
            <X size={14} />
          </button>
        </div>
      )}

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
          settings={settings}
          onSlotClick={(time, profId) => handleSlotClick(profId, time)}
          onAppointmentClick={handleAppointmentClick}
          onBlockUnblocked={refresh}
          onDateChange={setSelectedDate}
          onNewAppointment={() => { setDefaultSlot(null); setEditingAppointment(null); setShowAppointmentDialog(true) }}
          onNewBlock={() => setShowBlockDialog(true)}
          onOpenWaitlist={() => setShowWaitlistSheet(true)}
          onRefresh={refresh}
          restrictToProfessionalId={restrictToProfessionalId}
          hasAdminAccess={hasAdminAccess}
          isProfessional={isProfessional}
        />
      ) : (
        <>
          {/* Professional View Selector — desktop only, admin only */}
          {!restrictToProfessionalId && professionals.length > 1 && (
            <ProfessionalViewSelector
              professionals={professionals}
              selectedIds={selectedProfIds}
              onSelectionChange={handleSelectionChange}
            />
          )}

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
              appointments={gridAppointments}
              blocks={gridBlocks}
              professionals={gridProfessionals}
              workingHours={workingHours}
              settings={settings}
              selectedDate={selectedDate}
              onSlotClick={handleSlotClick}
              onAppointmentClick={handleAppointmentClick}
              onBlockClick={handleBlockClick}
            />
          </div>
        </>
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
        defaultProfessionalId={defaultSlot?.professionalId}
        defaultStartTime={defaultSlot?.time}
        defaultEndTime={defaultSlot?.time ? (() => {
          const [h, m] = defaultSlot.time.split(':').map(Number)
          const endMin = (h * 60 + m) + (settings?.slot_interval_minutes || 30)
          return `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
        })() : undefined}
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

      {/* Slot action sheet (desktop + mobile — choose agendar or bloquear) */}
      <MobileSlotActionSheet
        open={showSlotSheet}
        onClose={() => setShowSlotSheet(false)}
        time={defaultSlot?.time || ""}
        date={selectedDate}
        professionalName={
          defaultSlot
            ? (professionals.find(p => p.id === defaultSlot.professionalId)?.display_name
              || professionals.find(p => p.id === defaultSlot.professionalId)?.name
              || "")
            : ""
        }
        onAgendarClick={() => {
          setShowSlotSheet(false)
          setShowAppointmentDialog(true)
        }}
        onBloquearClick={() => {
          setShowSlotSheet(false)
          setShowBlockDialog(true)
        }}
      />

      {/* CSS animation for sheets */}
      <style jsx global>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      {/* Block detail sheet (desktop + mobile fallback) */}
      <MobileBlockActionSheet
        open={showBlockSheet}
        onClose={() => { setShowBlockSheet(false); setSelectedBlock(null) }}
        block={selectedBlock}
        onUnblocked={() => { setShowBlockSheet(false); setSelectedBlock(null); refresh() }}
        hasPermission={
          hasAdminAccess ||
          (isProfessional && !!user?.collaboratorId && selectedBlock?.professional_id === user.collaboratorId)
        }
        professionalName={
          selectedBlock
            ? (professionals.find(p => p.id === selectedBlock.professional_id)?.display_name
              || professionals.find(p => p.id === selectedBlock.professional_id)?.name
              || undefined)
            : undefined
        }
      />
    </div>
  )
}
