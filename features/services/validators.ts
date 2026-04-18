import * as z from "zod"

export const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Descrição do serviço é obrigatória"),
  description: z.string().nullable().optional(),
  duration_minutes: z.coerce.number().min(1, "Tempo mínimo é 1 minuto").default(30),
  price: z.coerce.number().min(0, "Valor não pode ser negativo").default(0),
  commission_percent: z.coerce.number().min(0).max(100).default(0),
  category_id: z.string().nullable().optional(),
  price_type: z.string().default("fixed"),
  return_days: z.coerce.number().nullable().optional(),
  is_bookable: z.boolean().default(true),
  show_price: z.boolean().default(true),
  simultaneous_slots: z.coerce.number().min(1).default(1),
  notes: z.string().nullable().optional(),
  image_url: z.string().url("URL inválida").nullable().optional().or(z.literal("")),
  is_active: z.boolean().default(true),
})

export type ServiceFormValues = z.infer<typeof serviceSchema>
