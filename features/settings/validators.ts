import { z } from "zod"

export const settingsSchema = z.object({
  organization_name: z.string().min(2, "Nome é obrigatório"),
  currency: z.string().min(1, "Moeda é obrigatória"),
  timezone: z.string().min(1, "Fuso horário é obrigatório"),
  default_markup: z.number().min(0, "O markup não pode ser negativo").max(1000, "Markup inválido"),
  low_stock_alert_enabled: z.boolean(),
  critical_stock_alert_enabled: z.boolean(),
  ai_enabled: z.boolean(),
})

export type SettingsFormValues = z.infer<typeof settingsSchema>
