/**
 * Barber Zac ERP — Evolution API Provider (Server-Only)
 *
 * Placeholder provider for Evolution API v2.
 * All functions check EVOLUTION_API_ENABLED before making any network call.
 * When disabled, returns controlled error — no real HTTP requests.
 *
 * API key is NEVER exposed to the client.
 * This file must only be imported from server actions or API routes.
 */

import type { ProviderResult, ProviderStatus, InstanceConnectionState } from '../types'

// ── Environment helpers ──

function isEnabled(): boolean {
  return process.env.EVOLUTION_API_ENABLED === 'true'
}

function getBaseUrl(): string | null {
  return process.env.EVOLUTION_API_BASE_URL || null
}

function getApiKey(): string | null {
  return process.env.EVOLUTION_API_KEY || null
}

function getInstanceName(): string {
  return process.env.EVOLUTION_API_INSTANCE_NAME || 'barber-zac'
}

function ensureConfigured(): ProviderResult {
  if (!isEnabled()) {
    return { success: false, error: 'Evolution API não está habilitada. Configure EVOLUTION_API_ENABLED=true.' }
  }
  if (!getBaseUrl() || !getApiKey()) {
    return { success: false, error: 'Configure EVOLUTION_API_BASE_URL e EVOLUTION_API_KEY nas variáveis de ambiente.' }
  }
  return { success: true }
}

// ── Provider Functions ──

/**
 * Returns the current provider configuration status (without secrets).
 */
export function getProviderStatus(): ProviderStatus {
  return {
    enabled: isEnabled(),
    configured: !!(getBaseUrl() && getApiKey()),
    baseUrl: getBaseUrl() ? '***configurado***' : null,
    instanceName: getInstanceName(),
  }
}

/**
 * Create a new instance on Evolution API.
 * PLACEHOLDER — will be implemented when credentials are provided.
 */
export async function createInstance(instanceName: string): Promise<ProviderResult> {
  const check = ensureConfigured()
  if (!check.success) return check

  // TODO: POST ${baseUrl}/instance/create
  // Body: { instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' }
  // Headers: { apikey: getApiKey() }
  console.log(`[EvolutionAPI] createInstance placeholder called for: ${instanceName}`)
  return { success: false, error: 'Criação de instância será implementada com credenciais reais.' }
}

/**
 * Fetch all instances from Evolution API.
 */
export async function fetchInstances(): Promise<ProviderResult> {
  const check = ensureConfigured()
  if (!check.success) return check

  // TODO: GET ${baseUrl}/instance/fetchInstances
  console.log('[EvolutionAPI] fetchInstances placeholder called')
  return { success: false, error: 'Listagem de instâncias será implementada com credenciais reais.' }
}

/**
 * Get connection state of an instance.
 */
export async function getConnectionState(instanceName: string): Promise<ProviderResult<InstanceConnectionState>> {
  const check = ensureConfigured()
  if (!check.success) return { success: false, error: check.error }

  // TODO: GET ${baseUrl}/instance/connectionState/${instanceName}
  console.log(`[EvolutionAPI] getConnectionState placeholder for: ${instanceName}`)
  return { success: false, error: 'Verificação de conexão será implementada com credenciais reais.' }
}

/**
 * Connect instance (generates QR Code).
 */
export async function connectInstance(instanceName: string): Promise<ProviderResult<{ qrcode?: string }>> {
  const check = ensureConfigured()
  if (!check.success) return { success: false, error: check.error }

  // TODO: GET ${baseUrl}/instance/connect/${instanceName}
  console.log(`[EvolutionAPI] connectInstance placeholder for: ${instanceName}`)
  return { success: false, error: 'Conexão via QR Code será implementada com credenciais reais.' }
}

/**
 * Set webhook URL for an instance.
 */
export async function setWebhook(
  instanceName: string,
  webhookUrl: string,
  events?: string[]
): Promise<ProviderResult> {
  const check = ensureConfigured()
  if (!check.success) return check

  // TODO: POST ${baseUrl}/webhook/set/${instanceName}
  // Body: { url: webhookUrl, webhook_by_events: false, events: [...] }
  console.log(`[EvolutionAPI] setWebhook placeholder for: ${instanceName} -> ${webhookUrl}`)
  return { success: false, error: 'Configuração de webhook será implementada com credenciais reais.' }
}

/**
 * Get current webhook config for an instance.
 */
export async function getWebhook(instanceName: string): Promise<ProviderResult> {
  const check = ensureConfigured()
  if (!check.success) return check

  // TODO: GET ${baseUrl}/webhook/find/${instanceName}
  console.log(`[EvolutionAPI] getWebhook placeholder for: ${instanceName}`)
  return { success: false, error: 'Consulta de webhook será implementada com credenciais reais.' }
}

/**
 * Send a text message via Evolution API.
 */
export async function sendTextMessage(
  instanceName: string,
  to: string,
  message: string
): Promise<ProviderResult> {
  const check = ensureConfigured()
  if (!check.success) return check

  // TODO: POST ${baseUrl}/message/sendText/${instanceName}
  // Body: { number: to, text: message }
  console.log(`[EvolutionAPI] sendTextMessage placeholder: ${instanceName} -> ${to.slice(0, 4)}***`)
  return { success: false, error: 'Envio de mensagens será implementado com credenciais reais.' }
}

/**
 * Logout/disconnect an instance.
 */
export async function logoutInstance(instanceName: string): Promise<ProviderResult> {
  const check = ensureConfigured()
  if (!check.success) return check

  // TODO: DELETE ${baseUrl}/instance/logout/${instanceName}
  console.log(`[EvolutionAPI] logoutInstance placeholder for: ${instanceName}`)
  return { success: false, error: 'Desconexão será implementada com credenciais reais.' }
}

/**
 * Restart an instance.
 */
export async function restartInstance(instanceName: string): Promise<ProviderResult> {
  const check = ensureConfigured()
  if (!check.success) return check

  // TODO: PUT ${baseUrl}/instance/restart/${instanceName}
  console.log(`[EvolutionAPI] restartInstance placeholder for: ${instanceName}`)
  return { success: false, error: 'Reinício será implementado com credenciais reais.' }
}
