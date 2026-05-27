'use client'

import { useState, useEffect } from 'react'
import {
  MessageCircle, Smartphone, Bot, ShieldCheck, CalendarCheck,
  Wifi, WifiOff, Clock, Send, Copy, CheckCircle, XCircle,
  Loader2, RefreshCw, AlertTriangle, Settings, Search,
  ToggleLeft, ToggleRight, ChevronDown, ChevronRight,
  Inbox, ArrowUpRight, Zap, Eye, Phone
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getWhatsAppDashboard,
  testWhatsAppConnection,
  testAgendaRead,
  testCustomerLookup,
  updateWhatsAppAgentPermission,
  getWebhookUrl,
} from '@/features/whatsapp/actions/whatsapp.actions'
import type { WhatsAppDashboard, WhatsAppAgentPermission } from '@/features/whatsapp/types'

// ── Status badge colors ──
const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  not_configured: { label: 'Não Configurado', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20', icon: AlertTriangle },
  disconnected: { label: 'Desconectado', color: 'text-red-500 bg-red-500/10 border-red-500/20', icon: WifiOff },
  connecting: { label: 'Conectando...', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', icon: Loader2 },
  connected: { label: 'Conectado', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', icon: Wifi },
  qr_pending: { label: 'Aguardando QR Code', color: 'text-purple-500 bg-purple-500/10 border-purple-500/20', icon: Smartphone },
  error: { label: 'Erro', color: 'text-red-500 bg-red-500/10 border-red-500/20', icon: XCircle },
  disabled: { label: 'Desabilitado', color: 'text-gray-500 bg-gray-500/10 border-gray-500/20', icon: WifiOff },
}

const SCOPE_LABELS: Record<string, string> = {
  agenda: 'Agenda',
  customers: 'Clientes',
  appointments: 'Agendamentos',
  services: 'Serviços',
  subscriptions: 'Assinaturas',
  sales_readonly: 'Vendas (somente leitura)',
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function WhatsAppPage() {
  const [dashboard, setDashboard] = useState<WhatsAppDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [testingConnection, setTestingConnection] = useState(false)
  const [testingAgenda, setTestingAgenda] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testingCustomer, setTestingCustomer] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['status', 'connect', 'webhook', 'permissions']))
  const [updatingPermission, setUpdatingPermission] = useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
    loadWebhookUrl()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    const res = await getWhatsAppDashboard()
    if (res.success && res.data) {
      setDashboard(res.data)
    } else {
      toast.error(res.error || 'Erro ao carregar painel.')
    }
    setLoading(false)
  }

  async function loadWebhookUrl() {
    const url = await getWebhookUrl()
    setWebhookUrl(url)
  }

  function toggleSection(key: string) {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleTestConnection() {
    setTestingConnection(true)
    const res = await testWhatsAppConnection()
    if (res.success) toast.success(res.message)
    else toast.error(res.message)
    setTestingConnection(false)
  }

  async function handleTestAgenda() {
    setTestingAgenda(true)
    const res = await testAgendaRead()
    if (res.success) toast.success(res.message)
    else toast.error(res.message)
    setTestingAgenda(false)
  }

  async function handleTestCustomer() {
    if (!testPhone.trim()) { toast.error('Informe um telefone.'); return }
    setTestingCustomer(true)
    const res = await testCustomerLookup(testPhone)
    if (res.success) toast.success(res.message)
    else toast.error(res.message)
    setTestingCustomer(false)
  }

  async function handleCopyWebhookUrl() {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      toast.success('URL copiada!')
    } catch {
      toast.error('Erro ao copiar.')
    }
  }

  async function handleTogglePermission(perm: WhatsAppAgentPermission, field: keyof WhatsAppAgentPermission) {
    setUpdatingPermission(perm.id)
    const currentValue = perm[field]
    const res = await updateWhatsAppAgentPermission(perm.id, { [field]: !currentValue } as any)
    if (res.success) {
      toast.success('Permissão atualizada.')
      await loadDashboard()
    } else {
      toast.error(res.error || 'Erro ao atualizar.')
    }
    setUpdatingPermission(null)
  }

  const instanceStatus = dashboard?.instance?.status || 'not_configured'
  const statusInfo = STATUS_MAP[instanceStatus] || STATUS_MAP.not_configured
  const StatusIcon = statusInfo.icon

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-[var(--text-secondary)]">Carregando painel WhatsApp...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">WhatsApp / Agente IA</h1>
            <p className="text-sm text-[var(--text-secondary)]">Integração via Evolution API</p>
          </div>
        </div>
        <button
          onClick={loadDashboard}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Provider Status Banner */}
      {!dashboard?.providerStatus.enabled && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/5">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-[var(--text-primary)] text-sm">Integração pronta para configuração</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
              A estrutura do WhatsApp está montada e pronta. Configure as variáveis de ambiente
              <code className="px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-primary)] mx-1 text-[11px]">EVOLUTION_API_ENABLED</code>,
              <code className="px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-primary)] mx-1 text-[11px]">EVOLUTION_API_BASE_URL</code> e
              <code className="px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-primary)] mx-1 text-[11px]">EVOLUTION_API_KEY</code> para ativar.
            </p>
          </div>
        </div>
      )}

      {/* ═══ 1. Status da Integração ═══ */}
      <SectionCard
        title="Status da Integração"
        icon={Wifi}
        sectionKey="status"
        expanded={expandedSections.has('status')}
        onToggle={toggleSection}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Status Card */}
          <div className={`p-4 rounded-xl border ${statusInfo.color}`}>
            <div className="flex items-center gap-2 mb-2">
              <StatusIcon className={`w-4 h-4 ${instanceStatus === 'connecting' ? 'animate-spin' : ''}`} />
              <span className="text-xs font-bold uppercase tracking-wide">Status</span>
            </div>
            <p className="font-semibold text-sm">{statusInfo.label}</p>
          </div>

          {/* Instance */}
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
            <div className="flex items-center gap-2 mb-2 text-[var(--text-secondary)]">
              <Bot className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wide">Instância</span>
            </div>
            <p className="font-semibold text-sm text-[var(--text-primary)] truncate">{dashboard?.instance?.instance_name || '—'}</p>
          </div>

          {/* Phone */}
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
            <div className="flex items-center gap-2 mb-2 text-[var(--text-secondary)]">
              <Phone className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wide">Telefone</span>
            </div>
            <p className="font-semibold text-sm text-[var(--text-primary)]">{dashboard?.instance?.phone_number || 'Não conectado'}</p>
          </div>

          {/* Last Connection */}
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
            <div className="flex items-center gap-2 mb-2 text-[var(--text-secondary)]">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wide">Última conexão</span>
            </div>
            <p className="font-semibold text-sm text-[var(--text-primary)]">{formatDateTime(dashboard?.instance?.last_connected_at || null)}</p>
          </div>
        </div>

        {dashboard?.instance?.last_error && (
          <div className="mt-3 p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-500">
            <strong>Último erro:</strong> {dashboard.instance.last_error}
          </div>
        )}
      </SectionCard>

      {/* ═══ 2. Conectar WhatsApp ═══ */}
      <SectionCard
        title="Conectar WhatsApp"
        icon={Smartphone}
        sectionKey="connect"
        expanded={expandedSections.has('connect')}
        onToggle={toggleSection}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Actions */}
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Conecte o WhatsApp do Instituto Barber Zac via Evolution API.
              Quando as credenciais forem configuradas, use os botões abaixo para gerar o QR Code de conexão.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
              >
                {testingConnection ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Testar Conexão
              </button>
              <button
                disabled
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] opacity-50 cursor-not-allowed"
                title="Disponível quando a Evolution API estiver configurada"
              >
                <Smartphone className="w-4 h-4" />
                Gerar QR Code
              </button>
            </div>

            <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-hover)]/50 text-xs text-[var(--text-secondary)]">
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="font-semibold">Modo Seguro</span>
              </div>
              API não faz chamadas reais sem credenciais. Nenhuma mensagem será enviada sem aprovação.
            </div>
          </div>

          {/* QR Code Placeholder */}
          <div className="flex items-center justify-center p-8 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-hover)]/30 min-h-[200px]">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-[var(--bg-hover)] flex items-center justify-center mx-auto">
                <Smartphone className="w-8 h-8 text-[var(--text-secondary)]" />
              </div>
              <p className="text-sm font-medium text-[var(--text-secondary)]">QR Code aparecerá aqui</p>
              <p className="text-xs text-[var(--text-muted)]">Aguardando configuração da Evolution API</p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ═══ 3. Webhook ═══ */}
      <SectionCard
        title="Webhook"
        icon={ArrowUpRight}
        sectionKey="webhook"
        expanded={expandedSections.has('webhook')}
        onToggle={toggleSection}
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Configure esta URL no painel da Evolution API para receber eventos do WhatsApp.
          </p>

          <div className="flex items-center gap-2">
            <div className="flex-1 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-hover)]/50 font-mono text-xs text-[var(--text-primary)] truncate">
              {webhookUrl || 'Carregando...'}
            </div>
            <button
              onClick={handleCopyWebhookUrl}
              className="flex items-center gap-1.5 px-3 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm hover:bg-[var(--bg-hover)] transition-all shrink-0"
              title="Copiar URL"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
            <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
              <span className="text-xs text-[var(--text-secondary)]">Webhook</span>
              <p className="font-semibold text-sm text-[var(--text-primary)] mt-0.5">
                {dashboard?.instance?.webhook_enabled ? '✅ Ativo' : '⏸ Inativo'}
              </p>
            </div>
            <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
              <span className="text-xs text-[var(--text-secondary)]">Eventos recebidos</span>
              <p className="font-semibold text-sm text-[var(--text-primary)] mt-0.5">
                {dashboard?.recentEvents.length || 0}
              </p>
            </div>
            <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
              <span className="text-xs text-[var(--text-secondary)]">Secret configurado</span>
              <p className="font-semibold text-sm text-[var(--text-primary)] mt-0.5">
                {dashboard?.providerStatus.configured ? '✅ Sim' : '⚠ Não'}
              </p>
            </div>
          </div>

          {/* Recent events */}
          {dashboard && dashboard.recentEvents.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wide">Eventos Recentes</h4>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {dashboard.recentEvents.map(evt => (
                  <div key={evt.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-semibold text-[10px]">{evt.event_type}</span>
                    <span className="text-[var(--text-secondary)] truncate flex-1">{evt.remote_jid || '—'}</span>
                    <span className="text-[var(--text-muted)] shrink-0">{formatDateTime(evt.received_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ═══ 4. Permissões do Agente ═══ */}
      <SectionCard
        title="Permissões do Agente"
        icon={ShieldCheck}
        sectionKey="permissions"
        expanded={expandedSections.has('permissions')}
        onToggle={toggleSection}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-blue-600 dark:text-blue-400">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span><strong>Modo seguro:</strong> Agente somente leitura. Criação automática desativada até aprovação.</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
                  <th className="pb-2 pl-3 font-semibold">Escopo</th>
                  <th className="pb-2 text-center font-semibold">Leitura</th>
                  <th className="pb-2 text-center font-semibold">Escrita</th>
                  <th className="pb-2 text-center font-semibold">Criar Agend.</th>
                  <th className="pb-2 text-center font-semibold">Cancelar</th>
                  <th className="pb-2 text-center font-semibold">Reagendar</th>
                  <th className="pb-2 text-center font-semibold">Confirmação Humana</th>
                  <th className="pb-2 text-center font-semibold">Ativo</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.permissions || []).map(perm => (
                  <tr key={perm.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)]/50 transition-colors">
                    <td className="py-2.5 pl-3 font-medium text-[var(--text-primary)]">{SCOPE_LABELS[perm.scope] || perm.scope}</td>
                    <td className="py-2.5 text-center">
                      <PermToggle
                        value={perm.can_read}
                        loading={updatingPermission === perm.id}
                        onToggle={() => handleTogglePermission(perm, 'can_read')}
                      />
                    </td>
                    <td className="py-2.5 text-center">
                      <PermToggle
                        value={perm.can_write}
                        loading={updatingPermission === perm.id}
                        onToggle={() => handleTogglePermission(perm, 'can_write')}
                      />
                    </td>
                    <td className="py-2.5 text-center">
                      <PermToggle
                        value={perm.can_create_appointment}
                        loading={updatingPermission === perm.id}
                        onToggle={() => handleTogglePermission(perm, 'can_create_appointment')}
                      />
                    </td>
                    <td className="py-2.5 text-center">
                      <PermToggle
                        value={perm.can_cancel_appointment}
                        loading={updatingPermission === perm.id}
                        onToggle={() => handleTogglePermission(perm, 'can_cancel_appointment')}
                      />
                    </td>
                    <td className="py-2.5 text-center">
                      <PermToggle
                        value={perm.can_reschedule_appointment}
                        loading={updatingPermission === perm.id}
                        onToggle={() => handleTogglePermission(perm, 'can_reschedule_appointment')}
                      />
                    </td>
                    <td className="py-2.5 text-center">
                      <PermToggle
                        value={perm.requires_human_confirmation}
                        loading={updatingPermission === perm.id}
                        onToggle={() => handleTogglePermission(perm, 'requires_human_confirmation')}
                      />
                    </td>
                    <td className="py-2.5 text-center">
                      <PermToggle
                        value={perm.is_enabled}
                        loading={updatingPermission === perm.id}
                        onToggle={() => handleTogglePermission(perm, 'is_enabled')}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      {/* ═══ 5. Logs de Mensagens ═══ */}
      <SectionCard
        title="Logs de Mensagens"
        icon={Inbox}
        sectionKey="messages"
        expanded={expandedSections.has('messages')}
        onToggle={toggleSection}
      >
        {dashboard && dashboard.recentMessages.length === 0 ? (
          <div className="text-center py-8">
            <Inbox className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-secondary)]">Nenhuma mensagem registrada ainda.</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Mensagens aparecerão aqui quando o WhatsApp estiver conectado.</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {dashboard?.recentMessages.map(msg => (
              <div key={msg.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-xs">
                <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${msg.direction === 'inbound' ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                  {msg.direction === 'inbound' ? '↙ Recebida' : '↗ Enviada'}
                </span>
                <span className="text-[var(--text-primary)] truncate flex-1">{msg.body || '(mídia)'}</span>
                <span className="text-[var(--text-muted)] shrink-0">{formatDateTime(msg.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ═══ 6. Fila de Mensagens ═══ */}
      <SectionCard
        title="Fila de Mensagens"
        icon={Send}
        sectionKey="queue"
        expanded={expandedSections.has('queue')}
        onToggle={toggleSection}
      >
        <div className="text-center py-6">
          <Send className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2" />
          <p className="text-sm text-[var(--text-secondary)]">{dashboard?.queueCount || 0} mensagem(ns) na fila.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Envio automático será ativado após configuração da API.</p>
        </div>
      </SectionCard>

      {/* ═══ 7. Testes ═══ */}
      <SectionCard
        title="Testes Internos"
        icon={Settings}
        sectionKey="tests"
        expanded={expandedSections.has('tests')}
        onToggle={toggleSection}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Test Connection */}
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <Zap className="w-4 h-4 text-yellow-500" />
              Testar Conexão
            </div>
            <p className="text-xs text-[var(--text-secondary)]">Verifica se o provider está configurado.</p>
            <button
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="w-full mt-2 px-3 py-2 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] text-xs font-medium hover:bg-[var(--accent-subtle)] transition-all disabled:opacity-50"
            >
              {testingConnection ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
              Executar
            </button>
          </div>

          {/* Test Agenda */}
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <CalendarCheck className="w-4 h-4 text-blue-500" />
              Ler Agenda Hoje
            </div>
            <p className="text-xs text-[var(--text-secondary)]">Testa leitura segura da agenda.</p>
            <button
              onClick={handleTestAgenda}
              disabled={testingAgenda}
              className="w-full mt-2 px-3 py-2 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] text-xs font-medium hover:bg-[var(--accent-subtle)] transition-all disabled:opacity-50"
            >
              {testingAgenda ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
              Executar
            </button>
          </div>

          {/* Test Customer */}
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <Eye className="w-4 h-4 text-purple-500" />
              Buscar Cliente
            </div>
            <p className="text-xs text-[var(--text-secondary)]">Busca por telefone normalizado.</p>
            <input
              type="text"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              placeholder="21999999999"
              className="w-full px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] text-xs"
            />
            <button
              onClick={handleTestCustomer}
              disabled={testingCustomer}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] text-xs font-medium hover:bg-[var(--accent-subtle)] transition-all disabled:opacity-50"
            >
              {testingCustomer ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
              Executar
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

// ── Reusable Components ──

function SectionCard({
  title,
  icon: Icon,
  sectionKey,
  expanded,
  onToggle,
  children,
}: {
  title: string
  icon: React.ElementType
  sectionKey: string
  expanded: boolean
  onToggle: (key: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      <button
        onClick={() => onToggle(sectionKey)}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--bg-hover)]/50 transition-all"
      >
        <div className="flex items-center gap-2.5">
          <Icon className="w-4.5 h-4.5 text-[var(--text-secondary)]" />
          <h2 className="text-sm font-bold text-[var(--text-primary)]">{title}</h2>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" /> : <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  )
}

function PermToggle({
  value,
  loading,
  onToggle,
}: {
  value: boolean
  loading: boolean
  onToggle: () => void
}) {
  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)] mx-auto" />
  return (
    <button
      onClick={onToggle}
      className="mx-auto block transition-colors"
      title={value ? 'Ativo — clique para desativar' : 'Inativo — clique para ativar'}
    >
      {value ? (
        <ToggleRight className="w-5 h-5 text-emerald-500" />
      ) : (
        <ToggleLeft className="w-5 h-5 text-[var(--text-muted)]" />
      )}
    </button>
  )
}
