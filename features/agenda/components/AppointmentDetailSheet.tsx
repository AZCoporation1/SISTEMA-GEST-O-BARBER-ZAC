"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  X, Clock, User, Scissors, Phone, FileText,
  Check, XCircle, AlertTriangle, CreditCard, Play, Trash2, RotateCcw
} from "lucide-react"
import {
  cancelAppointment,
  markNoShow,
  checkInAppointment,
  confirmAppointment,
  reopenAppointment,
} from "../actions/agenda.actions"
import type { AppointmentWithRelations } from "../types"
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_COLORS } from "../types"

interface Props {
  appointment: AppointmentWithRelations | null
  open: boolean
  onClose: () => void
  onRefresh: () => void
  onEdit: (a: AppointmentWithRelations) => void
  onOpenCommand: (a: AppointmentWithRelations) => void
}

export default function AppointmentDetailSheet({
  appointment,
  open,
  onClose,
  onRefresh,
  onEdit,
  onOpenCommand,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [showCancelInput, setShowCancelInput] = useState(false)
  const [showReopenConfirm, setShowReopenConfirm] = useState(false)

  if (!open || !appointment) return null

  const colors = APPOINTMENT_STATUS_COLORS[appointment.status]
  const startTime = new Date(appointment.start_at)
  const endTime = new Date(appointment.end_at)
  const timeStr = `${String(startTime.getHours()).padStart(2, "0")}:${String(startTime.getMinutes()).padStart(2, "0")} — ${String(endTime.getHours()).padStart(2, "0")}:${String(endTime.getMinutes()).padStart(2, "0")}`

  const canCheckIn = ["scheduled", "confirmed", "encaixe"].includes(appointment.status)
  const canConfirm = appointment.status === "scheduled"
  const canComplete = ["checked_in", "confirmed", "scheduled", "encaixe"].includes(appointment.status)
  const canCancel = !["completed", "cancelled"].includes(appointment.status)
  const canNoShow = !["completed", "cancelled", "no_show"].includes(appointment.status)
  const canEdit = !["completed", "cancelled"].includes(appointment.status)
  const canReopen = ["completed", "no_show"].includes(appointment.status)
  const hasLinkedSale = appointment.status === "completed" && !!appointment.linked_sale_id

  const handleAction = async (action: () => Promise<any>) => {
    setLoading(true)
    try {
      const result = await action()
      if (result && result.success === false) {
        toast.error(result.error || "Erro ao executar ação")
        setLoading(false)
        return
      }
      toast.success("Ação realizada com sucesso!")
      onRefresh()
      onClose()
    } catch (err: any) {
      toast.error(err.message || "Erro inesperado")
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!cancelReason.trim()) return
    await handleAction(() => cancelAppointment(appointment.id, cancelReason))
  }

  const actionBtnStyle = (color: string): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "none",
    color: "var(--text-primary)",
    fontSize: 12,
    fontWeight: 600,
    cursor: loading ? "wait" : "pointer",
    fontFamily: "inherit",
    width: "100%",
    transition: "all 140ms cubic-bezier(0.22, 1, 0.36, 1)",
    opacity: loading ? 0.5 : 1,
  })

  return (
    <div style={{
      position: "fixed",
      top: 0,
      right: 0,
      bottom: 0,
      width: "100%",
      maxWidth: 420,
      zIndex: 100,
      background: "var(--bg-surface)",
      borderLeft: "1px solid var(--border)",
      boxShadow: "-8px 0 32px rgba(0,0,0,0.25)",
      display: "flex",
      flexDirection: "column",
      animation: "slideInRight 200ms cubic-bezier(0.22, 1, 0.36, 1)",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            padding: "3px 10px",
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 700,
            background: colors.bg,
            color: colors.text,
            border: `1px solid ${colors.border}`,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}>
            {APPOINTMENT_STATUS_LABELS[appointment.status]}
          </span>
          {appointment.source === 'customer' && (
            <span style={{
              padding: "3px 10px",
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 700,
              background: "rgba(20, 184, 166, 0.1)",
              color: "#2dd4bf",
              border: "1px solid rgba(20, 184, 166, 0.3)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}>
              APP CLIENTE
            </span>
          )}
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            #{appointment.id.split("-")[0]}
          </span>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4,
        }}>
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {/* Info cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          <InfoRow 
            icon={User} 
            label="Cliente" 
            value={
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {appointment.customer_name_snapshot || "—"}
                {!appointment.customer_id && (
                  <span style={{
                    fontSize: 7,
                    fontWeight: 700,
                    padding: "1px 4px",
                    borderRadius: 3,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                  }}>
                    Avulso
                  </span>
                )}
              </div>
            } 
          />
          {appointment.customer_phone_snapshot && (
            <InfoRow icon={Phone} label="Telefone" value={appointment.customer_phone_snapshot} />
          )}
          <InfoRow icon={Scissors} label="Serviço" value={appointment.service_name_snapshot || "Sem serviço definido"} />
          <InfoRow icon={Clock} label="Horário" value={timeStr} />
          <InfoRow
            icon={Clock}
            label="Duração"
            value={`${appointment.service_duration_minutes_snapshot || 30} minutos`}
          />
          {appointment.service_price_snapshot != null && (
            <InfoRow icon={CreditCard} label="Valor" value={`R$ ${appointment.service_price_snapshot.toFixed(2)}`} />
          )}
          <InfoRow icon={User} label="Profissional" value={
            (appointment.professional as any)?.display_name || (appointment.professional as any)?.name || "—"
          } />
          {appointment.notes && (
            <InfoRow icon={FileText} label="Observações" value={appointment.notes} />
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            color: "var(--text-muted)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 4,
          }}>
            Ações
          </div>

          {canConfirm && (
            <button style={actionBtnStyle("var(--info)")} onClick={() => handleAction(() => confirmAppointment(appointment.id))}>
              <Check size={14} style={{ color: "var(--info)" }} /> Confirmar Agendamento
            </button>
          )}

          {canCheckIn && (
            <button style={actionBtnStyle("var(--success)")} onClick={() => handleAction(() => checkInAppointment(appointment.id))}>
              <Play size={14} style={{ color: "var(--success)" }} /> Check-in
            </button>
          )}

          {canComplete && (
            <button
              style={{ ...actionBtnStyle("var(--success)"), background: "var(--success-bg)", borderColor: "rgba(16,185,129,0.3)" }}
              onClick={() => { onOpenCommand(appointment); onClose() }}
            >
              <CreditCard size={14} style={{ color: "var(--success)" }} /> Abrir Comanda / Finalizar
            </button>
          )}

          {canEdit && (
            <button style={actionBtnStyle("var(--accent)")} onClick={() => { onEdit(appointment); onClose() }}>
              <FileText size={14} style={{ color: "var(--accent)" }} /> Editar
            </button>
          )}

          {canNoShow && (
            <button style={actionBtnStyle("var(--warning)")} onClick={() => handleAction(() => markNoShow(appointment.id))}>
              <AlertTriangle size={14} style={{ color: "var(--warning)" }} /> Marcar Ausência
            </button>
          )}

          {canCancel && !showCancelInput && (
            <button
              style={{ ...actionBtnStyle("var(--danger)"), color: "var(--danger)" }}
              onClick={() => setShowCancelInput(true)}
            >
              <XCircle size={14} /> Cancelar
            </button>
          )}

          {showCancelInput && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Motivo do cancelamento..."
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--danger)",
                  borderRadius: 8,
                  color: "var(--text-primary)",
                  fontSize: 12,
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  style={{ ...actionBtnStyle("var(--danger)"), color: "var(--danger)", flex: 1 }}
                  onClick={handleCancel}
                  disabled={!cancelReason.trim()}
                >
                  <Trash2 size={14} /> Confirmar Cancelamento
                </button>
                <button
                  onClick={() => { setShowCancelInput(false); setCancelReason("") }}
                  style={{ ...actionBtnStyle(""), width: "auto", padding: "8px 12px" }}
                >
                  Voltar
                </button>
              </div>
            </div>
          )}
        </div>

          {/* Reopen section */}
          {canReopen && (
            <>
              <div style={{
                fontSize: 9,
                fontWeight: 700,
                color: "var(--text-muted)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginTop: 16,
                marginBottom: 4,
              }}>
                Reabertura
              </div>

              {!showReopenConfirm ? (
                <button
                  style={actionBtnStyle("var(--warning)")}
                  onClick={() => setShowReopenConfirm(true)}
                >
                  <RotateCcw size={14} style={{ color: "#f59e0b" }} /> Reabrir Atendimento
                </button>
              ) : (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: 12,
                  background: "rgba(245, 158, 11, 0.06)",
                  border: "1px solid rgba(245, 158, 11, 0.2)",
                  borderRadius: 8,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                    Deseja reabrir este atendimento?
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                    {hasLinkedSale
                      ? "⚠️ Este atendimento possui venda vinculada. Se a venda já foi estornada, a reabertura será liberada automaticamente. Caso contrário, estorne a venda primeiro."
                      : "O atendimento voltará para a agenda como ativo e poderá ser editado, finalizado ou marcado como ausência novamente."
                    }
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      style={{
                        ...actionBtnStyle("#f59e0b"),
                        flex: 1,
                        background: "rgba(245,158,11,0.1)",
                        borderColor: "rgba(245,158,11,0.3)",
                        color: "#f59e0b",
                      }}
                      onClick={() => handleAction(() => reopenAppointment(appointment.id))}
                      disabled={loading}
                    >
                      <RotateCcw size={14} /> Confirmar Reabertura
                    </button>
                    <button
                      onClick={() => setShowReopenConfirm(false)}
                      style={{ ...actionBtnStyle(""), width: "auto", padding: "8px 12px" }}
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
      </div>
    </div>
  )
}

// ── Info Row Component ────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      padding: "8px 12px",
      background: "var(--bg-elevated, rgba(128,128,128,0.04))",
      borderRadius: 8,
      border: "1px solid var(--border)",
      transition: "background 100ms ease",
    }}>
      <Icon size={13} style={{ color: "var(--text-muted)", marginTop: 2, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {label}
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginTop: 2 }}>
          {value}
        </div>
      </div>
    </div>
  )
}
