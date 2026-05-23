import { z } from "zod"

export const saleItemSchema = z.object({
  id: z.string(),
  type: z.enum(["product", "service"]),
  productId: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  name: z.string(),
  quantity: z.number().min(1, "Quantidade deve ser maior que zero"),
  unitPrice: z.number().min(0, "Preço inválido"),
  unitCost: z.number().min(0, "Custo inválido"),
  discount: z.number().min(0).default(0),
})

export const saleSchema = z.object({
  customer_id: z.string().optional().nullable(),
  customer_name_override: z.string().optional().nullable(),
  collaborator_id: z.string().optional().nullable(),
  payment_method_id: z.string().min(1, "Forma de pagamento é obrigatória"),
  discount_amount: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  items: z.array(saleItemSchema).min(1, "A venda deve conter pelo menos um item"),
  // Installment fields (optional — only used when payment_mode !== 'upfront')
  payment_mode: z.enum(["upfront", "installment", "mixed"]).default("upfront").optional(),
  payment_origin: z.enum(["credit_card_installment", "store_credit"]).optional().nullable(),
  installment_count: z.number().min(2).max(12).optional().nullable(),
  first_due_date: z.string().optional().nullable(),
  upfront_amount: z.number().min(0).optional().nullable(),
  installment_notes: z.string().optional().nullable(),
})


export type SaleFormValues = z.infer<typeof saleSchema>
