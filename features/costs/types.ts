import { Database } from "@/types/supabase"
import { z } from "zod"

// DB: fixed_costs table (NOT monthly_fixed_costs)
export type FixedCost = Database["public"]["Tables"]["fixed_costs"]["Row"]
export type VariableCost = Database["public"]["Tables"]["variable_costs"]["Row"]

export interface CostFilters {
  page: number
  perPage: number
  search?: string
  type?: "fixed" | "variable" | "all"
}

// Validators for fixed_costs table 
// DB has: name, amount, category, due_day, frequency, is_active, notes
export const fixedCostSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  description: z.string().optional().nullable(),
  amount: z.number().min(0.01, "Valor deve ser maior que zero"),
  due_day: z.number().min(1).max(31, "Dia de vencimento inválido").optional().nullable(),
  category: z.string().min(2, "Categoria é obrigatória"),
  frequency: z.string(),
  is_active: z.boolean(),
  notes: z.string().optional().nullable(),
})

export type FixedCostFormValues = z.infer<typeof fixedCostSchema>

// Validators for variable_costs table
// DB has: name, amount, category, occurred_on, notes
export const variableCostSchema = z.object({
  name: z.string().min(2, "Descrição é obrigatória"),
  amount: z.number().min(0.01, "Valor deve ser maior que zero"),
  category: z.string().min(2, "Categoria é obrigatória"),
  occurred_on: z.string().optional(),
  notes: z.string().optional().nullable(),
})

export type VariableCostFormValues = z.infer<typeof variableCostSchema>
