import { z } from "zod"
import { Constants } from "@/types/supabase"

export const movementSchema = z.object({
  product_id: z.string().min(1, "Produto é obrigatório"),
  movement_type: z.string().min(1, "Tipo de movimentação inválido"),
  quantity: z.number().min(1, "Quantidade deve ser maior que zero"),
  movement_reason: z.string().min(3, "O motivo detalhado é obrigatório"),
  notes: z.string().optional().nullable(),
})

export type MovementFormValues = z.infer<typeof movementSchema>
