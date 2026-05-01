import { z } from "zod"

// ── Appointment Validator ────────────────────────────────

export const appointmentSchema = z.object({
  id: z.string().optional(),
  customer_id: z.string().nullable().optional(),
  customer_name: z.string().min(1, "Nome do cliente é obrigatório"),
  customer_phone: z.string().nullable().optional(),
  professional_id: z.string().min(1, "Profissional é obrigatório"),
  service_id: z.string().nullable().optional(),
  start_date: z.string().min(1, "Data é obrigatória"),
  start_time: z.string().min(1, "Hora é obrigatória"),
  duration_minutes: z.coerce.number().min(5, "Duração mínima é 5 minutos").default(30),
  notes: z.string().nullable().optional(),
  status: z.string().default("scheduled"),
  source: z.string().default("admin"),
})

export type AppointmentFormValues = z.infer<typeof appointmentSchema>

// ── Block Validator ──────────────────────────────────────

export const blockSchema = z.object({
  professional_id: z.string().min(1, "Profissional é obrigatório"),
  start_date: z.string().min(1, "Data início é obrigatória"),
  start_time: z.string().min(1, "Hora início é obrigatória"),
  end_date: z.string().min(1, "Data fim é obrigatória"),
  end_time: z.string().min(1, "Hora fim é obrigatória"),
  block_type: z.enum(["manual", "lunch", "meeting", "unavailable"]).default("manual"),
  reason: z.string().min(1, "Motivo é obrigatório"),
})

export type BlockFormValues = z.infer<typeof blockSchema>

// ── Settings Validator ───────────────────────────────────

export const agendaSettingsSchema = z.object({
  opening_time: z.string().min(1, "Horário de abertura é obrigatório"),
  closing_time: z.string().min(1, "Horário de fechamento é obrigatório"),
  slot_interval_minutes: z.coerce.number().refine(v => [15, 30, 60].includes(v), "Intervalo deve ser 15, 30 ou 60 minutos"),
  allow_overbooking: z.boolean().default(false),
})

export type AgendaSettingsFormValues = z.infer<typeof agendaSettingsSchema>

// ── Working Hours Validator ──────────────────────────────

export const workingHoursSchema = z.object({
  professional_id: z.string().min(1),
  weekday: z.coerce.number().min(0).max(6),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  break_start_time: z.string().nullable().optional(),
  break_end_time: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
})

export type WorkingHoursFormValues = z.infer<typeof workingHoursSchema>

// ── Waitlist Validator ───────────────────────────────────

export const waitlistSchema = z.object({
  customer_id: z.string().nullable().optional(),
  customer_name: z.string().min(1, "Nome é obrigatório"),
  customer_phone: z.string().nullable().optional(),
  desired_professional_id: z.string().nullable().optional(),
  desired_service_id: z.string().nullable().optional(),
  desired_date: z.string().nullable().optional(),
  preferred_period: z.enum(["morning", "afternoon", "evening", "any"]).default("any"),
  notes: z.string().nullable().optional(),
})

export type WaitlistFormValues = z.infer<typeof waitlistSchema>

// ── Recurrence Validator ─────────────────────────────────

export const recurrenceSchema = z.object({
  type: z.enum(["weekly", "biweekly", "monthly"]),
  count: z.coerce.number().min(1).max(12, "Máximo 12 ocorrências por criação"),
})

export type RecurrenceFormValues = z.infer<typeof recurrenceSchema>
