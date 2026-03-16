import OpenAI from 'openai'
import { createServerClient } from '@/lib/supabase/server'
import { AiResponse } from '../types'
import { getInventoryPositions } from '@/features/inventory/services/inventory.service'

export async function processAiCommand(command: string): Promise<AiResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada no servidor.')
  }

  const openai = new OpenAI({ apiKey })
  
  // 1. Build Context
  // We need to fetch necessary context for the AI to "know" the inventory
  const supabase = await createServerClient()
  
  // To build Smart Summaries, we need comprehensive current data alongside low stock.
  const todayDate = new Date().toISOString().split('T')[0]
  
  const [
    productsData, 
    { data: cashSessions },
    { data: financialsToday }
  ] = await Promise.all([
    getInventoryPositions({ page: 1, perPage: 100 }), 
    supabase.from('cash_sessions').select('closing_amount, opening_amount').eq('status', 'open').order('opened_at', { ascending: false }).limit(1),
    supabase.from('financial_movements').select('*').gte('created_at', todayDate)
  ])

  const cashSummary = cashSessions?.[0] || { closing_amount: null, opening_amount: null }
  const products = productsData.data || []
  const contextLowStock = products.filter((p: any) => (p.qty_current || 0) <= (p.qty_min || 0))
  const totalProducts = productsData.count || 0
  
  // Calculate quick daily totals for exactly "Smart Summaries" capability
  const revenueToday = financialsToday?.filter((f: any) => f.type === 'revenue' && f.status === 'paid').reduce((acc, curr: any) => acc + Number(curr.amount), 0) || 0;
  const expensesToday = financialsToday?.filter((f: any) => f.type === 'expense' && f.status === 'paid').reduce((acc, curr: any) => acc + Number(curr.amount), 0) || 0;

  const contextPrompt = [
    "CONHECIMENTO ATUAL (BARBER ZAC ERP):",
    `- Produtos ativos no sistema: ${totalProducts}`,
    `- Posição do Caixa Físico (Sessão Atual): R$ ${cashSummary?.closing_amount || cashSummary?.opening_amount || 0}`,
    `- Faturamento Registrado Hoje: R$ ${revenueToday.toFixed(2)}`,
    `- Despesas Registradas Hoje: R$ ${expensesToday.toFixed(2)}`,
    `- Produtos Críticos (Falta/Mínimo): ${contextLowStock.map((p: any) => "[" + p.code + "] " + p.name + " (Atual: " + p.qty_current + ")").join(', ')}`,
    "",
    "[LISTA RESUMIDA DE PRODUTOS PARA BUSCA DE IDS - APENAS COMO REFERÊNCIA]:",
    products.map((p: any) => "[ID: " + p.id + "] [CÓD: " + p.code + "] " + p.name + " (Saldo: " + p.qty_current + ", Mínimo: " + p.qty_min + ", Custo: " + (p.cost_price || 0) + ")").slice(0, 50).join('\\n')
  ].join('\\n')

  // 2. Execute Prompt
  const systemPrompt = `Você é o assistente operacional do Sistema Barber Zac.
Seu papel: interpretar comandos em português e responder EXCLUSIVAMENTE em JSON estruturado, sem blocos de markdown.

REGRAS:
1. NUNCA invente dados — use apenas o contexto fornecido.
2. Para consultas diretas ou solicitações de "Resumo Financeiro / Diário", responda em formato "query" com texto conversacional bem formatado (usando tópicos, quebras de linha e emojis).
3. Leia o bloco "CONHECIMENTO ATUAL" para montar seu resumo diário. Exponha claramente receitas, despesas, e itens precisando de atenção.
4. Para ações táticas (registrar entrada, registrar saida interna, perda, ajuste, registrar venda), retorne o formato "action".
5. O campo 'payload' dentro de 'action' deve conter os IDs reais baseados na lista curta fornecida. Ex: se pedirem pomada fox, procure o id na lista fornecida.
6. Se o produto alvo para uma ação não estiver na lista de contexto, diga que não encontrou na listagem rápida (retorne formato "query" pedindo o código exato).

FORMATO DE RESPOSTA (JSON PURO, SEM MARCADORES DE CÓDIGO HTML/MARKDOWN ENVOLVENDO JSON):

Para Ação:
{
  "type": "action",
  "message": "Texto confirmando o que entendi (mas ainda não executei)",
  "preview": "Resumo super legível para o usuário clicar em Confirmar (ex: Entrada de 10x Pomada XPTO. Custo total R$ 220,00)",
  "action": {
    "type": "registrar_entrada" | "registrar_saida_interna" | "registrar_perda" | "registrar_ajuste" | "registrar_venda_simples",
    "payload": { "productId": "id_do_banco", "qty": 10, "cost": 22.50, "notes": "opcional" }
  }
}

Para Consulta, Alerta ou "Resumo Diário/Semanal":
{
  "type": "query",
  "message": "Seu super resumo formatado (pode usar emojis, quebras de linha com \n, pontos de exclamação) ou a resposta à pergunta específica."
}

${contextPrompt}
`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // or gpt-4o for complex
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
    throw new Error('Falha ao interpretar comando via Inteligência Artificial.')
  }
}

export async function logAiCommand(command_text: string, intent: string, raw_response: any, executed: boolean = false) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    await supabase.from('ai_commands').insert({
      user_id: user.id,
      command_text,
      intent,
      raw_response,
      executed
    })
  }
}

export async function createAuditLog(entity: string, entity_id: string | null, action: string, old_data: any, new_data: any) {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        entity,
        entity_id,
        action,
        old_data,
        new_data
      })
    }
}
