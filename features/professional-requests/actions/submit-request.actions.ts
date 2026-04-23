// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/features/audit/actions/audit.actions"
import { resolveUserProfileId } from "@/lib/supabase/resolve-user"
import type {
  SubmitInventorySaleInput,
  SubmitServiceSaleInput,
  SubmitPerfumeSaleInput,
  SubmitStockWithdrawalInput,
  SubmitManualDeductionInput,
} from "../types"

// ══════════════════════════════════════════════════════════
// SUBMIT REQUEST — Professional creates a request (NEVER writes to official tables)
// ══════════════════════════════════════════════════════════

/**
 * Core function: creates a professional_requests record.
 * This is the ONLY table a professional writes to.
 * Official tables are ONLY mutated on admin approval.
 */
async function createRequest(data: {
  request_type: string
  title: string
  professional_id: string
  payload_json: any
  customer_id?: string
  customer_name_snapshot?: string
  customer_phone_snapshot?: string
  inventory_product_id?: string
  service_id?: string
}) {
  const supabase = await createServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

  // Verify the user has professional submission rights
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('system_role, can_submit_professional_requests, collaborator_id')
    .eq('id', userProfileId)
    .single()

  if (!profile) throw new Error('Perfil de usuário não encontrado')
  if (!profile.can_submit_professional_requests && profile.system_role !== 'owner_admin_professional') {
    throw new Error('Você não tem permissão para enviar solicitações')
  }

  // Verify the professional_id matches the user's collaborator_id (unless owner)
  if (profile.system_role === 'professional' && profile.collaborator_id !== data.professional_id) {
    throw new Error('Você só pode criar solicitações para si mesmo')
  }

  const { data: request, error } = await supabase
    .from('professional_requests')
    .insert({
      professional_id: data.professional_id,
      submitted_by: userProfileId,
      request_type: data.request_type,
      status: 'pending',
      title: data.title,
      payload_json: data.payload_json,
      customer_id: data.customer_id || null,
      customer_name_snapshot: data.customer_name_snapshot || null,
      customer_phone_snapshot: data.customer_phone_snapshot || null,
      inventory_product_id: data.inventory_product_id || null,
      service_id: data.service_id || null,
    })
    .select()
    .single()

  if (error) throw new Error('Erro ao criar solicitação: ' + error.message)

  await logAudit({
    action: 'INSERT',
    entity: 'professional_requests',
    entity_id: request.id,
    newData: request,
    observation: `Solicitação criada: ${data.title} (${data.request_type})`
  })

  revalidatePath('/profissional')
  revalidatePath('/profissional/solicitacoes')
  revalidatePath('/aprovacao-profissionais')

  return request
}

// ══════════════════════════════════════════════════════════
// 1. SUBMIT INVENTORY SALE REQUEST
// ══════════════════════════════════════════════════════════

export async function submitInventorySaleRequest(data: SubmitInventorySaleInput) {
  try {
    const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
    const total = subtotal - data.discount_amount
    const itemsDescription = data.items.map(i => `${i.product_name} x${i.quantity}`).join(', ')

    const request = await createRequest({
      request_type: 'inventory_sale',
      title: `Venda: ${itemsDescription} — R$ ${total.toFixed(2)}`,
      professional_id: data.professional_id,
      payload_json: data,
      customer_id: data.customer_id,
      customer_name_snapshot: data.customer_name,
      customer_phone_snapshot: data.customer_phone,
      inventory_product_id: data.items[0]?.product_id,
    })

    return { success: true, data: request }
  } catch (error: any) {
    console.error('Submit Inventory Sale Request Error:', error)
    return { success: false, error: error.message || 'Erro ao enviar solicitação de venda' }
  }
}

// ══════════════════════════════════════════════════════════
// 2. SUBMIT SERVICE SALE REQUEST
// ══════════════════════════════════════════════════════════

export async function submitServiceSaleRequest(data: SubmitServiceSaleInput) {
  try {
    const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
    const total = subtotal - data.discount_amount
    const servicesDescription = data.items.map(i => i.service_name).join(', ')

    const request = await createRequest({
      request_type: 'service_sale',
      title: `Serviço: ${servicesDescription} — R$ ${total.toFixed(2)}`,
      professional_id: data.professional_id,
      payload_json: data,
      customer_id: data.customer_id,
      customer_name_snapshot: data.customer_name,
      customer_phone_snapshot: data.customer_phone,
      service_id: data.items[0]?.service_id,
    })

    return { success: true, data: request }
  } catch (error: any) {
    console.error('Submit Service Sale Request Error:', error)
    return { success: false, error: error.message || 'Erro ao enviar solicitação de serviço' }
  }
}

// ══════════════════════════════════════════════════════════
// 3. SUBMIT PERFUME SALE REQUEST
// ══════════════════════════════════════════════════════════

export async function submitPerfumeSaleRequest(data: SubmitPerfumeSaleInput) {
  try {
    const total = data.unit_price * data.quantity
    const commissionAmount = total * (data.commission_percent / 100)

    const request = await createRequest({
      request_type: 'perfume_sale',
      title: `Perfume: ${data.product_name} x${data.quantity} — R$ ${total.toFixed(2)} (${data.payment_mode === 'cash' ? 'À Vista' : `${data.installment_count}x`})`,
      professional_id: data.professional_id,
      payload_json: { ...data, total, commission_amount: commissionAmount },
      customer_name_snapshot: data.customer_name,
      customer_phone_snapshot: data.customer_phone,
      customer_id: data.customer_id,
      inventory_product_id: data.inventory_product_id,
    })

    return { success: true, data: request }
  } catch (error: any) {
    console.error('Submit Perfume Sale Request Error:', error)
    return { success: false, error: error.message || 'Erro ao enviar solicitação de venda de perfume' }
  }
}

// ══════════════════════════════════════════════════════════
// 4. SUBMIT STOCK WITHDRAWAL REQUEST
// ══════════════════════════════════════════════════════════

export async function submitStockWithdrawalRequest(data: SubmitStockWithdrawalInput) {
  try {
    const total = data.quantity * data.unit_amount

    const request = await createRequest({
      request_type: 'stock_withdrawal',
      title: `Retirada: ${data.product_name} x${data.quantity} — R$ ${total.toFixed(2)}`,
      professional_id: data.professional_id,
      payload_json: data,
      inventory_product_id: data.product_id,
    })

    return { success: true, data: request }
  } catch (error: any) {
    console.error('Submit Stock Withdrawal Request Error:', error)
    return { success: false, error: error.message || 'Erro ao enviar solicitação de retirada' }
  }
}

// ══════════════════════════════════════════════════════════
// 5. SUBMIT MANUAL DEDUCTION REQUEST
// ══════════════════════════════════════════════════════════

export async function submitManualDeductionRequest(data: SubmitManualDeductionInput) {
  try {
    const total = data.quantity * data.unit_amount

    const request = await createRequest({
      request_type: 'manual_deduction',
      title: `Dedução: ${data.description} — R$ ${total.toFixed(2)}`,
      professional_id: data.professional_id,
      payload_json: data,
    })

    return { success: true, data: request }
  } catch (error: any) {
    console.error('Submit Manual Deduction Request Error:', error)
    return { success: false, error: error.message || 'Erro ao enviar solicitação de dedução' }
  }
}

// ══════════════════════════════════════════════════════════
// 6. CANCEL OWN REQUEST (Professional can cancel pending only)
// ══════════════════════════════════════════════════════════

export async function cancelOwnRequest(requestId: string) {
  const supabase = await createServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

  try {
    const { data: request } = await supabase
      .from('professional_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (!request) throw new Error('Solicitação não encontrada')
    if (request.submitted_by !== userProfileId) throw new Error('Você só pode cancelar suas próprias solicitações')
    if (request.status !== 'pending') throw new Error('Apenas solicitações pendentes podem ser canceladas')

    const { error } = await supabase
      .from('professional_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId)

    if (error) throw error

    await logAudit({
      action: 'UPDATE',
      entity: 'professional_requests',
      entity_id: requestId,
      oldData: request,
      newData: { ...request, status: 'cancelled' },
      observation: `Solicitação cancelada pelo profissional: ${request.title}`
    })

    revalidatePath('/profissional/solicitacoes')
    revalidatePath('/aprovacao-profissionais')
    return { success: true }
  } catch (error: any) {
    console.error('Cancel Own Request Error:', error)
    return { success: false, error: error.message || 'Erro ao cancelar solicitação' }
  }
}
