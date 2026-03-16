import { z } from "zod"

export const saleItemSchema = z.object({
  id: z.string(),
  type: z.enum(["product", "service"]),
  productId: z.string().optional(),
  name: z.string(),
  quantity: z.number().min(1, "Quantidade deve ser maior que zero"),
  unitPrice: z.number().min(0, "Preço inválido"),
  unitCost: z.number().min(0, "Custo inválido"),
  discount: z.number().min(0).default(0),
})

export const saleSchema = z.object({
  customer_id: z.string().optional().nullable(),
  collaborator_id: z.string().optional().nullable(),
  payment_method_id: z.string().min(1, "Forma de pagamento é obrigatória"),
  discount_amount: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  items: z.array(saleItemSchema).min(1, "A venda deve conter pelo menos um item"),
})

export type SaleFormValues = z.infer<typeof saleSchema>
