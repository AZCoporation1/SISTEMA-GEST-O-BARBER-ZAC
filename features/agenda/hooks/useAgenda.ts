"use client"

import { useCallback, useEffect, useState } from "react"
import {
  fetchAppointmentsByDate,
  fetchBlocksByDate,
  fetchAgendaSettings,
  fetchProfessionalHours,
  fetchProfessionals,
  fetchBookableServices,
  fetchWaitlist,
  fetchPaymentMethods,
} from "../services/agenda.service"
import type {
  AppointmentWithRelations,
  AppointmentBlockRow,
  AgendaSettingsRow,
  ProfessionalWorkingHoursRow,
  ProfessionalForAgenda,
  AppointmentWaitlistRow,
} from "../types"

// ── Main Agenda Data Hook ────────────────────────────────

export function useAgendaData(date: string) {
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([])
  const [blocks, setBlocks] = useState<AppointmentBlockRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [appts, blks] = await Promise.all([
        fetchAppointmentsByDate(date),
        fetchBlocksByDate(date),
      ])
      setAppointments(appts)
      setBlocks(blks)
    } catch (err) {
      console.error("useAgendaData error:", err)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { appointments, blocks, loading, refresh }
}

// ── Settings Hook ────────────────────────────────────────

export function useAgendaSettings() {
  const [settings, setSettings] = useState<AgendaSettingsRow | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAgendaSettings()
      setSettings(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { settings, loading, refresh }
}

// ── Professionals Hook ───────────────────────────────────

export function useProfessionals() {
  const [professionals, setProfessionals] = useState<ProfessionalForAgenda[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProfessionals()
      .then(setProfessionals)
      .finally(() => setLoading(false))
  }, [])

  return { professionals, loading }
}

// ── Working Hours Hook ───────────────────────────────────

export function useWorkingHours() {
  const [hours, setHours] = useState<ProfessionalWorkingHoursRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchProfessionalHours()
      setHours(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { hours, loading, refresh }
}

// ── Services Hook ────────────────────────────────────────

export function useBookableServices() {
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBookableServices()
      .then(setServices)
      .finally(() => setLoading(false))
  }, [])

  return { services, loading }
}

// ── Waitlist Hook ────────────────────────────────────────

export function useWaitlist() {
  const [waitlist, setWaitlist] = useState<AppointmentWaitlistRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchWaitlist()
      setWaitlist(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { waitlist, loading, refresh }
}

// ── Payment Methods Hook ─────────────────────────────────

export function usePaymentMethods() {
  const [methods, setMethods] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    fetchPaymentMethods().then(setMethods)
  }, [])

  return { methods }
}
