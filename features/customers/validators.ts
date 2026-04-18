import { z } from "zod"

export const customerSchema = z.object({
  id: z.string().optional(),
  full_name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  mobile_phone: z.string().optional().nullable(),
  ddi: z.string().optional().nullable(),
  cpf: z.string().optional().nullable(),
  rg: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  address_line: z.string().optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  address_number: z.string().optional().nullable(),
  complement: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  referral_source: z.string().optional().nullable(),
  is_active: z.boolean().default(true).optional().nullable(),
})

export type CustomerFormValues = z.infer<typeof customerSchema>
