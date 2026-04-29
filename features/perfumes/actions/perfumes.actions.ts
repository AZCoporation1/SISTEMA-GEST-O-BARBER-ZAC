// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/features/audit/actions/audit.actions"
import { resolveUserProfileId } from "@/lib/supabase/resolve-user"
import type { RegisterPerfumeSaleInput, PayInstallmentInput, CancelPerfumeSaleInput, ReverseInstallmentPaymentInput } from "../types"

// ══════════════════════════════════════════════════════════
// 1. REGISTER PERFUME SALE
// ══════════════════════════════════════════════════════════

export async function registerPerfumeSale(data: RegisterPerfumeSaleInput) {
  const supabase = await createServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

  try {
    // ── Validate product exists and get snapshots ──
    const { data: product, error: prodErr } = await supabase
      .from('inventory_products')
      .select('id, name, external_code, cost_price, sale_price_generated, sale_price_cash, sale_price_installment, is_active, is_for_resale')
      .eq('id', data.inventory_product_id)
      .single()

    if (prodErr || !product) throw new Error('Perfume não encontrado no estoque')
    if (!product.is_active) throw new Error('Produto inativo não pode ser vendido')

    // ── Validate professional ──
    const { data: professional } = await supabase
      .from('collaborators')
      .select('id, name, default_commission_percent')
      .eq('id', data.professional_id)
      .single()

    if (!professional) throw new Error('Profissional não encontrado')

    // ── Customer handling (upsert walk-in) ──
    let customerId = data.customer_id || null
    const customerName = data.customer_name
    const customerPhone = data.customer_phone

    if (!customerId && customerName && customerPhone) {
      // Try to find existing customer by phone
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .or(`mobile_phone.eq.${customerPhone},phone.eq.${customerPhone}`)
        .limit(1)
        .single()

      if (existingCustomer) {
        customerId = existingCustomer.id
      } else {
        // Create new customer
        const normalizedName = customerName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const { data: newCustomer, error: custErr } = await supabase
          .from('customers')
          .insert({
            full_name: customerName,
            normalized_name: normalizedName,
            mobile_phone: customerPhone,
            is_active: true,
          })
          .select('id')
          .single()

        if (custErr) throw new Error('Erro ao registrar cliente: ' + custErr.message)
        customerId = newCustomer.id
      }
    }

    // ── Server-side dual pricing resolution ──
    // Resolve the expected price based on payment mode + product pricing
    const expectedPrice = data.payment_mode === 'cash'
      ? (product.sale_price_cash ?? product.sale_price_generated ?? 0)
      : (product.sale_price_installment ?? product.sale_price_generated ?? 0)

    // Use the frontend-submitted price if provided (allows manual override),
    // otherwise use the server-resolved price
    const effectiveUnitPrice = data.unit_price > 0 ? data.unit_price : expectedPrice

    // ── Calculate totals ──
    const totalPrice = effectiveUnitPrice * data.quantity
    const commissionAmount = totalPrice * (data.commission_percent / 100)

    // ── Stock deduction (immediate for both cash and installments) ──
    const { data: stockMov, error: stockErr } = await supabase
      .from('stock_movements')
      .insert({
        product_id: data.inventory_product_id,
        movement_type: 'sale_exit',
        quantity: -(data.quantity),
        movement_reason: `Venda de perfume: ${product.name}`,
        source_type: 'perfume_sale',
        destination_type: 'customer',
        unit_cost_snapshot: product.cost_price,
        unit_sale_snapshot: effectiveUnitPrice,
        total_cost_snapshot: product.cost_price * data.quantity,
        total_sale_snapshot: totalPrice,
        reference_type: 'perfume_sale',
        movement_date: new Date().toISOString(),
        performed_by: userProfileId,
      })
      .select('id')
      .single()

    if (stockErr) throw new Error('Erro ao dar baixa no estoque: ' + stockErr.message)

    let cashEntryId: string | null = null
    let financialMovementId: string | null = null
    let saleStatus: string = 'active'

    // ── A) Cash/À Vista payment ──
    if (data.payment_mode === 'cash') {
      // Check for open cash session
      const { data: activeSession } = await supabase
        .from('cash_sessions')
        .select('id')
        .eq('status', 'open')
        .single()

      if (activeSession) {
        // Create cash entry (income)
        const { data: cashEntry, error: cashErr } = await supabase
          .from('cash_entries')
          .insert({
            cash_session_id: activeSession.id,
            entry_type: 'sale_income',
            amount: totalPrice,
            category: 'Venda de Perfume',
            description: `Perfume: ${product.name} — Cliente: ${customerName}`,
            reference_type: 'perfume_sale',
            created_by: userProfileId,
          })
          .select('id')
          .single()

        if (cashErr) throw new Error('Erro ao registrar no caixa: ' + cashErr.message)
        cashEntryId = cashEntry.id
      }

      // Financial movement (revenue)
      const { data: finMov, error: finErr } = await supabase
        .from('financial_movements')
        .insert({
          movement_type: 'received',
          amount: totalPrice,
          category: 'Receita',
          subcategory: 'Venda de Perfume',
          description: `Venda perfume ${product.name} — ${customerName}`,
          origin_type: 'perfume_sale',
          occurred_on: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (finErr) throw new Error('Erro no fluxo financeiro: ' + finErr.message)
      financialMovementId = finMov.id
      saleStatus = 'completed'
    }

    // ── B) Installments/A Prazo ──
    if (data.payment_mode === 'installments') {
      saleStatus = 'receivable_open'
    }

    // ── Create perfume sale record ──
    const { data: sale, error: saleErr } = await supabase
      .from('perfume_sales')
      .insert({
        professional_id: data.professional_id,
        customer_id: customerId,
        customer_name_snapshot: customerName,
        customer_phone_snapshot: customerPhone,
        inventory_product_id: data.inventory_product_id,
        external_code_snapshot: product.external_code,
        perfume_name_snapshot: product.name,
        sale_date: new Date().toISOString(),
        payment_mode: data.payment_mode,
        installment_count: data.installment_count || null,
        due_day: data.due_day || null,
        unit_price_snapshot: effectiveUnitPrice,
        quantity: data.quantity,
        total_price: totalPrice,
        commission_percent_snapshot: data.commission_percent,
        commission_amount_snapshot: commissionAmount,
        payment_method_initial: data.payment_method || null,
        status: saleStatus,
        linked_cash_entry_id: cashEntryId,
        linked_financial_movement_id: financialMovementId,
        stock_movement_id: stockMov.id,
        created_by: userProfileId,
        notes: data.notes || null,
      })
      .select()
      .single()

    if (saleErr) throw new Error('Erro ao registrar venda: ' + saleErr.message)

    // ── Create installments if a prazo ──
    if (data.payment_mode === 'installments' && data.installment_count && data.due_day) {
      const installmentAmount = Math.round((totalPrice / data.installment_count) * 100) / 100
      const installments = []

      for (let i = 1; i <= data.installment_count; i++) {
        const dueDate = new Date()
        dueDate.setMonth(dueDate.getMonth() + i)
        dueDate.setDate(Math.min(data.due_day, new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate()))

        installments.push({
          perfume_sale_id: sale.id,
          installment_number: i,
          due_date: dueDate.toISOString().split('T')[0],
          amount: i === data.installment_count
            ? totalPrice - (installmentAmount * (data.installment_count - 1)) // last installment gets remainder
            : installmentAmount,
          status: 'open',
        })
      }

      const { error: instErr } = await supabase
        .from('perfume_sale_installments')
        .insert(installments)

      if (instErr) throw new Error('Erro ao criar parcelas: ' + instErr.message)
    }

    // ── Audit ──
    await logAudit({
      action: 'INSERT',
      entity: 'perfume_sales',
      entity_id: sale.id,
      newData: sale,
      observation: `Venda de perfume: ${product.name} — R$ ${totalPrice.toFixed(2)} — ${data.payment_mode === 'cash' ? 'À Vista' : `${data.installment_count}x A Prazo`} — Profissional: ${professional.name}`
    })

    revalidatePath('/perfumes')
    revalidatePath('/estoque')
    revalidatePath('/caixa')
    revalidatePath('/fluxo-de-caixa')
    revalidatePath('/clientes')
    revalidatePath('/comissoes')
    return { success: true, data: sale }
  } catch (error: any) {
    console.error('Register Perfume Sale Error:', error)
    return { success: false, error: error.message || 'Erro ao registrar venda de perfume' }
  }
}

// ══════════════════════════════════════════════════════════
// 2. PAY INSTALLMENT
// ══════════════════════════════════════════════════════════

export async function payPerfumeInstallment(data: PayInstallmentInput) {
  const supabase = await createServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

  try {
    // Fetch installment
    const { data: installment, error: instErr } = await supabase
      .from('perfume_sale_installments')
      .select('*, perfume_sale:perfume_sales(*)')
      .eq('id', data.installment_id)
      .single()

    if (instErr || !installment) throw new Error('Parcela não encontrada')
    if (installment.status === 'paid') throw new Error('Parcela já está paga')
    if (installment.status === 'cancelled') throw new Error('Parcela cancelada não pode ser paga')

    const perfumeSale = installment.perfume_sale

    let cashEntryId: string | null = null
    let financialMovementId: string | null = null

    // Check for open cash session
    const { data: activeSession } = await supabase
      .from('cash_sessions')
      .select('id')
      .eq('status', 'open')
      .single()

    if (activeSession) {
      const { data: cashEntry, error: cashErr } = await supabase
        .from('cash_entries')
        .insert({
          cash_session_id: activeSession.id,
          entry_type: 'sale_income',
          amount: installment.amount,
          category: 'Recebimento Perfume (Parcela)',
          description: `Parcela ${installment.installment_number} — ${perfumeSale.perfume_name_snapshot} — ${perfumeSale.customer_name_snapshot}`,
          reference_type: 'perfume_installment',
          reference_id: installment.id,
          created_by: userProfileId,
        })
        .select('id')
        .single()

      if (cashErr) throw new Error('Erro ao registrar no caixa: ' + cashErr.message)
      cashEntryId = cashEntry.id
    }

    // Financial movement
    const { data: finMov, error: finErr } = await supabase
      .from('financial_movements')
      .insert({
        movement_type: 'received',
        amount: installment.amount,
        category: 'Receita',
        subcategory: 'Recebimento Perfume (Parcela)',
        description: `Parcela ${installment.installment_number}/${perfumeSale.installment_count} — ${perfumeSale.perfume_name_snapshot} — ${perfumeSale.customer_name_snapshot}`,
        origin_type: 'perfume_installment',
        origin_id: installment.id,
        occurred_on: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (finErr) throw new Error('Erro no fluxo financeiro: ' + finErr.message)
    financialMovementId = finMov.id

    // Update installment
    const { error: updateErr } = await supabase
      .from('perfume_sale_installments')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_method: data.payment_method,
        cash_entry_id: cashEntryId,
        financial_movement_id: financialMovementId,
      })
      .eq('id', data.installment_id)

    if (updateErr) throw updateErr

    // Check if all installments are paid → mark sale as settled
    const { data: remainingOpen } = await supabase
      .from('perfume_sale_installments')
      .select('id')
      .eq('perfume_sale_id', perfumeSale.id)
      .in('status', ['open', 'overdue'])

    if (!remainingOpen || remainingOpen.length === 0) {
      await supabase
        .from('perfume_sales')
        .update({ status: 'receivable_settled' })
        .eq('id', perfumeSale.id)
    }

    // Audit
    await logAudit({
      action: 'UPDATE',
      entity: 'perfume_sale_installments',
      entity_id: data.installment_id,
      newData: { status: 'paid', paid_method: data.payment_method },
      observation: `Parcela ${installment.installment_number} paga: R$ ${installment.amount.toFixed(2)} — ${perfumeSale.perfume_name_snapshot}`
    })

    revalidatePath('/perfumes')
    revalidatePath('/caixa')
    revalidatePath('/fluxo-de-caixa')
    return { success: true }
  } catch (error: any) {
    console.error('Pay Installment Error:', error)
    return { success: false, error: error.message || 'Erro ao pagar parcela' }
  }
}

// ══════════════════════════════════════════════════════════
// 3. CANCEL PERFUME SALE (admin — with full reversal)
// ══════════════════════════════════════════════════════════

export async function cancelPerfumeSale(data: CancelPerfumeSaleInput) {
  const supabase = await createServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

  try {
    const { data: sale, error: fetchErr } = await supabase
      .from('perfume_sales')
      .select('*')
      .eq('id', data.sale_id)
      .single()

    if (fetchErr || !sale) throw new Error('Venda não encontrada')
    if (sale.status === 'cancelled') throw new Error('Venda já está cancelada')

    // ── Reverse stock movement ──
    if (sale.stock_movement_id) {
      await supabase.from('stock_movements').insert({
        product_id: sale.inventory_product_id,
        movement_type: 'return_from_customer',
        quantity: sale.quantity, // positive = return to stock
        movement_reason: `Estorno venda perfume cancelada: ${sale.perfume_name_snapshot}`,
        source_type: 'perfume_sale_cancellation',
        destination_type: 'stock',
        reference_type: 'perfume_sale',
        reference_id: sale.id,
        movement_date: new Date().toISOString(),
        performed_by: userProfileId,
      })
    }

    // ── Reverse cash entry if exists (create inverse, don't delete) ──
    if (sale.linked_cash_entry_id) {
      const { data: originalEntry } = await supabase
        .from('cash_entries')
        .select('*')
        .eq('id', sale.linked_cash_entry_id)
        .single()

      if (originalEntry) {
        // Get current open session for the reversal entry
        const { data: activeSession } = await supabase
          .from('cash_sessions')
          .select('id')
          .eq('status', 'open')
          .single()

        if (activeSession) {
          await supabase.from('cash_entries').insert({
            cash_session_id: activeSession.id,
            entry_type: 'expense',
            amount: originalEntry.amount,
            category: 'Estorno Venda Perfume',
            description: `Estorno: ${originalEntry.description}`,
            reference_type: 'perfume_sale_cancellation',
            reference_id: sale.id,
            reversal_of_entry_id: sale.linked_cash_entry_id,
            created_by: userProfileId,
          })
        }

        // Mark original as reversed
        await supabase.from('cash_entries')
          .update({ status: 'reversed', cancelled_at: new Date().toISOString(), cancelled_by: userProfileId })
          .eq('id', sale.linked_cash_entry_id)
      }
    }

    // ── Reverse financial movement if exists ──
    if (sale.linked_financial_movement_id) {
      const { data: originalFin } = await supabase
        .from('financial_movements')
        .select('*')
        .eq('id', sale.linked_financial_movement_id)
        .single()

      if (originalFin) {
        await supabase.from('financial_movements').insert({
          movement_type: 'paid',
          amount: originalFin.amount,
          category: 'Estorno',
          subcategory: 'Estorno Venda de Perfume',
          description: `Estorno: ${originalFin.description}`,
          origin_type: 'perfume_sale_cancellation',
          origin_id: sale.id,
          occurred_on: new Date().toISOString(),
        })
      }
    }

    // ── Cancel all open installments ──
    const { data: openInstallments } = await supabase
      .from('perfume_sale_installments')
      .select('*')
      .eq('perfume_sale_id', sale.id)
      .in('status', ['open', 'overdue'])

    if (openInstallments && openInstallments.length > 0) {
      await supabase
        .from('perfume_sale_installments')
        .update({
          status: 'cancelled',
          cancelled_by: userProfileId,
          cancelled_at: new Date().toISOString(),
          cancellation_reason: data.reason,
        })
        .eq('perfume_sale_id', sale.id)
        .in('status', ['open', 'overdue'])
    }

    // ── Reverse paid installments' cash/financial entries ──
    const { data: paidInstallments } = await supabase
      .from('perfume_sale_installments')
      .select('*')
      .eq('perfume_sale_id', sale.id)
      .eq('status', 'paid')

    if (paidInstallments) {
      for (const inst of paidInstallments) {
        // Reverse cash entry
        if (inst.cash_entry_id) {
          const { data: activeSession } = await supabase
            .from('cash_sessions')
            .select('id')
            .eq('status', 'open')
            .single()

          if (activeSession) {
            await supabase.from('cash_entries').insert({
              cash_session_id: activeSession.id,
              entry_type: 'expense',
              amount: inst.amount,
              category: 'Estorno Parcela Perfume',
              description: `Estorno parcela ${inst.installment_number} — ${sale.perfume_name_snapshot}`,
              reference_type: 'perfume_installment_cancellation',
              reference_id: inst.id,
              reversal_of_entry_id: inst.cash_entry_id,
              created_by: userProfileId,
            })
          }

          await supabase.from('cash_entries')
            .update({ status: 'reversed', cancelled_at: new Date().toISOString(), cancelled_by: userProfileId })
            .eq('id', inst.cash_entry_id)
        }

        // Reverse financial movement
        if (inst.financial_movement_id) {
          const { data: origFin } = await supabase
            .from('financial_movements')
            .select('*')
            .eq('id', inst.financial_movement_id)
            .single()

          if (origFin) {
            await supabase.from('financial_movements').insert({
              movement_type: 'paid',
              amount: origFin.amount,
              category: 'Estorno',
              subcategory: 'Estorno Parcela Perfume',
              description: `Estorno: ${origFin.description}`,
              origin_type: 'perfume_installment_cancellation',
              origin_id: inst.id,
              occurred_on: new Date().toISOString(),
            })
          }
        }

        // Mark installment as cancelled
        await supabase
          .from('perfume_sale_installments')
          .update({
            status: 'cancelled',
            cancelled_by: userProfileId,
            cancelled_at: new Date().toISOString(),
            cancellation_reason: data.reason,
          })
          .eq('id', inst.id)
      }
    }

    // ── Update sale status ──
    const { error: updateErr } = await supabase
      .from('perfume_sales')
      .update({
        status: 'cancelled',
        cancelled_by: userProfileId,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: data.reason,
      })
      .eq('id', data.sale_id)

    if (updateErr) throw updateErr

    // Audit
    await logAudit({
      action: 'UPDATE',
      entity: 'perfume_sales',
      entity_id: data.sale_id,
      oldData: sale,
      newData: { ...sale, status: 'cancelled' },
      observation: `Venda de perfume cancelada. Motivo: ${data.reason}. Estoque revertido, movimentos financeiros estornados.`
    })

    revalidatePath('/perfumes')
    revalidatePath('/estoque')
    revalidatePath('/caixa')
    revalidatePath('/fluxo-de-caixa')
    revalidatePath('/clientes')
    revalidatePath('/comissoes')
    return { success: true }
  } catch (error: any) {
    console.error('Cancel Perfume Sale Error:', error)
    return { success: false, error: error.message || 'Erro ao cancelar venda de perfume' }
  }
}

// ══════════════════════════════════════════════════════════
// 4. REVERSE INSTALLMENT PAYMENT (admin)
// ══════════════════════════════════════════════════════════

export async function reverseInstallmentPayment(data: ReverseInstallmentPaymentInput) {
  const supabase = await createServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

  try {
    const { data: installment, error: fetchErr } = await supabase
      .from('perfume_sale_installments')
      .select('*, perfume_sale:perfume_sales(*)')
      .eq('id', data.installment_id)
      .single()

    if (fetchErr || !installment) throw new Error('Parcela não encontrada')
    if (installment.status !== 'paid') throw new Error('Apenas parcelas pagas podem ser estornadas')

    const perfumeSale = installment.perfume_sale

    // ── Reverse cash entry ──
    if (installment.cash_entry_id) {
      const { data: activeSession } = await supabase
        .from('cash_sessions')
        .select('id')
        .eq('status', 'open')
        .single()

      if (activeSession) {
        await supabase.from('cash_entries').insert({
          cash_session_id: activeSession.id,
          entry_type: 'expense',
          amount: installment.amount,
          category: 'Estorno Parcela Perfume',
          description: `Estorno parcela ${installment.installment_number} — ${perfumeSale.perfume_name_snapshot}`,
          reference_type: 'perfume_installment_reversal',
          reference_id: installment.id,
          reversal_of_entry_id: installment.cash_entry_id,
          created_by: userProfileId,
        })
      }

      await supabase.from('cash_entries')
        .update({ status: 'reversed', cancelled_at: new Date().toISOString(), cancelled_by: userProfileId })
        .eq('id', installment.cash_entry_id)
    }

    // ── Reverse financial movement ──
    if (installment.financial_movement_id) {
      const { data: origFin } = await supabase
        .from('financial_movements')
        .select('*')
        .eq('id', installment.financial_movement_id)
        .single()

      if (origFin) {
        await supabase.from('financial_movements').insert({
          movement_type: 'paid',
          amount: origFin.amount,
          category: 'Estorno',
          subcategory: 'Estorno Parcela Perfume',
          description: `Estorno: ${origFin.description}`,
          origin_type: 'perfume_installment_reversal',
          origin_id: installment.id,
          occurred_on: new Date().toISOString(),
        })
      }
    }

    // ── Set installment back to open ──
    const { error: updateErr } = await supabase
      .from('perfume_sale_installments')
      .update({
        status: 'open',
        paid_at: null,
        paid_method: null,
        cash_entry_id: null,
        financial_movement_id: null,
        cancelled_by: userProfileId,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: `Estorno: ${data.reason}`,
      })
      .eq('id', data.installment_id)

    if (updateErr) throw updateErr

    // ── If sale was settled, reopen it ──
    if (perfumeSale.status === 'receivable_settled') {
      await supabase
        .from('perfume_sales')
        .update({ status: 'receivable_open' })
        .eq('id', perfumeSale.id)
    }

    // Audit
    await logAudit({
      action: 'UPDATE',
      entity: 'perfume_sale_installments',
      entity_id: data.installment_id,
      oldData: installment,
      newData: { status: 'open' },
      observation: `Pagamento de parcela ${installment.installment_number} estornado. Motivo: ${data.reason}`
    })

    revalidatePath('/perfumes')
    revalidatePath('/caixa')
    revalidatePath('/fluxo-de-caixa')
    return { success: true }
  } catch (error: any) {
    console.error('Reverse Installment Error:', error)
    return { success: false, error: error.message || 'Erro ao estornar parcela' }
  }
}
