import { z } from 'zod'

export const registerPerfumeSaleSchema = z.object({
  professional_id: z.string().uuid('Profissional é obrigatório'),
  customer_id: z.string().uuid().optional().nullable(),
  customer_name: z.string().min(2, 'Nome do cliente é obrigatório'),
  customer_phone: z.string().min(8, 'Telefone do cliente é obrigatório'),
  inventory_product_id: z.string().uuid('Perfume é obrigatório'),
  payment_mode: z.enum(['cash', 'installments'], { message: 'Modo de pagamento obrigatório' }),
  installment_count: z.number().min(2).max(24).optional().nullable(),
  due_day: z.number().min(1).max(31).optional().nullable(),
  unit_price: z.number().min(0.01, 'Preço deve ser maior que zero'),
  quantity: z.number().min(1, 'Quantidade mínima é 1'),
  commission_percent: z.number().min(0).max(100),
  payment_method: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
}).refine(
  (data) => {
    if (data.payment_mode === 'installments') {
      return !!data.installment_count && data.installment_count >= 2
    }
    return true
  },
  { message: 'Vendas a prazo exigem no mínimo 2 parcelas', path: ['installment_count'] }
).refine(
  (data) => {
    if (data.payment_mode === 'installments') {
      return !!data.due_day
    }
    return true
  },
  { message: 'Dia de vencimento é obrigatório para vendas a prazo', path: ['due_day'] }
)

export const payInstallmentSchema = z.object({
  installment_id: z.string().uuid(),
  payment_method: z.string().min(1, 'Método de pagamento é obrigatório'),
})

export const cancelPerfumeSaleSchema = z.object({
  sale_id: z.string().uuid(),
  reason: z.string().min(3, 'Motivo do cancelamento é obrigatório'),
})

export const reverseInstallmentSchema = z.object({
  installment_id: z.string().uuid(),
  reason: z.string().min(3, 'Motivo do estorno é obrigatório'),
})

export type RegisterPerfumeSaleValues = z.infer<typeof registerPerfumeSaleSchema>
export type PayInstallmentValues = z.infer<typeof payInstallmentSchema>
export type CancelPerfumeSaleValues = z.infer<typeof cancelPerfumeSaleSchema>
export type ReverseInstallmentValues = z.infer<typeof reverseInstallmentSchema>
