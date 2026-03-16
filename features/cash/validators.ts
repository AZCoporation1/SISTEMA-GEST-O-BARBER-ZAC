import { z } from "zod"
import { Constants } from "@/types/supabase"

// cash_sessions uses opening_amount / closing_amount (not opening_balance)
export const openSessionSchema = z.object({
  opening_amount: z.number().min(0, "O valor não pode ser negativo"),
  notes: z.string().optional().nullable(),
})

export const closeSessionSchema = z.object({
  closing_amount: z.number().min(0, "O valor não pode ser negativo"),
  notes: z.string().optional().nullable(),
})

// cash_entries.entry_type is a plain string in DB (not an enum type),
// but we use the Constants.public.Enums.cash_entry_type array for the UI select values.
export const cashEntrySchema = z.object({
  cash_session_id: z.string().uuid(),
  entry_type: z.string().min(1, "Tipo de lançamento é obrigatório"),
  amount: z.number().min(0.01, "O valor deve ser maior que zero"),
  category: z.string().min(1, "A categoria é obrigatória"),
  description: z.string().min(3, "Descrição detalhada é obrigatória"),
  payment_method_id: z.string().uuid("Forma de pagamento inválida").optional().nullable(),
})

export type OpenSessionValues = z.infer<typeof openSessionSchema>
export type CloseSessionValues = z.infer<typeof closeSessionSchema>
export type CashEntryValues = z.infer<typeof cashEntrySchema>
