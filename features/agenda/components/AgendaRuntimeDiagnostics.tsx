"use client"

import { useEffect, useRef } from "react"

/**
 * AgendaRuntimeDiagnostics — Route-scoped error listener
 * 
 * Registers window.addEventListener("error") and ("unhandledrejection")
 * only while the agenda route is mounted. Stores the last error in
 * localStorage for post-mortem diagnostics.
 * 
 * Does NOT send data to external services.
 * Does NOT create global telemetry.
 */
export default function AgendaRuntimeDiagnostics() {
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true

    const handleError = (event: ErrorEvent) => {
      const payload = {
        type: "error",
        message: event.message || "Unknown error",
        source: event.filename || "unknown",
        line: event.lineno || 0,
        column: event.colno || 0,
        stack: event.error?.stack?.split("\n").slice(0, 8).join("\n") || null,
        route: "/agendamento",
        timestamp: new Date().toISOString(),
      }

      console.error("[AgendaDiag] Uncaught error:", payload)

      try {
        localStorage.setItem("barberzac_agenda_last_error", JSON.stringify(payload))
      } catch {
        // ignore
      }
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const payload = {
        type: "unhandledrejection",
        message: reason?.message || String(reason) || "Unknown promise rejection",
        stack: reason?.stack?.split("\n").slice(0, 8).join("\n") || null,
        route: "/agendamento",
        timestamp: new Date().toISOString(),
      }

      console.error("[AgendaDiag] Unhandled rejection:", payload)

      try {
        localStorage.setItem("barberzac_agenda_last_error", JSON.stringify(payload))
      } catch {
        // ignore
      }
    }

    window.addEventListener("error", handleError)
    window.addEventListener("unhandledrejection", handleRejection)

    console.info("[AgendaDiag] Runtime diagnostics active for /agendamento")

    return () => {
      mounted.current = false
      window.removeEventListener("error", handleError)
      window.removeEventListener("unhandledrejection", handleRejection)
    }
  }, [])

  // No visual output
  return null
}
