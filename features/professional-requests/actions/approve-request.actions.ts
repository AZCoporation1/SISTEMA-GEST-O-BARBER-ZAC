// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/features/audit/actions/audit.actions"
import { resolveUserProfileId } from "@/lib/supabase/resolve-user"
import { processSale } from "@/features/sales/actions/sales.actions"
import { registerPerfumeSale } from "@/features/perfumes/actions/perfumes.actions"
import { registerAdvance } from "@/features/commissions/actions/professionals.actions"
import type {
  ApproveRequestInput,
  RejectRequestInput,
  ApprovalImpact,
  SubmitInventorySaleInput,
  SubmitServiceSaleInput,
  SubmitPerfumeSaleInput,
  SubmitStockWithdrawalInput,
  SubmitManualDeductionInput,
} from "../types"

// ══════════════════════════════════════════════════════════
// 1. GENERATE IMPACT PREVIEW (read-only — for admin before approving)
// ══════════════════════════════════════════════════════════

export async function generateImpactPreview(requestId: string): Promise<{ success: boolean; data?: ApprovalImpact; error?: string }> {
  const supabase = await createServerClient()

  try {
    const { data: request } = await supabase
      .from('professional_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (!request) throw new Error('Solicitação não encontrada')

    const payload = request.payload_json as any
    const impact: ApprovalImpact = {
      stock: [],
      cash: null,
      financial: null,
      commission: null,
      receivable: null,
    }

    // ── Professional name ──
    const { data: professional } = await supabase
      .from('collaborators')
      .select('name, display_name, default_commission_percent')
      .eq('id', request.professional_id)
      .single()

    const profName = professional?.display_name || professional?.name || 'Profissional'

    switch (request.request_type) {
      case 'inventory_sale': {
        const items = payload.items || []
        const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.unit_price), 0)
        const total = subtotal - (payload.discount_amount || 0)

        // Stock impact
        for (const item of items) {
          const { data: product } = await supabase
            .from('inventory_products')
            .select('name')
            .eq('id', item.product_id)
            .single()

          // Current stock
          const { data: stockData } = await supabase
            .from('vw_inventory_position')
            .select('current_balance')
            .eq('product_id', item.product_id)
            .single()

          impact.stock.push({
            product_name: product?.name || item.product_name,
            quantity_change: -item.quantity,
            current_balance: stockData?.current_balance,
          })
        }

        impact.cash = { amount: total, entry_type: 'sale_income', category: 'Venda (PDV)' }
        impact.financial = { amount: total, movement_type: 'received', category: 'Vendas' }
        break
      }

      case 'service_sale': {
        const items = payload.items || []
        const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.unit_price), 0)
        const total = subtotal - (payload.discount_amount || 0)

        // No stock impact for services
        impact.cash = { amount: total, entry_type: 'sale_income', category: 'Venda Serviço' }
        impact.financial = { amount: total, movement_type: 'received', category: 'Vendas' }
        break
      }

      case 'perfume_sale': {
        const total = payload.unit_price * payload.quantity
        const commissionAmount = total * (payload.commission_percent / 100)

        // Stock impact
        const { data: stockData } = await supabase
          .from('vw_inventory_position')
          .select('current_balance')
          .eq('product_id', payload.inventory_product_id)
          .single()

        impact.stock.push({
          product_name: payload.product_name,
          quantity_change: -payload.quantity,
          current_balance: stockData?.current_balance,
        })

        impact.commission = {
          amount: commissionAmount,
          percent: payload.commission_percent,
          professional_name: profName,
        }

        if (payload.payment_mode === 'cash') {
          impact.cash = { amount: total, entry_type: 'sale_income', category: 'Venda de Perfume' }
          impact.financial = { amount: total, movement_type: 'received', category: 'Receita' }
        } else {
          impact.receivable = {
            total,
            installments: payload.installment_count || 1,
            due_day: payload.due_day,
          }
        }
        break
      }

      case 'stock_withdrawal': {
        const total = payload.quantity * payload.unit_amount

        const { data: stockData } = await supabase
          .from('vw_inventory_position')
          .select('current_balance')
          .eq('product_id', payload.product_id)
          .single()

        impact.stock.push({
          product_name: payload.product_name,
          quantity_change: -payload.quantity,
          current_balance: stockData?.current_balance,
        })

        impact.commission = {
          amount: total,
          percent: 0,
          professional_name: `Dedução: ${profName}`,
        }
        break
      }

      case 'manual_deduction': {
        const total = payload.quantity * payload.unit_amount

        impact.commission = {
          amount: total,
          percent: 0,
          professional_name: `Dedução: ${profName}`,
        }
        break
      }
    }

    return { success: true, data: impact }
  } catch (error: any) {
    console.error('Impact Preview Error:', error)
    return { success: false, error: error.message || 'Erro ao gerar prévia de impacto' }
  }
}

// ══════════════════════════════════════════════════════════
// 2. APPROVE REQUEST (REUSES EXISTING ENGINES — no parallel logic)
// ══════════════════════════════════════════════════════════

export async function approveRequest(data: ApproveRequestInput) {
  const supabase = await createServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

  try {
    // Verify admin permissions
    const { data: adminProfile } = await supabase
      .from('user_profiles')
      .select('system_role, can_approve_professional_requests')
      .eq('id', userProfileId)
      .single()

    if (!adminProfile) throw new Error('Perfil de administrador não encontrado')
    if (!adminProfile.can_approve_professional_requests && adminProfile.system_role !== 'owner_admin_professional') {
      throw new Error('Você não tem permissão para aprovar solicitações')
    }

    // Fetch request
    const { data: request } = await supabase
      .from('professional_requests')
      .select('*')
      .eq('id', data.request_id)
      .single()

    if (!request) throw new Error('Solicitação não encontrada')
    if (request.status !== 'pending') throw new Error('Apenas solicitações pendentes podem ser aprovadas')

    const payload = request.payload_json as any
    let linkedIds: Record<string, string | null> = {}

    // ── Execute via existing engines ──
    switch (request.request_type) {
      case 'inventory_sale': {
        // Build SaleFormValues from payload (same shape as processSale expects)
        const saleData = {
          items: payload.items.map((item: any) => ({
            type: 'product' as const,
            productId: item.product_id,
            name: item.product_name,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            unitCost: item.unit_cost || 0,
            discount: item.discount || 0,
          })),
          customer_id: payload.customer_id || null,
          customer_name_override: payload.customer_name || null,
          collaborator_id: request.professional_id,
          payment_method_id: payload.payment_method_id,
          discount_amount: payload.discount_amount || 0,
          notes: `[Via Solicitação Profissional] ${payload.notes || ''}`.trim(),
        }

        const result = await processSale(saleData)
        if (!result.success) throw new Error('Erro ao processar venda: ' + result.error)
        linkedIds.linked_sale_id = result.data?.id || null
        break
      }

      case 'service_sale': {
        const saleData = {
          items: payload.items.map((item: any) => ({
            type: 'service' as const,
            serviceId: item.service_id || null,
            name: item.service_name,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            unitCost: 0,
            discount: item.discount || 0,
          })),
          customer_id: payload.customer_id || null,
          customer_name_override: payload.customer_name || null,
          collaborator_id: request.professional_id,
          payment_method_id: payload.payment_method_id,
          discount_amount: payload.discount_amount || 0,
          notes: `[Via Solicitação Profissional] ${payload.notes || ''}`.trim(),
        }

        const result = await processSale(saleData)
        if (!result.success) throw new Error('Erro ao processar serviço: ' + result.error)
        linkedIds.linked_sale_id = result.data?.id || null
        break
      }

      case 'perfume_sale': {
        const perfumeData = {
          professional_id: request.professional_id,
          inventory_product_id: payload.inventory_product_id,
          quantity: payload.quantity,
          unit_price: payload.unit_price,
          commission_percent: payload.commission_percent,
          payment_mode: payload.payment_mode,
          payment_method: payload.payment_method || null,
          installment_count: payload.installment_count || null,
          due_day: payload.due_day || null,
          customer_id: payload.customer_id || null,
          customer_name: payload.customer_name,
          customer_phone: payload.customer_phone || null,
          notes: `[Via Solicitação Profissional] ${payload.notes || ''}`.trim(),
        }

        const result = await registerPerfumeSale(perfumeData)
        if (!result.success) throw new Error('Erro ao processar venda de perfume: ' + result.error)
        linkedIds.linked_perfume_sale_id = result.data?.id || null
        break
      }

      case 'stock_withdrawal': {
        const advanceData = {
          professional_id: request.professional_id,
          type: 'stock_consumption' as const,
          source_method: 'estoque' as const,
          description: payload.description,
          quantity: payload.quantity,
          unit_amount: payload.unit_amount,
          product_id: payload.product_id,
          carry_over_to_next_period: false,
          notes: `[Via Solicitação Profissional] ${payload.notes || ''}`.trim(),
        }

        const result = await registerAdvance(advanceData)
        if (!result.success) throw new Error('Erro ao processar retirada: ' + result.error)
        linkedIds.linked_advance_id = result.data?.id || null
        break
      }

      case 'manual_deduction': {
        const advanceData = {
          professional_id: request.professional_id,
          type: 'manual_deduction' as const,
          source_method: 'manual' as const,
          description: payload.description,
          quantity: payload.quantity,
          unit_amount: payload.unit_amount,
          product_id: null,
          carry_over_to_next_period: payload.carry_over_to_next_period || false,
          notes: `[Via Solicitação Profissional] ${payload.notes || ''}`.trim(),
        }

        const result = await registerAdvance(advanceData)
        if (!result.success) throw new Error('Erro ao processar dedução: ' + result.error)
        linkedIds.linked_advance_id = result.data?.id || null
        break
      }

      default:
        throw new Error(`Tipo de solicitação desconhecido: ${request.request_type}`)
    }

    // ── Update request to approved with linked IDs ──
    const { error: updateErr } = await supabase
      .from('professional_requests')
      .update({
        status: 'approved',
        approved_by: userProfileId,
        approved_at: new Date().toISOString(),
        admin_notes: data.admin_notes || null,
        ...linkedIds,
      })
      .eq('id', data.request_id)

    if (updateErr) throw new Error('Erro ao atualizar status: ' + updateErr.message)

    // Audit
    await logAudit({
      action: 'UPDATE',
      entity: 'professional_requests',
      entity_id: data.request_id,
      oldData: request,
      newData: { ...request, status: 'approved', ...linkedIds },
      observation: `Solicitação APROVADA: ${request.title}. Registros oficiais criados. ${data.admin_notes ? `Notas: ${data.admin_notes}` : ''}`
    })

    revalidatePath('/aprovacao-profissionais')
    revalidatePath('/profissional')
    revalidatePath('/profissional/solicitacoes')
    revalidatePath('/vendas')
    revalidatePath('/estoque')
    revalidatePath('/caixa')
    revalidatePath('/fluxo-de-caixa')
    revalidatePath('/comissoes')
    revalidatePath('/perfumes')
    revalidatePath('/dashboard')

    return { success: true }
  } catch (error: any) {
    console.error('Approve Request Error:', error)
    return { success: false, error: error.message || 'Erro ao aprovar solicitação' }
  }
}

// ══════════════════════════════════════════════════════════
// 3. REJECT REQUEST (saves reason, who rejected, when)
// ══════════════════════════════════════════════════════════

export async function rejectRequest(data: RejectRequestInput) {
  const supabase = await createServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

  try {
    // Verify admin permissions
    const { data: adminProfile } = await supabase
      .from('user_profiles')
      .select('system_role, can_approve_professional_requests')
      .eq('id', userProfileId)
      .single()

    if (!adminProfile) throw new Error('Perfil de administrador não encontrado')
    if (!adminProfile.can_approve_professional_requests && adminProfile.system_role !== 'owner_admin_professional') {
      throw new Error('Você não tem permissão para rejeitar solicitações')
    }

    if (!data.rejection_reason || data.rejection_reason.trim().length < 3) {
      throw new Error('Motivo da rejeição é obrigatório (mínimo 3 caracteres)')
    }

    const { data: request } = await supabase
      .from('professional_requests')
      .select('*')
      .eq('id', data.request_id)
      .single()

    if (!request) throw new Error('Solicitação não encontrada')
    if (request.status !== 'pending') throw new Error('Apenas solicitações pendentes podem ser rejeitadas')

    // Update — NO side effects on official tables
    const { error: updateErr } = await supabase
      .from('professional_requests')
      .update({
        status: 'rejected',
        rejection_reason: data.rejection_reason.trim(),
        rejected_by: userProfileId,
        rejected_at: new Date().toISOString(),
      })
      .eq('id', data.request_id)

    if (updateErr) throw updateErr

    // Audit
    await logAudit({
      action: 'UPDATE',
      entity: 'professional_requests',
      entity_id: data.request_id,
      oldData: request,
      newData: { ...request, status: 'rejected', rejection_reason: data.rejection_reason },
      observation: `Solicitação REJEITADA: ${request.title}. Motivo: ${data.rejection_reason}`
    })

    revalidatePath('/aprovacao-profissionais')
    revalidatePath('/profissional/solicitacoes')

    return { success: true }
  } catch (error: any) {
    console.error('Reject Request Error:', error)
    return { success: false, error: error.message || 'Erro ao rejeitar solicitação' }
  }
}
