/**
 * Barber Zac ERP — Centralized Appointment Visual State Resolver
 * 
 * Determines the visual appearance (colors, badge, tooltip) for an appointment
 * card in the agenda grid. Status takes priority over origin/source.
 *
 * Priority order:
 *  1. Cancelled     → should not appear (filtered before reaching here)
 *  2. Completed     → GREEN, badge "FINALIZADO" (+secondary ASSINANTE/APP/AVULSO)
 *  3. No-show       → RED, badge "AUSÊNCIA" (+secondary ASSINANTE if subscription)
 *  4. Checked-in    → CYAN, badge "CHECK-IN" (+secondary ASSINANTE if subscription)
 *  5. Subscription  → MAGENTA/PURPLE, badge "ASSINANTE" (when is_subscription=true)
 *  6. Blocked       → GRAY, badge "BLOQUEADO"
 *  7. App Cliente   → BLUE, badge "APP"
 *  8. Encaixe       → AMBER, badge "ENCAIXE"
 *  9. Avulso        → ORANGE, badge "AVULSO"
 * 10. Confirmed     → PURPLE, badge "CONFIRMADO"
 * 11. Scheduled     → BLUE, badge "AGENDADO"
 */

import type { AppointmentWithRelations } from "../types"
import { APPOINTMENT_STATUS_COLORS, APPOINTMENT_STATUS_LABELS } from "../types"

export interface AppointmentVisualState {
  bg: string
  border: string
  text: string
  badge: string
  badgeBg: string
  /** Optional secondary badge (e.g. "AVULSO" on a completed walk-in) */
  secondaryBadge?: string
}

/**
 * Resolves the visual state for an appointment card.
 * Status-based states (completed, no_show, checked_in) take absolute priority
 * over origin-based states (app, avulso, cadastrado).
 */
export function resolveAppointmentVisual(appt: AppointmentWithRelations): AppointmentVisualState {
  // ── 1. Status-priority states ─────────────────────────
  // These always override origin colors.

  if (appt.status === "completed") {
    const secondary = getOriginSecondaryBadge(appt)
    return {
      bg: "rgba(16,185,129,0.13)",
      border: "rgba(16,185,129,0.35)",
      text: "#10b981",
      badge: "FINALIZADO",
      badgeBg: "rgba(16,185,129,0.18)",
      ...(secondary ? { secondaryBadge: secondary } : {}),
    }
  }

  if (appt.status === "no_show") {
    const secondary = appt.is_subscription ? "ASSINANTE" : undefined
    return {
      bg: APPOINTMENT_STATUS_COLORS.no_show.bg,
      border: APPOINTMENT_STATUS_COLORS.no_show.border,
      text: APPOINTMENT_STATUS_COLORS.no_show.text,
      badge: "AUSÊNCIA",
      badgeBg: "rgba(239,68,68,0.15)",
      ...(secondary ? { secondaryBadge: secondary } : {}),
    }
  }

  if (appt.status === "checked_in") {
    const secondary = appt.is_subscription ? "ASSINANTE" : undefined
    return {
      bg: APPOINTMENT_STATUS_COLORS.checked_in.bg,
      border: APPOINTMENT_STATUS_COLORS.checked_in.border,
      text: APPOINTMENT_STATUS_COLORS.checked_in.text,
      badge: "CHECK-IN",
      badgeBg: "rgba(6,182,212,0.15)",
      ...(secondary ? { secondaryBadge: secondary } : {}),
    }
  }

  // ── 2. Subscription appointments ──────────────────────
  // Before other origin states. Magenta/purple for subscription.
  if (appt.is_subscription) {
    return {
      bg: "rgba(192,38,211,0.12)",
      border: "rgba(192,38,211,0.30)",
      text: "#c026d3",
      badge: "ASSINANTE",
      badgeBg: "rgba(192,38,211,0.15)",
    }
  }

  // ── 3. Origin-priority states ─────────────────────────
  // Only applied when status is still scheduled/confirmed/encaixe.

  if (appt.source === "customer") {
    return {
      bg: "rgba(59,130,246,0.10)",
      border: "rgba(59,130,246,0.30)",
      text: "#60a5fa",
      badge: "APP",
      badgeBg: "rgba(59,130,246,0.15)",
    }
  }

  if (appt.status === "encaixe") {
    return {
      bg: APPOINTMENT_STATUS_COLORS.encaixe.bg,
      border: APPOINTMENT_STATUS_COLORS.encaixe.border,
      text: APPOINTMENT_STATUS_COLORS.encaixe.text,
      badge: "ENCAIXE",
      badgeBg: "rgba(245,158,11,0.15)",
    }
  }

  if (!appt.customer_id) {
    return {
      bg: "rgba(245,158,11,0.10)",
      border: "rgba(245,158,11,0.30)",
      text: "#fbbf24",
      badge: "AVULSO",
      badgeBg: "rgba(245,158,11,0.15)",
    }
  }

  // ── 4. Default: cadastrado interno ────────────────────
  const sc = APPOINTMENT_STATUS_COLORS[appt.status] || APPOINTMENT_STATUS_COLORS.scheduled
  return {
    ...sc,
    badge: APPOINTMENT_STATUS_LABELS[appt.status]?.toUpperCase() || "AGENDADO",
    badgeBg: "rgba(0,0,0,0.12)",
  }
}

/**
 * Returns a secondary origin label for completed appointments,
 * so the card can optionally show "AVULSO", "APP", or "ASSINANTE" as secondary info.
 */
function getOriginSecondaryBadge(appt: AppointmentWithRelations): string | undefined {
  if (appt.is_subscription) return "ASSINANTE"
  if (appt.source === "customer") return "APP"
  if (!appt.customer_id) return "AVULSO"
  return undefined
}
