# Auditoria da Arquitetura — Área do Cliente: Push Notifications + PWA

> **Data:** 2026-07-02  
> **Fase:** 0 — Auditoria (somente leitura, nenhum código alterado)  
> **Objetivo:** Mapear toda a infraestrutura existente antes de qualquer implementação

---

## 1. Área do Cliente — Rotas Existentes

| Rota | Arquivo | Auth | Descrição |
|------|---------|------|-----------|
| `/cliente` | `app/cliente/page.tsx` | Pública | Landing com CTAs "Agendar" e "Agente" |
| `/cliente/login` | `app/cliente/login/page.tsx` | Pública | Login email/senha + Google OAuth |
| `/cliente/auth/callback` | `app/cliente/auth/callback/route.ts` | Pública | Callback OAuth |
| `/cliente/agendar` | `app/cliente/agendar/page.tsx` | Pública | Catálogo de serviços |
| `/cliente/agendar/profissional` | `app/cliente/agendar/profissional/page.tsx` | Pública | Seleção de profissional |
| `/cliente/agendar/data-hora` | `app/cliente/agendar/data-hora/page.tsx` | Pública | Seleção data/hora |
| `/cliente/agendar/confirmacao` | `app/cliente/agendar/confirmacao/page.tsx` | **Protegida** | Confirmação do agendamento |
| `/cliente/meus-agendamentos` | `app/cliente/meus-agendamentos/page.tsx` | **Protegida** | Lista de agendamentos |
| `/cliente/perfil` | `app/cliente/perfil/page.tsx` | **Protegida** | Perfil + `ClientNotificationCard` |
| `/cliente/agente` | `app/cliente/agente/page.tsx` | Pública | Agente IA (placeholder) |

### Rotas protegidas (middleware.ts)

```typescript
const isProtectedCustomerRoute = (pathname) =>
  pathname.startsWith('/cliente/meus-agendamentos') ||
  pathname.startsWith('/cliente/agendar/confirmacao') ||
  pathname.startsWith('/cliente/perfil')
```

---

## 2. Layout e Cabeçalho do Cliente

**Arquivo:** `app/cliente/layout.tsx` (52 linhas)

- Header: sticky, blur backdrop, `h-14`, `max-w-lg mx-auto`
- **Lado esquerdo:** Logo + "Barber Zac / Instituto" → link `/cliente`
- **Lado direito:** `<CustomerProfileMenu />` — **NÃO existe sino de notificações**
- Main: `max-w-lg mx-auto`, flex column
- Envolto por `<AuthProvider>`

**Ponto de inserção do sino:** Antes de `<CustomerProfileMenu />` no header.

---

## 3. Perfil do Cliente

**Arquivo:** `app/cliente/perfil/page.tsx` (401 linhas)

- Exibe: nome, telefone, email, pontos de fidelidade, avatar, data de membro
- **Já importa:** `ClientNotificationCard` de `@/features/notifications`
- Tem `ThemeToggle`
- **NÃO possui:** preferências de notificação, guia PWA dedicado, seção "Notificações e aplicativo"

---

## 4. Autenticação do Cliente

| Camada | Detalhe |
|--------|---------|
| Login | Email/senha + Google OAuth (Apple desativado) |
| Middleware | Supabase SSR, `getUser()`, redireciona para `/cliente/login` |
| AuthProvider | `useAuth()` retorna `isCustomer`, `customerId`, `systemRole` |
| Customer record | Auto-criado via `ensureCustomerForAuthUser()` |
| Tabela `customers` | `auth_user_id UUID` → FK para `auth.users` |

### Resolução de identidade:

```
auth.users.id → user_profiles.id (se existir → interno)
auth.users.id → customers.auth_user_id (se existir → cliente)
```

---

## 5. Sistema PWA Atual

### 5.1 Service Worker: `public/sw.js` (259 linhas)

| Funcionalidade | Status | Detalhes |
|---------------|--------|---------|
| `importScripts` | ✅ | Firebase App Compat 10.12.0 + Messaging Compat + Workbox 6.5.4 |
| `skipWaiting` | ✅ | Top-level + message handler |
| `clientsClaim` | ✅ | Via `workbox.core.clientsClaim()` |
| Install | ✅ | Precache `/offline.html` |
| Activate | ✅ | `initializeFirebase()` + limpeza de caches antigos |
| Fetch | ✅ | Offline fallback para navegação |
| **Push handler** | ✅ | Fallback push + `onBackgroundMessage` do Firebase |
| **NotificationClick** | ✅ | Foca janela existente ou abre nova |
| Workbox caching | ✅ | NetworkFirst (HTML), StaleWhileRevalidate (assets), CacheFirst (imagens) |
| Cache versioning | ✅ | `CACHE_VERSION = "v3"` |
| Supabase REST | ✅ | Cache explicitamente REMOVIDO |

**O SW já suporta push completo. NÃO é necessário criar outro.**

### 5.2 Registro do SW

**Arquivo:** `pwa/register-sw.ts`

```typescript
export function registerServiceWorker() {
  navigator.serviceWorker.register("/sw.js").catch(console.warn);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.dispatchEvent(new CustomEvent("sw-update-available"));
  });
}

export async function forceUpdateSW() {
  const reg = await navigator.serviceWorker.getRegistration();
  reg?.active?.postMessage({ type: "SKIP_WAITING" });
}
```

**Chamado por:** `components/PWAInit.tsx` → importado no `app/layout.tsx`

### 5.3 Banner de Atualização

**Arquivo:** `components/UpdateBanner.tsx`

- Escuta `sw-update-available`
- Mostra banner "Nova versão disponível"
- Botão "Atualizar agora" → `window.location.reload()` (clique do usuário)
- Botão de dismiss

### 5.4 Manifest

**Arquivo:** `public/manifest.webmanifest`

```json
{
  "name": "Barber Zac ERP",
  "short_name": "Barber Zac",
  "start_url": "/?source=pwa",
  "display": "standalone",
  "background_color": "#0A0F1A",
  "theme_color": "#0B1220",
  "lang": "pt-BR",
  "id": "/"
}
```

- Ícones: 192, 420, 512, maskable (512)
- Shortcuts: Agenda, Dashboard, Agendar
- Referenciado em `app/layout.tsx`

### 5.5 Install Prompt

**Arquivo:** `pwa/useInstallPrompt.ts`

```typescript
export function useInstallPrompt() {
  // beforeinstallprompt → { supported, installed, promptInstall }
}
```

**Componente:** `components/PWAInstallButton.tsx` — botão "Instalar App"

### 5.6 Arquivo firebase-messaging-sw.js

**⚠️ EXISTE mas NÃO é registrado por nenhum código.**

`public/firebase-messaging-sw.js` (137 linhas) — duplica lógica FCM do `sw.js`.  
**DECISÃO: Código morto. Não usar. Não registrar. Avaliar remoção futura.**

---

## 6. Firebase e FCM

### 6.1 Dependências

```json
"firebase": "^12.13.0"        // Client SDK
"firebase-admin": "^13.10.0"  // Server SDK
```

### 6.2 Client Firebase

**Arquivo:** `features/notifications/lib/firebaseClient.ts`

- `getFirebaseApp()` — singleton init com `NEXT_PUBLIC_FIREBASE_*`
- `getMessagingInstance()` — `getMessaging(app)`
- `getFCMToken(swReg?)` — token FCM com VAPID key e SW registration
- `deleteFCMToken()` — remove token FCM

### 6.3 VAPID Key

**Confirmado:** Existe como `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (env var).  
**Valor NÃO exposto.**

### 6.4 FCM Server

**Arquivo:** `features/notifications/services/fcmProvider.ts`

- Usa `firebase-admin` SDK
- `FCMPushProvider` implementa `PushProvider` interface
- `sendToToken(token, payload)` → envia via Admin SDK
- Gated por `FCM_ENABLED` env var

### 6.5 API Routes

| Rota | Propósito |
|------|-----------|
| `/api/firebase-config` | Serve config pública para SW |
| `/api/fcm-diagnostics` | ⚠️ Diagnóstico temporário (deve ser removido) |

### 6.6 Foreground onMessage

**❌ NÃO EXISTE.** Nenhum `onMessage()` handler no código do cliente.  
**Impacto:** Notificações em foreground não geram toast/banner in-app.

---

## 7. Tabelas de Banco de Dados

### 7.1 `push_subscriptions`

**Migration:** `20260528_000020_push_notifications.sql`

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `user_profile_id` | uuid FK → user_profiles | NOT NULL |
| `collaborator_id` | uuid FK → collaborators | Nullable |
| `customer_id` | uuid FK → customers | Nullable |
| `role` | text | CHECK ('admin','owner','professional','**customer**') |
| `provider` | text | DEFAULT 'fcm' |
| `token` | text | NOT NULL |
| `endpoint` | text | Nullable (Web Push) |
| `p256dh` | text | Nullable |
| `auth_key` | text | Nullable |
| `platform` | text | CHECK ('ios','android','desktop','unknown') |
| `browser` | text | Nullable |
| `device_label` | text | Nullable |
| `user_agent` | text | Nullable |
| `is_pwa` | boolean | DEFAULT false |
| `permission_status` | text | DEFAULT 'default' |
| `is_active` | boolean | DEFAULT true |
| `last_seen_at` | timestamptz | Nullable |
| `revoked_at` | timestamptz | Nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Constraint:** `UNIQUE (provider, token)`  
**Suporta `customer`:** ✅ Sim, via `customer_id` e `role = 'customer'`

### 7.2 `notification_events`

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `event_type` | text | CHECK com 10 tipos |
| `entity_type` | text | CHECK ('appointment','subscription','payment','test') |
| `entity_id` | uuid | NOT NULL |
| `idempotency_key` | text | UNIQUE NOT NULL |
| `title` | text | NOT NULL |
| `body` | text | NOT NULL |
| `data` | jsonb | DEFAULT '{}' |
| `created_by` | uuid FK → user_profiles | Nullable |
| `created_at` | timestamptz | |

**Suporta eventos de agendamento do cliente:** ✅ Sim, todos os tipos existem.

### 7.3 `notification_delivery_logs`

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `notification_event_id` | uuid FK | |
| `push_subscription_id` | uuid FK | |
| `user_profile_id` | uuid | Nullable |
| `collaborator_id` | uuid | Nullable |
| `target_role` | text | Nullable |
| `status` | DeliveryStatusEnum | pending/sent/failed/skipped |
| `provider` | text | |
| `provider_message_id` | text | Nullable |
| `error_message` | text | Nullable |
| `sent_at` | timestamptz | Nullable |
| `created_at` | timestamptz | |

**Constraint:** `UNIQUE (notification_event_id, push_subscription_id)`

### 7.4 `notification_preferences`

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `user_profile_id` | uuid FK | |
| `notify_new_appointment` | boolean | |
| `notify_cancelled_appointment` | boolean | |
| `notify_rescheduled_appointment` | boolean | |
| `notify_checkin` | boolean | |
| `notify_completed` | boolean | |
| `notify_no_show` | boolean | |
| `notify_subscription_closed` | boolean | |
| `notify_subscription_cancelled` | boolean | |
| `quiet_hours_enabled` | boolean | |
| `quiet_hours_start` | text | Nullable |
| `quiet_hours_end` | text | Nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

## 8. RLS Atual (Notificações)

**⚠️ RISCO IDENTIFICADO — Todas as 4 tabelas usam política permissiva:**

```sql
CREATE POLICY "Enable all actions for authenticated users"
  ON public.push_subscriptions FOR ALL TO authenticated USING (true);
-- Mesmo padrão para notification_preferences, notification_events, notification_delivery_logs
```

**Impacto:**
- Qualquer usuário autenticado pode ler/escrever qualquer registro
- Cliente A pode ver subscriptions do Cliente B
- Violação de privacidade potencial

**DECISÃO:** Não criar migration agora (reconciliação global pendente). Mitigar no código com filtros explícitos por `user_profile_id` / `customer_id` em todas as queries. Documentar como risco para correção futura.

---

## 9. Sistema de Dispatch

### 9.1 `dispatchNotification()`

**Arquivo:** `features/notifications/services/notificationRouter.service.ts`

**Fluxo completo:**
1. Verificação de idempotência via `idempotency_key`
2. Insere registro em `notification_events`
3. Obtém push provider (FCM ou NoOp)
4. Para cada target → `processTarget()`:
   - Verifica preferências do usuário (opt-out por tipo)
   - Verifica quiet hours
   - Busca `push_subscriptions` ativas
   - Constrói payload
   - Envia via `provider.sendToToken()`
   - Registra resultado em `notification_delivery_logs`
   - Auto-desativa tokens inválidos

### 9.2 Target Resolution

```typescript
resolveAdminTargets()        // → user_profiles WHERE system_role IN ('admin_total', 'owner_admin_professional')
resolveProfessionalTarget()  // → user_profiles WHERE collaborator_id = X
```

**❌ NÃO EXISTE `resolveCustomerTarget()`.** Precisa ser criado.

### 9.3 Eventos de Agendamento Atuais

**Arquivo:** `features/agenda/actions/agenda.actions.ts`

| Evento | Targets atuais | Target cliente? |
|--------|---------------|-----------------|
| `appointment_created` | Admin + Professional | ❌ |
| `appointment_rescheduled` | Admin + Professional | ❌ |
| `appointment_cancelled` | Admin + Professional | ❌ |
| `appointment_checkin` | Admin + Professional | ❌ |
| `appointment_no_show` | Admin + Professional | ❌ |

**Padrão atual:**
```typescript
const targets = [...(await resolveAdminTargets())]
const profTarget = await resolveProfessionalTarget(validated.professional_id)
if (profTarget) targets.push(profTarget)
await dispatchNotification({ ..., targets })
```

**Para adicionar cliente:** Criar `resolveCustomerTarget(customerId)` e adicioná-lo ao array `targets`.

### 9.4 Event Payload Builders

**Arquivo:** `features/notifications/services/eventPayloads.ts`

Todos os 10 tipos de evento possuem payload builders. Cada um retorna `PushPayload` com `title`, `body`, `data`.

---

## 10. Tipos Existentes

**Arquivo:** `features/notifications/types.ts`

```typescript
type NotificationEventType =
  | 'appointment_created' | 'appointment_cancelled' | 'appointment_rescheduled'
  | 'appointment_checkin' | 'appointment_completed' | 'appointment_no_show'
  | 'subscription_closed' | 'subscription_cancelled'
  | 'subscription_payment_approved' | 'test_notification'

type PushPlatform = 'ios' | 'android' | 'desktop' | 'unknown'
type PushRole = 'admin' | 'owner' | 'professional' | 'customer'
type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped'
type PermissionStatus = 'granted' | 'denied' | 'default'

// EVENT_TO_PREFERENCE_KEY map — mapeia evento → campo de preferência
```

**Suporta cliente:** ✅ `PushRole` já inclui `'customer'`.

---

## 11. Componentes Existentes de Notificação

| Componente | Arquivo | Usado por |
|------------|---------|-----------|
| `ClientNotificationCard` | `features/notifications/components/ClientNotificationCard.tsx` | `/cliente/perfil` |
| `ProfessionalNotificationCard` | `features/notifications/components/ProfessionalNotificationCard.tsx` | `/profissional/conta` |
| `NotificationSettingsCard` | `features/notifications/components/NotificationSettingsCard.tsx` | Admin settings |
| `NotificationPreferencePanel` | `features/notifications/components/NotificationPreferencePanel.tsx` | Admin/Prof settings |
| `NotificationDiagnosticsPanel` | `features/notifications/components/NotificationDiagnosticsPanel.tsx` | Admin diagnostics |
| `InstallPwaGuide` | `features/notifications/components/InstallPwaGuide.tsx` | Guia instalação iOS |

**❌ NÃO existem:** NotificationBell, NotificationInbox, NotificationDropdown, NotificationEmptyState

---

## 12. Componentes UI Disponíveis (shadcn/ui)

| Componente | Arquivo | Relevância |
|------------|---------|------------|
| Badge | `components/ui/badge.tsx` | ✅ Counter no sino |
| Popover | `components/ui/popover.tsx` | ✅ Dropdown do sino |
| Dialog | `components/ui/dialog.tsx` | ✅ Modais de confirmação |
| Sheet | `components/ui/sheet.tsx` | ✅ Painel lateral mobile |
| Tabs | `components/ui/tabs.tsx` | ✅ Abas de preferências |
| Switch | `components/ui/switch.tsx` | ✅ Toggles de preferência |
| Skeleton | `components/ui/skeleton.tsx` | ✅ Loading states |
| Card | `components/ui/card.tsx` | ✅ Cards de conteúdo |
| Button | `components/ui/button.tsx` | ✅ CTAs |
| DataTable | `components/ui/data-table.tsx` | ✅ Tabelas admin |
| Sonner | `components/ui/sonner.tsx` | ✅ Toast notifications |
| Drawer | `components/ui/drawer.tsx` | ✅ Bottom drawer mobile |
| KPICard | `components/ui/kpi-card.tsx` | ✅ Métricas admin |

---

## 13. Hooks Existentes

| Hook | Arquivo | Relevância |
|------|---------|------------|
| `useAuth()` | `components/auth-provider.tsx` | ✅ `isCustomer`, `customerId` |
| `useInstallPrompt()` | `pwa/useInstallPrompt.ts` | ✅ Reutilizar para install |
| `useToast()` | `hooks/use-toast.ts` | ✅ Toast wrapper |

**❌ NÃO existem:** `useClientNotifications`, `useNotificationPreferences`, `useNotificationPermission`

---

## 14. Sistema de Auditoria

**Tabela:** `audit_logs`  
**Service:** `features/audit/actions/audit.actions.ts` → `logAudit()`

```typescript
logAudit({
  action: string,        // INSERT, UPDATE, DELETE, etc.
  entity: string,        // Nome da tabela/entidade
  entity_id: string,
  oldData: any,
  newData: any,
  source: string         // web, ai_operator, system
})
```

---

## 15. RBAC

| Role | `system_role` | Acesso |
|------|--------------|--------|
| Admin | `admin_total` | Dashboard + todas as rotas admin |
| Owner | `owner_admin_professional` | Tudo |
| Professional | `professional` | Apenas `/profissional` |
| Customer | Sem `user_profiles` | Apenas `/cliente/*` |

**Admin check:**
```typescript
hasAdminAccess: ['admin_total', 'owner_admin_professional'].includes(profile?.system_role || '')
```

---

## 16. Agendamentos (Schema)

**Tabela:** `appointments`

| Campo relevante | Tipo |
|-----------------|------|
| `customer_id` | uuid FK → customers |
| `professional_id` | uuid FK → collaborators |
| `service_id` | uuid FK → services |
| `start_at` | timestamptz |
| `end_at` | timestamptz |
| `status` | 'scheduled'\|'confirmed'\|'checked_in'\|'completed'\|'cancelled'\|'no_show'\|'blocked'\|'encaixe' |
| `source` | 'admin'\|'professional'\|'customer'\|'imported' |
| `cancelled_at` | timestamptz |
| `cancellation_reason` | text |

**Relação para push:** `appointments.customer_id` → `customers.auth_user_id` → `user_profiles.id` → `push_subscriptions.user_profile_id`

---

## 17. Vercel Cron / Scheduler

**❌ NÃO EXISTE.** Nenhum `vercel.json`, nenhuma rota de cron, nenhum scheduler.

**Impacto:** Lembretes automáticos NÃO podem ser implementados agora.  
**Status:** "Lembretes automáticos serão ativados quando o agendador controlado estiver disponível."

---

## 18. React Query Keys

**Padrão observado:** Array simples com nome da entidade + filtros.

```typescript
["inventory", filters]
["categories"]
["customers", params]
```

**Keys sugeridas para notificações do cliente:**
```typescript
["client-notifications", "inbox", userId]
["client-notifications", "unread-count", userId]
["client-notifications", "preferences", userId]
["client-notifications", "subscription-status", userId]
```

---

## 19. Ícones e Splash

- `public/icons/` — 4 arquivos (192, 420, 512, maskable) — todos 201KB
- `public/splash/` — 8 SVGs para iOS
- Apple touch icon configurado em layout.tsx
- ⚠️ Todos os ícones têm tamanho idêntico (possivelmente mesmo arquivo)

---

## 20. Rota Administrativa de Notificações

**❌ NÃO existe rota `/notificacoes/` no dashboard.**

As configurações de notificação estão embutidas em `/configuracoes`.

**Para central administrativa de envio a clientes:** Criar nova rota `/notificacoes/clientes` no dashboard.

---

## 21. Design System

| Propriedade | Valor |
|-------------|-------|
| Framework CSS | Tailwind CSS v4 |
| Componentes | shadcn/ui (radix-nova) |
| Fonte | Montserrat (300-800) |
| Ícones | Lucide React |
| Tema | CSS vars com light/dark |
| Background (dark) | `#0A0F1A` |
| Accent | Gradientes premium |
| Radius | 6-14px |

---

## Resumo de Riscos

| Risco | Severidade | Mitigação |
|-------|-----------|-----------|
| RLS `USING(true)` em todas as tabelas de notificação | 🔴 Alta | Filtros explícitos no código |
| `firebase-messaging-sw.js` morto em `public/` | 🟡 Média | Não registrar, avaliar remoção |
| `FCM_ENABLED=false` por padrão | 🟡 Média | Documentar ativação necessária |
| Sem `onMessage` foreground | 🟡 Média | Implementar handler |
| Sem cron para lembretes | 🟡 Média | Documentar como futuro |
| Ícones todos com mesmo tamanho | 🟢 Baixa | Cosmético, não impacta push |
| `fcm-diagnostics` API expõe dados | 🟡 Média | Recomendar remoção |

---

## Decisão Técnica Final

```
REUTILIZAR INTEGRALMENTE:
├── public/sw.js (push handler + notificationclick já funcionais)
├── pwa/register-sw.ts + pwa/useInstallPrompt.ts
├── features/notifications/ (módulo completo)
│   ├── types.ts (PushRole 'customer' já existe)
│   ├── actions/notification.actions.ts
│   ├── services/notificationRouter.service.ts (dispatchNotification)
│   ├── services/fcmProvider.ts
│   ├── services/eventPayloads.ts
│   ├── lib/firebaseClient.ts
│   ├── lib/pushClient.ts
│   └── components/ClientNotificationCard.tsx + InstallPwaGuide.tsx
├── push_subscriptions (customer_id + role='customer' já suportados)
├── notification_events (idempotency_key + todos os event_types)
├── notification_delivery_logs (rastreamento por subscription)
├── notification_preferences (toggles por tipo de evento)
├── features/agenda/actions/agenda.actions.ts (dispatch points existentes)
├── AuthProvider + useAuth() (isCustomer, customerId)
└── Todos os componentes shadcn/ui

CRIAR (COMPROVADAMENTE INEXISTENTE):
├── resolveCustomerTarget() no notificationRouter
├── Target 'customer' nos dispatch de agenda
├── ClientNotificationBell (sino no header)
├── ClientNotificationInbox (painel de notificações)
├── ClientNotificationPreferencesPage
├── ClientPwaInstallCard (card na área do cliente)
├── ClientPlatformInstallGuide (instruções por plataforma)
├── AdminClientNotificationComposer
├── Foreground onMessage handler para cliente
├── Rota /cliente/notificacoes
├── Rota /notificacoes/clientes (admin)
└── Hooks: useClientNotifications, useNotificationPermission

NÃO CRIAR:
├── Segundo Service Worker
├── Nova tabela de subscriptions
├── Nova tabela de eventos
├── Novo token ou env
├── Cron/scheduler (infraestrutura inexistente)
└── Lembretes automáticos (bloqueado por ausência de scheduler)
```
