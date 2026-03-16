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
      return { success: false, message: "Aviso", error: "Registro de venda simples via IA ainda está em desenvolvimento." }
    }

    return { success: false, message: "Aviso", error: "Ação não reconhecida ou faltam parâmetros." }

  } catch (error: any) {
    console.error("AI Action Execution Error:", error)
    return { success: false, message: "Erro", error: error.message || "Erro ao efetivar a ação." }
  }
}
