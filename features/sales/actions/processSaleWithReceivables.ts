// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { saleSchema, SaleFormValues } from "../validators"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/features/audit/actions/audit.actions"
import { resolveUserProfileId } from "@/lib/supabase/resolve-user"
import { createReceivablesForSale } from "@/features/receivables/actions/receivables.actions"
import { processSale } from "./sales.actions"

/**
 * Extended sale payload that supports installment/mixed payments.
 * For upfront payments, delegates 100% to the original processSale().
 */
export interface SaleWithReceivablesPayload extends SaleFormValues {
  payment_mode: 'upfront' | 'installment' | 'mixed'
  payment_origin?: 'credit_card_installment' | 'store_credit'
  installment_count?: number
  first_due_date?: string
  upfront_amount?: number
  installment_notes?: string
}

export async function processSaleWithReceivables(data: SaleWithReceivablesPayload) {
  // ── MODE: UPFRONT → delegate to original processSale (zero changes) ──
  if (!data.payment_mode || data.payment_mode === 'upfront') {
    return processSale(data)
  }

  const supabase = await createServerClient()
  const rollbacks: Array<() => Promise<void>> = []

  try {
    const validated = saleSchema.parse(data)
    const { data: authData } = await supabase.auth.getUser()
    const userProfileId = await resolveUserProfileId(supabase, authData.user?.id)

    // Validate installment-specific fields
    const installmentCount = data.installment_count || 2
    const firstDueDate = data.first_due_date
    if (!firstDueDate) {
      return { success: false, error: "Data do primeiro vencimento obrigatória para vendas parceladas." }
    }
    if (installmentCount < 2 || installmentCount > 12) {
      return { success: false, error: "Número de parcelas deve ser entre 2 e 12." }
    }

    // For store_credit (boca a boca), customer is mandatory
    const paymentOrigin = data.payment_origin || 'store_credit'
    if (paymentOrigin === 'store_credit' && !validated.customer_id) {
      return { success: false, error: "Cliente cadastrado obrigatório para venda a prazo / boca a boca." }
    }
    if (paymentOrigin === 'store_credit' && !data.installment_notes?.trim()) {
      return { success: false, error: "Observação/motivo obrigatório para venda a prazo." }
    }

    // Calculate totals
    const subtotal = validated.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0)
    const total = subtotal - validated.discount_amount

    // Determine upfront vs receivable amounts
    let upfrontAmount = 0
    let receivableTotal = total

    if (data.payment_mode === 'mixed') {
      upfrontAmount = data.upfront_amount || 0
      if (upfrontAmount <= 0) {
        return { success: false, error: "Valor de entrada deve ser maior que zero para pagamento misto." }
      }
      if (upfrontAmount >= total) {
        return { success: false, error: "Valor de entrada deve ser menor que o total. Use pagamento à vista." }
      }
      receivableTotal = Math.round((total - upfrontAmount) * 100) / 100
    }

    // ── Resolve customer info for snapshot ──
    let customerNameSnapshot: string | null = null
    let customerPhoneSnapshot: string | null = null
    let humanReadableCustomer = ""

    if (validated.customer_id) {
      const { data: customer } = await supabase
        .from("customers")
        .select("full_name, phone, mobile_phone")
        .eq("id", validated.customer_id)
        .single()
      if (customer) {
        customerNameSnapshot = customer.full_name
        customerPhoneSnapshot = customer.phone || customer.mobile_phone || null
        humanReadableCustomer = ` - ${customer.full_name}`
      }
    } else if (validated.customer_name_override) {
      customerNameSnapshot = validated.customer_name_override
      humanReadableCustomer = ` - Cliente avulso: ${validated.customer_name_override}`
    }

    // ── 1. Create Sale Record ──
    const paymentStatus = data.payment_mode === 'installment' ? 'receivable' : 'partially_paid'

    const { data: newSale, error: saleError } = await supabase
      .from("sales")
      .insert({
        customer_id: validated.customer_id || null,
        customer_name_snapshot: customerNameSnapshot,
        collaborator_id: validated.collaborator_id || null,
        payment_method_id: validated.payment_method_id,
        discount_amount: validated.discount_amount,
        subtotal: subtotal,
        status: "completed",
        payment_status: paymentStatus,
        payment_mode: data.payment_mode,
        receivable_total: receivableTotal,
        upfront_amount: upfrontAmount,
        sale_date: new Date().toISOString(),
        notes: validated.notes,
        created_by: userProfileId,
      })
      .select()
      .single()

    if (saleError) throw saleError

    rollbacks.push(async () => {
      await supabase.from("sales").delete().eq("id", newSale.id)
    })

    // ── 2. Insert Sale Items (triggers stock movement automatically) ──
    const itemsToInsert = validated.items.map(item => ({
      sale_id: newSale.id,
      item_type: item.type,
      product_id: item.type === "product" ? item.productId : null,
      service_id: item.type === "service" ? item.serviceId || null : null,
      service_name: item.type === "service" ? item.name : null,
      quantity: item.quantity,
      unit_price_snapshot: item.unitPrice,
      unit_cost_snapshot: item.unitCost,
      discount_amount: item.discount,
    }))

    const { data: insertedItems, error: itemsError } = await supabase
      .from("sale_items")
      .insert(itemsToInsert)
      .select("id")

    if (itemsError) {
      throw new Error("Erro ao inserir itens da venda: " + itemsError.message)
    }

    rollbacks.push(async () => {
      const ids = (insertedItems || []).map((i: any) => i.id)
      if (ids.length > 0) await supabase.from("sale_items").delete().in("id", ids)
    })

    // ── 3. If MIXED: create cash_entry + financial_movement for upfront portion ──
    if (data.payment_mode === 'mixed' && upfrontAmount > 0) {
      const { data: activeSession } = await supabase
        .from("cash_sessions")
        .select("id")
        .eq("status", "open")
        .single()

      if (!activeSession) {
        throw new Error("Não há caixa aberto para receber a entrada.")
      }

      const { data: cashEntry, error: cashErr } = await supabase.from("cash_entries").insert({
        cash_session_id: activeSession.id,
        entry_type: "sale_income",
        amount: upfrontAmount,
        category: "Venda (PDV) - Entrada",
        description: `Entrada Venda #${newSale.id.split('-')[0]}${humanReadableCustomer}`,
        payment_method_id: validated.payment_method_id,
        reference_type: "sale",
        reference_id: newSale.id,
        occurred_at: newSale.sale_date,
        created_by: userProfileId,
      }).select("id").single()

      if (cashErr) throw new Error("Erro ao lançar entrada no caixa: " + cashErr.message)

      rollbacks.push(async () => {
        await supabase.from("cash_entries").delete().eq("id", cashEntry.id)
      })

      const { data: finMov, error: finErr } = await supabase.from("financial_movements").insert({
        movement_type: "received",
        amount: upfrontAmount,
        category: "Vendas",
        subcategory: "PDV - Entrada",
        description: `Entrada Venda #${newSale.id.split('-')[0]}${humanReadableCustomer}`,
        occurred_on: newSale.sale_date,
        origin_type: "sale",
        origin_id: newSale.id,
      }).select("id").single()

      if (finErr) throw new Error("Erro ao lançar entrada no financeiro: " + finErr.message)

      rollbacks.push(async () => {
        await supabase.from("financial_movements").delete().eq("id", finMov.id)
      })
    }

    // ── 4. For FULL INSTALLMENT: NO cash_entry or financial_movement ──
    // (value only enters the books when each installment is received)

    // ── 5. Create receivable installments ──
    const receivablesResult = await createReceivablesForSale({
      saleId: newSale.id,
      customerId: validated.customer_id || null,
      customerNameSnapshot,
      customerPhoneSnapshot,
      professionalId: validated.collaborator_id || null,
      paymentOrigin: data.payment_mode === 'mixed' ? 'mixed_payment' : paymentOrigin,
      totalReceivable: receivableTotal,
      installments: installmentCount,
      firstDueDate: firstDueDate,
      notes: data.installment_notes || null,
      description: `Venda #${newSale.id.split('-')[0]} - ${paymentOrigin === 'store_credit' ? 'A prazo' : 'Crédito parcelado'}`,
    })

    if (!receivablesResult.success) {
      throw new Error(receivablesResult.error || "Erro ao criar parcelas")
    }

    // ── 6. Audit Log ──
    await logAudit({
      action: 'INSERT',
      entity: 'sales',
      entity_id: newSale.id,
      newData: newSale,
      observation: `Venda parcelada registrada. Total: R$ ${total.toFixed(2)}. Entrada: R$ ${upfrontAmount.toFixed(2)}. A Receber: R$ ${receivableTotal.toFixed(2)} em ${installmentCount}x. Origem: ${paymentOrigin}`,
    })

    revalidatePath("/vendas")
    revalidatePath("/estoque")
    revalidatePath("/caixa")
    revalidatePath("/dashboard")
    revalidatePath("/fluxo-de-caixa")
    revalidatePath("/a-receber")
    return { success: true, data: newSale }
  } catch (error: any) {
    console.error("Process Sale With Receivables Error, starting rollback:", error)

    for (let i = rollbacks.length - 1; i >= 0; i--) {
      try {
        await rollbacks[i]()
      } catch (rbError) {
        console.error("Falha no rollback:", rbError)
      }
    }

    return { success: false, error: error.message || "Erro ao processar venda parcelada" }
  }
}
