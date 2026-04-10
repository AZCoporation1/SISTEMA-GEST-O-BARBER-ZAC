import { z } from "zod"

export const productSchema = z.object({
  external_code: z.string().min(1, "Código é obrigatório"),
  name: z.string().min(2, "Nome é obrigatório"),
  category_id: z.string().min(1, "Categoria é obrigatória"),
  brand_id: z.string().optional().nullable(),
  cost_price: z.number().min(0, "Custo não pode ser negativo"),
  markup_percent: z.number().min(0, "Markup inválido").max(1000, "Markup muito alto"),
  min_stock: z.number().min(0, "Mínimo não pode ser negativo"),
  max_stock: z.number().min(1, "Máximo deve ser maior que zero"),
  initial_quantity: z.number().min(0, "Quantidade inicial não pode ser negativa").optional().default(0),
  is_for_resale: z.boolean(),
  is_for_internal_use: z.boolean(),
  notes: z.string().optional().nullable(),
}).refine(data => data.max_stock > data.min_stock, {
  message: "Estoque máximo deve ser maior que o mínimo",
  path: ["max_stock"]
})

export type ProductFormValues = z.infer<typeof productSchema>
