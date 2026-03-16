'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const productSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  category_id: z.string().nullable(),
  brand: z.string().nullable(),
  purchase_price: z.number().nullable(),
  markup_percent: z.number().default(45),
  qty_min: z.number().min(0).default(0),
  qty_max: z.number().min(0).default(0),
})

export async function createProduct(formData: FormData) {
  const supabase = (await createServerClient()) as any
  
  const rawData = {
    code: formData.get('code') as string,
    description: formData.get('description') as string,
    category_id: formData.get('category_id') as string || null,
    brand: formData.get('brand') as string || null,
    purchase_price: formData.get('purchase_price') ? parseFloat(formData.get('purchase_price') as string) : null,
    markup_percent: formData.get('markup_percent') ? parseFloat(formData.get('markup_percent') as string) : 45,
    qty_min: parseInt(formData.get('qty_min') as string) || 0,
    qty_max: parseInt(formData.get('qty_max') as string) || 0,
  }
  
  const validated = productSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: 'Dados inválidos', details: validated.error.flatten() }
  }
  
  const insertData: any = {
    ...validated.data,
    is_active: true,
    qty_current: 0
  }

  const { error } = await supabase
    .from('products')
    .insert(insertData)
    
  if (error) {
    if (error.code === '23505') {
      return { error: 'Este código de produto já está em uso.' }
    }
    return { error: error.message }
  }
  
  revalidatePath('/estoque')
  redirect('/estoque')
}

export async function updateProduct(id: string, formData: FormData) {
  const supabase = (await createServerClient()) as any
  
  const rawData = {
    code: formData.get('code') as string,
    description: formData.get('description') as string,
    category_id: formData.get('category_id') as string || null,
    brand: formData.get('brand') as string || null,
    purchase_price: formData.get('purchase_price') ? parseFloat(formData.get('purchase_price') as string) : null,
    markup_percent: formData.get('markup_percent') ? parseFloat(formData.get('markup_percent') as string) : 45,
    qty_min: parseInt(formData.get('qty_min') as string) || 0,
    qty_max: parseInt(formData.get('qty_max') as string) || 0,
  }
  
  const validated = productSchema.safeParse(rawData)
  if (!validated.success) {
    return { error: 'Dados inválidos', details: validated.error.flatten() }
  }
  
  const { error } = await supabase
    .from('products')
    .update(validated.data as any)
    .eq('id', id)
    
  if (error) {
    if (error.code === '23505') {
      return { error: 'Este código de produto já está em uso.' }
    }
    return { error: error.message }
  }
  
  revalidatePath('/estoque')
  redirect('/estoque')
}

export async function deactivateProduct(id: string) {
  const supabase = (await createServerClient()) as any
  
  const { error } = await supabase
    .from('products')
    .update({ is_active: false } as any)
    .eq('id', id)
    
  if (error) {
    return { error: error.message }
  }
  
  revalidatePath('/estoque')
  redirect('/estoque')
}
