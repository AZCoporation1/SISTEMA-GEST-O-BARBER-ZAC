// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/features/audit/actions/audit.actions"
import { resolveUserProfileId } from "@/lib/supabase/resolve-user"
import { generateLegitText } from "../services/legit.generator"
import type { RegisterAdvanceInput, ConfirmClosureInput } from "../types"

// ══════════════════════════════════════════════════════════
// 1. REGISTER ADVANCE
// ══════════════════════════════════════════════════════════

export async function registerAdvance(data: RegisterAdvanceInput) {
  const supabase = await createServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

  try {
    let cashEntryId: string | null = null
    let financialMovementId: string | null = null
    let stockMovementId: string | null = null

    const totalAmount = data.quantity * data.unit_amount

    // ── A) Cash advance: cash_entry + financial_movement ──
    if (data.type === 'cash_advance') {
      // Check for open cash session
      const { data: activeSession } = await supabase
        .from('cash_sessions')
        .select('id')
        .eq('status', 'open')
        .single()

      if (!activeSession) {
        return { success: false, error: 'Não há caixa aberto. Abra o caixa antes de registrar adiantamento em dinheiro.' }
      }

      // Create cash entry (expense)
      const { data: cashEntry, error: cashErr } = await supabase
        .from('cash_entries')
        .insert({
          cash_session_id: activeSession.id,
          entry_type: 'expense',
          amount: totalAmount,
          category: 'Adiantamento Profissional',
          description: `Adiantamento: ${data.description}`,
          reference_type: 'professional_advance',
          created_by: userProfileId,
        })
        .select('id')
        .single()

      if (cashErr) throw new Error('Erro ao lançar no caixa: ' + cashErr.message)
      cashEntryId = cashEntry.id

      // Create financial movement (expense)
      const { data: finMov, error: finErr } = await supabase
        .from('financial_movements')
        .insert({
          movement_type: 'paid',
          amount: totalAmount,
          category: 'Despesa Operacional',
          subcategory: 'Adiantamento Profissional',
          description: `Adiantamento caixa: ${data.description}`,
          origin_type: 'professional_advance',
          occurred_on: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (finErr) throw new Error('Erro no fluxo financeiro: ' + finErr.message)
      financialMovementId = finMov.id
    }

    // ── B) PIX advance: financial_movement only ──
    if (data.type === 'pix_advance') {
      const { data: finMov, error: finErr } = await supabase
        .from('financial_movements')
        .insert({
          movement_type: 'paid',
          amount: totalAmount,
          category: 'Despesa Operacional',
          subcategory: 'Adiantamento Profissional (PIX)',
          description: `Adiantamento PIX: ${data.description}`,
          origin_type: 'professional_advance',
          occurred_on: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (finErr) throw new Error('Erro no fluxo financeiro: ' + finErr.message)
      financialMovementId = finMov.id
    }

    // ── C) Stock consumption: stock_movement ──
    if (data.type === 'stock_consumption' && data.product_id) {
      const { data: stockMov, error: stockErr } = await supabase
        .from('stock_movements')
        .insert({
          product_id: data.product_id,
          movement_type: 'internal_consumption',
          quantity: -(data.quantity),
          movement_reason: `Consumo profissional: ${data.description}`,
          source_type: 'professional_consumption',
          destination_type: 'professional',
          notes: `Retirado por profissional`,
          movement_date: new Date().toISOString(),
          performed_by: userProfileId,
        })
        .select('id')
        .single()

      if (stockErr) throw new Error('Erro ao dar baixa no estoque: ' + stockErr.message)
      stockMovementId = stockMov.id
    }

    // ── Create the advance record ──
    const { data: advance, error: advErr } = await supabase
      .from('professional_advances')
      .insert({
        professional_id: data.professional_id,
        type: data.type,
        source_method: data.source_method,
        description: data.description,
        quantity: data.quantity,
        unit_amount: data.unit_amount,
        total_amount: totalAmount,
        product_id: data.product_id || null,
        cash_entry_id: cashEntryId,
        financial_movement_id: financialMovementId,
        stock_movement_id: stockMovementId,
        carry_over_to_next_period: data.carry_over_to_next_period,
        status: 'active',
        created_by: userProfileId,
        notes: data.notes || null,
      })
      .select()
      .single()

    if (advErr) throw new Error('Erro ao registrar adiantamento: ' + advErr.message)

    // ── Audit ──
    await logAudit({
      action: 'INSERT',
      entity: 'professional_advances',
      entity_id: advance.id,
      newData: advance,
      observation: `Adiantamento registrado: ${data.type} - R$ ${totalAmount.toFixed(2)} - ${data.description}`
    })

    revalidatePath('/comissoes')
    revalidatePath('/caixa')
    revalidatePath('/estoque')
    revalidatePath('/fluxo-de-caixa')
    return { success: true, data: advance }
  } catch (error: any) {
    console.error('Register Advance Error:', error)
    return { success: false, error: error.message || 'Erro ao registrar adiantamento' }
  }
}

// ══════════════════════════════════════════════════════════
// 2. CANCEL ADVANCE
// ══════════════════════════════════════════════════════════

export async function cancelAdvance(advanceId: string, reason?: string) {
  const supabase = await createServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

  try {
    const { data: advance, error: fetchErr } = await supabase
      .from('professional_advances')
      .select('*')
      .eq('id', advanceId)
      .single()

    if (fetchErr || !advance) throw new Error('Adiantamento não encontrado')
    if (advance.status !== 'active') throw new Error('Apenas adiantamentos ativos podem ser cancelados')

    // ── Reverse linked cash entry (create inverse, don't delete) ──
    if (advance.cash_entry_id) {
      const { data: activeSession } = await supabase
        .from('cash_sessions').select('id').eq('status', 'open').single()

      if (activeSession) {
        await supabase.from('cash_entries').insert({
          cash_session_id: activeSession.id,
          entry_type: 'manual_income',
          amount: advance.total_amount,
          category: 'Estorno Adiantamento',
          description: `Estorno adiantamento cancelado: ${advance.description}`,
          reference_type: 'advance_cancellation',
          reference_id: advance.id,
          reversal_of_entry_id: advance.cash_entry_id,
          created_by: userProfileId,
        })
      }

      // Mark original as reversed
      await supabase.from('cash_entries')
        .update({ status: 'reversed', cancelled_at: new Date().toISOString(), cancelled_by: userProfileId })
        .eq('id', advance.cash_entry_id)
    }

    // ── Reverse linked financial movement ──
    if (advance.financial_movement_id) {
      const { data: origFin } = await supabase
        .from('financial_movements').select('*').eq('id', advance.financial_movement_id).single()

      if (origFin) {
        await supabase.from('financial_movements').insert({
          movement_type: 'received',
          amount: origFin.amount,
          category: 'Estorno',
          subcategory: 'Estorno Adiantamento Profissional',
          description: `Estorno: ${origFin.description}`,
          origin_type: 'advance_cancellation',
          origin_id: advance.id,
          occurred_on: new Date().toISOString(),
        })
      }
    }

    // ── Reverse linked stock movement ──
    if (advance.stock_movement_id) {
      await supabase.from('stock_movements').insert({
        product_id: advance.product_id,
        movement_type: 'return_from_customer',
        quantity: advance.quantity,
        movement_reason: `Estorno consumo profissional cancelado: ${advance.description}`,
        source_type: 'advance_cancellation',
        destination_type: 'stock',
        reference_type: 'professional_advance',
        reference_id: advance.id,
        movement_date: new Date().toISOString(),
        performed_by: userProfileId,
      })
    }

    // ── Update advance status ──
    const { error: updateErr } = await supabase
      .from('professional_advances')
      .update({
        status: 'cancelled',
        cancelled_by: userProfileId,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || null,
      })
      .eq('id', advanceId)

    if (updateErr) throw updateErr

    await logAudit({
      action: 'UPDATE',
      entity: 'professional_advances',
      entity_id: advanceId,
      oldData: advance,
      newData: { ...advance, status: 'cancelled' },
      observation: `Adiantamento cancelado com estorno completo. Motivo: ${reason || 'Não informado'}. Caixa/financeiro/estoque revertidos.`
    })

    revalidatePath('/comissoes')
    revalidatePath('/caixa')
    revalidatePath('/estoque')
    revalidatePath('/fluxo-de-caixa')
    return { success: true }
  } catch (error: any) {
    console.error('Cancel Advance Error:', error)
    return { success: false, error: error.message || 'Erro ao cancelar adiantamento' }
  }
}

// ══════════════════════════════════════════════════════════
// 3. GENERATE CLOSURE PREVIEW (read-only, no DB writes)
// ══════════════════════════════════════════════════════════

export async function generateClosurePreview(
  professionalId: string,
  periodStart: string,
  periodEnd: string
) {
  const supabase = await createServerClient()

  try {
    // Fetch professional
    const { data: professional, error: profErr } = await supabase
      .from('collaborators')
      .select('*')
      .eq('id', professionalId)
      .single()

    if (profErr || !professional) throw new Error('Profissional não encontrado')

    // Fetch completed sales in period
    const { data: sales } = await supabase
      .from('sales')
      .select('id, total, subtotal, items:sale_items (id, item_type, quantity, total)')
      .eq('collaborator_id', professionalId)
      .eq('status', 'completed')
      .gte('sale_date', periodStart)
      .lte('sale_date', periodEnd)

    let grossTotal = 0
    let salesCount = 0
    let servicesCount = 0
    let productsCount = 0
    let itemsQuantity = 0

    for (const sale of (sales || [])) {
      salesCount++
      grossTotal += Number(sale.total) || 0
      const items = (sale as any).items || []
      for (const item of items) {
        itemsQuantity += Number(item.quantity) || 0
        if (item.item_type === 'service') servicesCount++
        if (item.item_type === 'product') productsCount++
      }
    }

    // ── Perfume sales commissions (additional source) ──
    const { data: perfumeSales } = await supabase
      .from('perfume_sales')
      .select('id, total_price, commission_amount_snapshot, perfume_name_snapshot, quantity')
      .eq('professional_id', professionalId)
      .neq('status', 'cancelled')
      .gte('sale_date', periodStart)
      .lte('sale_date', periodEnd)

    let perfumeGrossTotal = 0
    let perfumeCommissionTotal = 0
    let perfumeSalesCount = 0

    for (const ps of (perfumeSales || [])) {
      perfumeSalesCount++
      perfumeGrossTotal += Number(ps.total_price) || 0
      perfumeCommissionTotal += Number(ps.commission_amount_snapshot) || 0
    }

    // Fetch active advances in period (not carried over and not yet applied)
    const { data: advances } = await supabase
      .from('professional_advances')
      .select('*')
      .eq('professional_id', professionalId)
      .eq('status', 'active')
      .eq('carry_over_to_next_period', false)
      .gte('occurred_at', periodStart)
      .lte('occurred_at', periodEnd)

    // Fetch deferred items
    const { data: deferredItems } = await supabase
      .from('professional_advances')
      .select('*')
      .eq('professional_id', professionalId)
      .eq('status', 'active')
      .eq('carry_over_to_next_period', true)
      .gte('occurred_at', periodStart)
      .lte('occurred_at', periodEnd)

    const commissionPercent = Number(professional.default_commission_percent) || 47
    const barberShareFromSales = grossTotal * (commissionPercent / 100)
    const barberShare = barberShareFromSales + perfumeCommissionTotal
    const barbershopShare = grossTotal - barberShareFromSales
    const advancesTotal = (advances || []).reduce((sum: number, a: any) => sum + Number(a.total_amount), 0)
    const deferredTotal = (deferredItems || []).reduce((sum: number, a: any) => sum + Number(a.total_amount), 0)
    const netPayable = barberShare - advancesTotal

    // Generate legit text
    const allAdvances = [...(advances || []), ...(deferredItems || [])]
    const legitText = generateLegitText({
      displayName: professional.display_name || professional.name,
      periodStart,
      periodEnd,
      grossTotal,
      commissionPercent,
      barbershopShare,
      barberShare: barberShareFromSales,
      advances: allAdvances.map((a: any) => ({
        description: a.description,
        total_amount: Number(a.total_amount),
        carry_over_to_next_period: a.carry_over_to_next_period,
      })),
      advancesTotal,
      deferredTotal,
      netPayable,
      // Perfume data for legit text
      perfumeGrossTotal,
      perfumeCommissionTotal,
      perfumeSalesCount,
    })

    return {
      success: true,
      data: {
        professional,
        grossTotal,
        salesCount,
        servicesCount,
        productsCount,
        itemsQuantity,
        ticketMedio: salesCount > 0 ? grossTotal / salesCount : 0,
        commissionPercent,
        barberShare,
        barbershopShare,
        advances: advances || [],
        advancesTotal,
        deferredItems: deferredItems || [],
        deferredTotal,
        netPayable,
        legitText,
        perfumeGrossTotal,
        perfumeCommissionTotal,
        perfumeSalesCount,
      }
    }
  } catch (error: any) {
    console.error('Closure Preview Error:', error)
    return { success: false, error: error.message || 'Erro ao gerar prévia' }
  }
}

// ══════════════════════════════════════════════════════════
// 4. CONFIRM CLOSURE (freeze + save)
// ══════════════════════════════════════════════════════════

export async function confirmClosure(data: ConfirmClosureInput) {
  const supabase = await createServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

  try {
    // Create closure record
    const { data: closure, error: closureErr } = await supabase
      .from('professional_closures')
      .insert({
        professional_id: data.professional_id,
        period_start: data.period_start,
        period_end: data.period_end,
        payment_reference_date: data.payment_reference_date,
        gross_total: data.gross_total,
        commission_percent_snapshot: data.commission_percent_snapshot,
        barber_share: data.barber_share,
        barbershop_share: data.barbershop_share,
        advances_total: data.advances_total,
        deferred_total: data.deferred_total,
        net_payable: data.net_payable,
        legit_text: data.legit_text,
        status: 'confirmed',
        snapshot_json: data.snapshot_json,
        created_by: userProfileId,
        confirmed_by: userProfileId,
        notes: data.notes || null,
      })
      .select()
      .single()

    if (closureErr) throw new Error('Erro ao salvar fechamento: ' + closureErr.message)

    // Mark included advances as applied
    if (data.advance_ids.length > 0) {
      const { error: advUpdateErr } = await supabase
        .from('professional_advances')
        .update({ status: 'applied', closure_id: closure.id })
        .in('id', data.advance_ids)

      if (advUpdateErr) {
        console.error('Warning: failed to mark advances as applied', advUpdateErr)
      }
    }

    // Audit
    await logAudit({
      action: 'INSERT',
      entity: 'professional_closures',
      entity_id: closure.id,
      newData: closure,
      observation: `Fechamento confirmado. Período: ${data.period_start} a ${data.period_end}. Líquido: R$ ${data.net_payable.toFixed(2)}`
    })

    revalidatePath('/comissoes')
    return { success: true, data: closure }
  } catch (error: any) {
    console.error('Confirm Closure Error:', error)
    return { success: false, error: error.message || 'Erro ao confirmar fechamento' }
  }
}

// ══════════════════════════════════════════════════════════
// 5. PAY CLOSURE VIA CAIXA
// ══════════════════════════════════════════════════════════

export async function payClosureViaCaixa(closureId: string) {
  const supabase = await createServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

  try {
    const { data: closure } = await supabase
      .from('professional_closures')
      .select('*')
      .eq('id', closureId)
      .single()

    if (!closure) throw new Error('Fechamento não encontrado')
    if (closure.status !== 'confirmed') throw new Error('Fechamento precisa estar confirmado para pagamento')

    // Check open cash session
    const { data: activeSession } = await supabase
      .from('cash_sessions')
      .select('id')
      .eq('status', 'open')
      .single()

    if (!activeSession) {
      return { success: false, error: 'Não há caixa aberto para realizar o pagamento.' }
    }

    // Create cash entry
    const { data: cashEntry, error: cashErr } = await supabase
      .from('cash_entries')
      .insert({
        cash_session_id: activeSession.id,
        entry_type: 'expense',
        amount: closure.net_payable,
        category: 'Pagamento Profissional',
        description: `Pagamento fechamento #${closure.id.split('-')[0]}`,
        reference_type: 'professional_closure',
        reference_id: closure.id,
        created_by: userProfileId,
      })
      .select('id')
      .single()

    if (cashErr) throw new Error('Erro ao lançar no caixa: ' + cashErr.message)

    // Create financial movement
    const { data: finMov, error: finErr } = await supabase
      .from('financial_movements')
      .insert({
        movement_type: 'paid',
        amount: closure.net_payable,
        category: 'Despesa Operacional',
        subcategory: 'Pagamento Profissional',
        description: `Pagamento profissional - Fechamento #${closure.id.split('-')[0]}`,
        origin_type: 'professional_closure',
        origin_id: closure.id,
        occurred_on: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (finErr) throw new Error('Erro no fluxo financeiro: ' + finErr.message)

    // Update closure
    const { error: updateErr } = await supabase
      .from('professional_closures')
      .update({
        status: 'paid',
        paid_method: 'caixa',
        paid_at: new Date().toISOString(),
        cash_entry_id: cashEntry.id,
        financial_movement_id: finMov.id,
      })
      .eq('id', closureId)

    if (updateErr) throw updateErr

    await logAudit({
      action: 'UPDATE',
      entity: 'professional_closures',
      entity_id: closureId,
      newData: { status: 'paid', paid_method: 'caixa' },
      observation: `Fechamento pago via Caixa. Valor: R$ ${closure.net_payable.toFixed(2)}`
    })

    revalidatePath('/comissoes')
    revalidatePath('/caixa')
    revalidatePath('/fluxo-de-caixa')
    return { success: true }
  } catch (error: any) {
    console.error('Pay Closure Caixa Error:', error)
    return { success: false, error: error.message || 'Erro ao pagar via caixa' }
  }
}

// ══════════════════════════════════════════════════════════
// 6. PAY CLOSURE VIA PIX
// ══════════════════════════════════════════════════════════

export async function payClosureViaPix(closureId: string) {
  const supabase = await createServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

  try {
    const { data: closure } = await supabase
      .from('professional_closures')
      .select('*')
      .eq('id', closureId)
      .single()

    if (!closure) throw new Error('Fechamento não encontrado')
    if (closure.status !== 'confirmed') throw new Error('Fechamento precisa estar confirmado para pagamento')

    // Financial movement only (no cash entry for PIX)
    const { data: finMov, error: finErr } = await supabase
      .from('financial_movements')
      .insert({
        movement_type: 'paid',
        amount: closure.net_payable,
        category: 'Despesa Operacional',
        subcategory: 'Pagamento Profissional (PIX)',
        description: `Pagamento PIX profissional - Fechamento #${closure.id.split('-')[0]}`,
        origin_type: 'professional_closure',
        origin_id: closure.id,
        occurred_on: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (finErr) throw new Error('Erro no fluxo financeiro: ' + finErr.message)

    const { error: updateErr } = await supabase
      .from('professional_closures')
      .update({
        status: 'paid',
        paid_method: 'pix',
        paid_at: new Date().toISOString(),
        financial_movement_id: finMov.id,
      })
      .eq('id', closureId)

    if (updateErr) throw updateErr

    await logAudit({
      action: 'UPDATE',
      entity: 'professional_closures',
      entity_id: closureId,
      newData: { status: 'paid', paid_method: 'pix' },
      observation: `Fechamento pago via PIX. Valor: R$ ${closure.net_payable.toFixed(2)}`
    })

    revalidatePath('/comissoes')
    revalidatePath('/fluxo-de-caixa')
    return { success: true }
  } catch (error: any) {
    console.error('Pay Closure PIX Error:', error)
    return { success: false, error: error.message || 'Erro ao pagar via PIX' }
  }
}

// ══════════════════════════════════════════════════════════
// 7. CANCEL CLOSURE
// ══════════════════════════════════════════════════════════

export async function cancelClosure(closureId: string, reason?: string) {
  const supabase = await createServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

  try {
    const { data: closure } = await supabase
      .from('professional_closures')
      .select('*')
      .eq('id', closureId)
      .single()

    if (!closure) throw new Error('Fechamento não encontrado')
    if (closure.status === 'cancelled') throw new Error('Fechamento já está cancelado')

    // ── If PAID: reverse all financial movements with inverse entries ──
    if (closure.status === 'paid') {
      // Reverse cash entry if exists
      if (closure.cash_entry_id) {
        const { data: activeSession } = await supabase
          .from('cash_sessions').select('id').eq('status', 'open').single()

        if (activeSession) {
          await supabase.from('cash_entries').insert({
            cash_session_id: activeSession.id,
            entry_type: 'manual_income',
            amount: closure.net_payable,
            category: 'Estorno Pagamento Profissional',
            description: `Estorno fechamento #${closure.id.split('-')[0]} revertido`,
            reference_type: 'closure_reversal',
            reference_id: closure.id,
            reversal_of_entry_id: closure.cash_entry_id,
            created_by: userProfileId,
          })
        }

        // Mark original as reversed
        await supabase.from('cash_entries')
          .update({ status: 'reversed', cancelled_at: new Date().toISOString(), cancelled_by: userProfileId })
          .eq('id', closure.cash_entry_id)
      }

      // Reverse financial movement if exists
      if (closure.financial_movement_id) {
        const { data: origFin } = await supabase
          .from('financial_movements').select('*').eq('id', closure.financial_movement_id).single()

        if (origFin) {
          await supabase.from('financial_movements').insert({
            movement_type: 'received',
            amount: origFin.amount,
            category: 'Estorno',
            subcategory: 'Estorno Pagamento Profissional',
            description: `Estorno: ${origFin.description}`,
            origin_type: 'closure_reversal',
            origin_id: closure.id,
            occurred_on: new Date().toISOString(),
          })
        }
      }
    }

    // Revert advances back to active
    const { error: revertErr } = await supabase
      .from('professional_advances')
      .update({ status: 'active', closure_id: null })
      .eq('closure_id', closureId)

    if (revertErr) {
      console.error('Warning: failed to revert advances', revertErr)
    }

    const { error: updateErr } = await supabase
      .from('professional_closures')
      .update({
        status: 'cancelled',
        cancelled_by: userProfileId,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || null,
      })
      .eq('id', closureId)

    if (updateErr) throw updateErr

    const wasPaid = closure.status === 'paid'
    await logAudit({
      action: 'UPDATE',
      entity: 'professional_closures',
      entity_id: closureId,
      oldData: closure,
      newData: { ...closure, status: 'cancelled' },
      observation: wasPaid
        ? `Fechamento PAGO revertido com movimentos inversos. Motivo: ${reason || 'Não informado'}. Caixa/financeiro estornados.`
        : `Fechamento cancelado. Motivo: ${reason || 'Não informado'}. Adiantamentos revertidos para status ativo.`
    })

    revalidatePath('/comissoes')
    revalidatePath('/caixa')
    revalidatePath('/fluxo-de-caixa')
    return { success: true }
  } catch (error: any) {
    console.error('Cancel Closure Error:', error)
    return { success: false, error: error.message || 'Erro ao cancelar fechamento' }
  }
}
