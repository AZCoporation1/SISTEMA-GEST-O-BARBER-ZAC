"use client"

import { useState, useRef, useEffect } from "react"
import { AlertTriangle, X, Bell } from "lucide-react"
import type { CancelledAppointmentInfo } from "../services/agenda.service"

interface Props {
  cancelledToday: CancelledAppointmentInfo[]
  onDismiss: () => void
}

/**
 * Cancellation alerts for the Agenda.
 * 
 * On large screens (≥1280px width AND ≥700px height): shows inline compact banner.
 * On notebook / compact screens: shows a small badge button + dropdown popover.
 */
export default function AgendaCancellationAlerts({ cancelledToday, onDismiss }: Props) {
  const [showPopover, setShowPopover] = useState(false)
  const [isCompact, setIsCompact] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Detect compact mode via CSS media query (no resize listener spam)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1280px), (max-height: 700px)")
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsCompact(e.matches)
    handler(mq)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showPopover])

  if (cancelledToday.length === 0) return null

  // ── COMPACT MODE: Badge button + Popover ──
  if (isCompact) {
    return (
      <div ref={popoverRef} style={{ position: "relative", display: "inline-flex", marginBottom: 6 }}>
        <button
          onClick={() => setShowPopover(!showPopover)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.18)",
            borderRadius: 8,
            color: "var(--destructive, #ef4444)",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "all 150ms ease",
          }}
          title={`${cancelledToday.length} cancelamento(s) neste dia`}
        >
          <Bell size={12} />
          <span>{cancelledToday.length}</span>
          <span style={{ fontWeight: 500, fontSize: 10 }}>cancelamento{cancelledToday.length > 1 ? "s" : ""}</span>
        </button>

        {showPopover && (
          <div style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 4,
            zIndex: 60,
            width: "min(380px, 90vw)",
            maxHeight: 280,
            overflowY: "auto",
            background: "var(--bg-surface)",
            border: "1px solid rgba(239,68,68,0.18)",
            borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            padding: 12,
            fontSize: 11,
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}>
              <span style={{
                fontWeight: 700,
                color: "var(--destructive, #ef4444)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                {cancelledToday.length} cancelamento{cancelledToday.length > 1 ? "s" : ""}
              </span>
              <button
                onClick={() => { setShowPopover(false); onDismiss() }}
                style={{
                  background: "none", border: "none", padding: 2, cursor: "pointer",
                  color: "var(--text-muted)", borderRadius: 4,
                }}
              >
                <X size={12} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {cancelledToday.map(c => {
                const time = new Date(c.start_at).toLocaleTimeString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                  hour: "2-digit",
                  minute: "2-digit",
                })
                const reason = c.cancellation_reason?.replace("[CLIENTE] ", "") || ""
                return (
                  <div key={c.id} style={{
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                    padding: "3px 0",
                    borderBottom: "1px solid var(--border)",
                  }}>
                    <span style={{ fontWeight: 600 }}>{time}</span> — {c.customer_name_snapshot || "Cliente"} · {c.service_name_snapshot}
                    {c.professional?.name ? ` c/ ${c.professional.name}` : ""}
                    {reason ? ` · "${reason}"` : ""}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── FULL MODE: Inline compact banner (desktop large) ──
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 8,
      padding: "8px 12px",
      marginBottom: 8,
      background: "rgba(239,68,68,0.06)",
      border: "1px solid rgba(239,68,68,0.15)",
      borderRadius: 8,
      fontSize: 11,
    }}>
      <AlertTriangle size={14} style={{ color: "var(--destructive, #ef4444)", flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 700, color: "var(--destructive, #ef4444)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {cancelledToday.length} cancelamento{cancelledToday.length > 1 ? "s" : ""}
        </span>
        <span style={{ color: "var(--text-secondary)", marginLeft: 6 }}>
          {cancelledToday.slice(0, 3).map(c => {
            const time = new Date(c.start_at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })
            return `${time} ${c.customer_name_snapshot || "Cliente"}`
          }).join(" · ")}
          {cancelledToday.length > 3 ? ` +${cancelledToday.length - 3}` : ""}
        </span>
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: "none", border: "none", padding: 4, cursor: "pointer",
          color: "var(--text-muted)", flexShrink: 0, borderRadius: 6,
        }}
        title="Dispensar"
      >
        <X size={12} />
      </button>
    </div>
  )
}
