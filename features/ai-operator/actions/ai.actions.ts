"use server"

import { revalidatePath } from "next/cache"
import { processAiCommand, logAiCommand, createAuditLog } from "../services/ai.service"
import { AiResponse } from "../types"
import { createMovement } from "@/features/movements/actions/movements.actions"

export async function submitAiCommand(command: string): Promise<{ success: boolean; data?: AiResponse; error?: string }> {
  try {
    const aiResult = await processAiCommand(command)
    
    // Log the interaction regardless of it being an action or query
    await logAiCommand(
      command, 
      aiResult.type === 'action' ? (aiResult.action?.type || 'unknown_action') : 'query', 
      aiResult, 
      false
    )

    return { success: true, data: aiResult }

  } catch (error: any) {
    console.error("AI Command Error:", error)
    return { success: false, error: error.message || "Erro interno ao processar comando." }
  }
}

export async function executeAiAction(action: any, commandText: string): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const { type, payload } = action
    
    // Map intents to real operational actions
    if (['registrar_entrada', 'registrar_saida_interna', 'registrar_perda', 'registrar_ajuste'].includes(type) && payload.productId) {
      
      let movementType: any = "entrada"
      if (type === 'registrar_saida_interna') movementType = "saida"
      if (type === 'registrar_perda') movementType = "perda"
      if (type === 'registrar_ajuste') movementType = "ajuste"

      // Execute real stock movement
      await createMovement({
        product_id: payload.productId,
        movement_type: movementType,
        quantity: Math.abs(Number(payload.qty)),
        movement_reason: payload.notes || `Movimentação via IA`,
      })

      // Log execution success
      await logAiCommand(commandText, type, action, true)
      
      revalidatePath('/dashboard')
      revalidatePath('/estoque')
      revalidatePath('/movimentacoes')

      return { success: true, message: `Ação '${movementType}' registrada com sucesso no sistema!` }
    }

    if (type === 'registrar_venda_simples') {
      const { createServerClient } = await import('@/lib/supabase/server')
      const supabase = await createServerClient()
      const { data: authData } = await supabase.auth.getUser()

      // Fetch payment method "Dinheiro" by default for Fast AI Sales
      const { data: pm } = await supabase.from('payment_methods').select('id').ilike('name', 'dinheiro').single()
      if (!pm) return { success: false, message: "Erro", error: "Método de pagamento 'Dinheiro' não configurado." }

      // Get costs and auto-generated sale price
      const { data: prod } = await supabase.from('inventory_products').select('cost_price, sale_price_generated').eq('id', payload.productId).single()
      if (!prod) return { success: false, message: "Erro", error: "Produto não encontrado." }

      const qty = Math.abs(Number(payload.qty)) || 1
      const total = qty * prod.sale_price_generated

      // Create Sale
      const { data: sale, error } = await supabase.from('sales').insert({
        status: 'completed',
        payment_method_id: pm.id,
        subtotal: total,
        created_by: authData?.user?.id || null,
        notes: payload.notes || 'Venda Rápida via Assistente IA'
      }).select().single()

      if (error || !sale) throw error || new Error("Não foi possível criar a venda no Supabase.")

      // Create Sale Item (Trigger will automatically deduct stock and add ledger historically)
      const { error: itemError } = await supabase.from('sale_items').insert({
        sale_id: (sale as any).id,
        item_type: 'product',
        product_id: payload.productId,
        quantity: qty,
        unit_cost_snapshot: prod.cost_price,
        unit_price_snapshot: prod.sale_price_generated
      })

      if (itemError) throw itemError

      // Log execution success
      await logAiCommand(commandText, type, action, true)
      
      revalidatePath('/dashboard')
      revalidatePath('/vendas')
      revalidatePath('/estoque')
      revalidatePath('/movimentacoes')

      return { success: true, message: `Venda Simples de ${qty}x registrada com sucesso! Receita de R$ ${total.toFixed(2)} lançada na POS.` }
    }

    return { success: false, message: "Aviso", error: "Ação não reconhecida ou faltam parâmetros na IA." }

  } catch (error: any) {
    console.error("AI Action Execution Error:", error)
    return { success: false, message: "Erro", error: error.message || "Erro ao efetivar a ação." }
  }
}
