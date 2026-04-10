"use server"
import OpenAI from 'openai'
import { createServerClient } from '@/lib/supabase/server'
import type { AiResponse } from '../types'

export async function processAiCommand(command: string): Promise<AiResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { type: 'query', message: '⚠️ OPENAI_API_KEY não configurada no servidor. Configure nas variáveis de ambiente.' }
  }

  const openai = new OpenAI({ apiKey })
  const supabase = await createServerClient()
  
  const { data: products } = await supabase
    .from('vw_inventory_position')
    .select('*')
    .order('product_name')
    .limit(100)

  const { data: cashSessions } = await supabase
    .from('cash_sessions')
    .select('opening_amount, closing_amount, status')
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)

  const todayStart = new Date()
  todayStart.setHours(0,0,0,0)

  const { data: salesToday } = await supabase
    .from('sales')
    .select('total, status')
    .gte('sale_date', todayStart.toISOString())
    .eq('status', 'completed')

  const safeProducts = products || []
  const cashSummary = cashSessions?.[0] || null
  const lowStock = safeProducts.filter((p: any) => (p.current_balance || 0) <= (p.min_stock || 0) && p.min_stock > 0)
  const revenueTodayTotal = (salesToday || []).reduce((acc: number, s: any) => acc + Number(s.total || 0), 0)

  const contextPrompt = [
    "CONHECIMENTO ATUAL (BARBER ZAC ERP):",
    `- Produtos ativos no sistema: ${safeProducts.length}`,
    `- Posição do Caixa: ${cashSummary ? 'Aberto (R$ ' + ((cashSummary as any).opening_amount || 0) + ' abertura)' : 'Fechado'}`,
    `- Faturamento Hoje: R$ ${revenueTodayTotal.toFixed(2)}`,
    `- Produtos Críticos: ${lowStock.length > 0 ? lowStock.map((p: any) => p.product_name + ' (Saldo: ' + p.current_balance + ')').join(', ') : 'Nenhum'}`,
    "",
    "[LISTA DE PRODUTOS]:",
    safeProducts.slice(0, 50).map((p: any) => `[ID: ${(p as any).product_id}] ${(p as any).product_name} (Saldo: ${(p as any).current_balance}, Min: ${(p as any).min_stock}, Custo: R$ ${(p as any).cost_price})`).join('\n')
  ].join('\n')

  const systemPrompt = `Você é o assistente operacional do Sistema Barber Zac.
Seu papel: interpretar comandos em português e responder EXCLUSIVAMENTE em JSON estruturado, sem blocos de markdown.

REGRAS:
1. NUNCA invente dados — use apenas o contexto fornecido.
2. Para consultas, responda formato "query" com texto formatado.
3. Para ações (registrar entrada, saída, perda, ajuste, venda), retorne formato "action".
4. Use IDs reais da lista de produtos.
5. Se o produto não estiver na lista, peça o nome exato.

FORMATO DE RESPOSTA (JSON PURO):

Para Ação:
{
  "type": "action",
  "message": "Confirmação do que entendi",
  "preview": "Resumo legível para confirmar",
  "action": {
    "type": "registrar_entrada" | "registrar_saida_interna" | "registrar_perda" | "registrar_ajuste" | "registrar_venda_simples",
    "payload": { "productId": "id_do_banco", "qty": 10, "cost": 22.50, "notes": "opcional" }
  }
}

Para Consulta:
{
  "type": "query",
  "message": "Resposta formatada"
}

${contextPrompt}
`
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: command }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    })

    const resultRaw = response.choices[0].message.content || '{}'
    const resultObj = JSON.parse(resultRaw) as AiResponse

    return resultObj

  } catch (error: any) {
    console.error("OpenAI Error:", error)
    return { type: 'query', message: '❌ Falha ao processar comando via IA: ' + (error.message || 'Erro desconhecido') }
  }
}

export async function logAiCommand(command_text: string, intent: string, parsed_payload: any, status: string = 'executed') {
  try {
    const supabase = await createServerClient()
    await (supabase.from('ai_commands') as any).insert({
      command_text,
      intent,
      parsed_payload,
      status,
    })
  } catch (e) {
    console.error("Error logging AI command:", e)
  }
}

export async function createAuditLog(entity_type: string, entity_id: string | null, action: string, before_data: any, after_data: any) {
  try {
    const supabase = await createServerClient()
    await (supabase.from('audit_logs') as any).insert({
      entity_type,
      entity_id: entity_id || '00000000-0000-0000-0000-000000000000',
      action,
      before_data,
      after_data,
    })
  } catch (e) {
    console.error("Error creating audit log:", e)
  }
}
