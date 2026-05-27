'use server'

/**
 * Barber Zac ERP — WhatsApp Server Actions
 *
 * Server actions consumed by the admin WhatsApp UI page.
 * All actions run server-side. Secrets never reach the client.
 */

import { logAudit } from '@/features/audit/actions/audit.actions'
import { getProviderStatus } from '../services/evolutionApi.provider'
import * as whatsappService from '../services/whatsapp.service'
import * as agentAccess from '../services/whatsappAgentAccess.service'
import type { WhatsAppDashboard, WhatsAppAgentPermission } from '../types'

// ── Dashboard ──

export async function getWhatsAppDashboard(): Promise<{
  success: boolean
  data?: WhatsAppDashboard
  error?: string
}> {
  try {
    const providerStatus = getProviderStatus()
    const instanceName = process.env.EVOLUTION_API_INSTANCE_NAME || 'barber-zac'

    // Ensure instance record exists
    await whatsappService.getOrCreateInstance(instanceName, 'Instituto Barber Zac')

    // Seed default permissions if empty
    await whatsappService.seedDefaultPermissions()

    const [instance, recentEvents, permissions] = await Promise.all([
      whatsappService.getInstance(instanceName),
      whatsappService.getRecentWebhookEvents(10),
      whatsappService.getAgentPermissions(),
    ])

    const { data: messageLogs } = await whatsappService.getMessageLogs({ limit: 10 })
    const { total: queueCount } = await whatsappService.getOutboundQueue(1)

    return {
      success: true,
      data: {
        instance,
        providerStatus,
        recentEvents,
        recentMessages: messageLogs,
        queueCount,
        permissions,
      },
    }
  } catch (err: any) {
    console.error('[WhatsApp Actions] getWhatsAppDashboard error:', err)
    return { success: false, error: 'Erro ao carregar painel do WhatsApp.' }
  }
}

// ── Message Logs ──

export async function getWhatsAppMessageLogs(opts: {
  limit?: number
  offset?: number
  direction?: string
  search?: string
}) {
  return whatsappService.getMessageLogs(opts)
}

// ── Outbound Queue ──

export async function getWhatsAppOutboundQueue(limit?: number) {
  return whatsappService.getOutboundQueue(limit)
}

// ── Agent Permissions ──

export async function getWhatsAppAgentPermissions() {
  return whatsappService.getAgentPermissions()
}

export async function updateWhatsAppAgentPermission(
  id: string,
  updates: Partial<WhatsAppAgentPermission>
): Promise<{ success: boolean; error?: string }> {
  const result = await whatsappService.updateAgentPermission(id, updates)

  if (result.success) {
    await logAudit({
      action: 'UPDATE',
      entity: 'whatsapp_agent_permissions',
      entity_id: id,
      newData: updates,
      source: 'web',
      status: 'success',
      observation: 'Permissão do agente WhatsApp alterada',
    })
  }

  return result
}

// ── Test Functions (Simulated) ──

export async function testWhatsAppConnection(): Promise<{
  success: boolean
  message: string
}> {
  const providerStatus = getProviderStatus()

  if (!providerStatus.enabled) {
    return {
      success: false,
      message: 'Evolution API não está habilitada. Configure EVOLUTION_API_ENABLED=true nas variáveis de ambiente.',
    }
  }

  if (!providerStatus.configured) {
    return {
      success: false,
      message: 'Configure EVOLUTION_API_BASE_URL e EVOLUTION_API_KEY para testar a conexão.',
    }
  }

  // When API is configured, this will call the real provider
  return {
    success: false,
    message: 'Teste de conexão será ativado quando as credenciais reais forem configuradas.',
  }
}

export async function testAgendaRead(): Promise<{
  success: boolean
  message: string
  data?: unknown
}> {
  const today = new Date().toISOString().split('T')[0]
  const result = await agentAccess.getAgendaSummaryForAgent(today)

  if (!result.success) {
    return { success: false, message: result.error || 'Erro ao ler agenda.' }
  }

  return {
    success: true,
    message: `Agenda de hoje: ${result.data?.totalAppointments || 0} agendamento(s).`,
    data: result.data,
  }
}

export async function testCustomerLookup(phone: string): Promise<{
  success: boolean
  message: string
  data?: unknown
}> {
  if (!phone || phone.replace(/\D/g, '').length < 10) {
    return { success: false, message: 'Informe um telefone válido com pelo menos 10 dígitos.' }
  }

  const result = await agentAccess.findCustomerByPhone(phone)

  if (!result.success) {
    return { success: false, message: result.error || 'Erro ao buscar cliente.' }
  }

  if (!result.data) {
    return { success: true, message: 'Nenhum cliente encontrado com esse telefone.' }
  }

  return {
    success: true,
    message: `Cliente encontrado: ${result.data.fullName}`,
    data: { name: result.data.fullName, id: result.data.id },
  }
}

// ── Webhook URL helper ──

export async function getWebhookUrl(): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://barber-zac.vercel.app'
  return `${appUrl}/api/webhooks/evolution`
}
