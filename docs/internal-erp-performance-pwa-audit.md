# Barber Zac ERP — Performance Interna: Auditoria PWA/Service Worker

> **Data**: 2026-06-26  
> **Fase**: B (Quick Wins)  
> **Branch**: `perf/internal-erp-optimization`

---

## 1. Arquivos Auditados

| Arquivo | Tamanho | Função |
|---------|---------|--------|
| `public/sw.js` | ~9.7 KB | Unified Service Worker (Workbox + Firebase) |
| `public/firebase-messaging-sw.js` | Legado/duplicado | Pode ser removido futuramente |
| `pwa/register-sw.ts` | 530 B | Registro do SW + controllerchange |
| `components/PWAInit.tsx` | Componente de inicialização PWA |
| `public/manifest.webmanifest` | Manifesto PWA |

---

## 2. Problemas Encontrados

### P1 — Cache REST do Supabase (CORRIGIDO em B1)

| Campo | Valor |
|-------|-------|
| **Arquivo** | `public/sw.js:192-205` |
| **Problema** | `StaleWhileRevalidate` com cacheName `supabase-rest`, maxAgeSeconds 300 (5 min) |
| **Impacto** | Após venda/caixa/estoque mutation, GETs retornam dados stale do cache SW |
| **Dado afetado** | Caixa, estoque, vendas, dashboard, financeiro — TODOS os dados REST |
| **Correção** | Bloco removido. Dados REST sempre vão direto à rede |
| **Rollback** | Restaurar bloco de cache |
| **Status** | ✅ CORRIGIDO |

### P2 — Reload automático em controllerchange (CORRIGIDO em B2)

| Campo | Valor |
|-------|-------|
| **Arquivo** | `pwa/register-sw.ts:6-8` |
| **Problema** | `setTimeout(() => window.location.reload(), 300)` no `controllerchange` |
| **Impacto** | Reload inesperado após deploy; interrompe venda em andamento, agenda, formulário |
| **Cenários críticos** | Carrinho com itens, agenda sendo preenchida, formulário de parcelamento aberto |
| **Correção** | Substituído por `CustomEvent('sw-update-available')` + banner não-invasivo |
| **Banner** | "Nova versão disponível" + botão "Atualizar agora" + botão fechar |
| **Rollback** | Restaurar `location.reload()` |
| **Status** | ✅ CORRIGIDO |

---

## 3. Cache Inventory — Estado Atual

### Caches Mantidos (seguros)

| Cache Name | Estratégia | Conteúdo | Seguro? |
|------------|-----------|----------|---------|
| `html-pages-v3` | NetworkFirst | Páginas HTML navegação | ✅ Sim — NetworkFirst busca rede primeiro |
| `static-v3` | StaleWhileRevalidate | Scripts, styles, workers | ✅ Sim — versionados pelo build |
| `images` | CacheFirst (30d) | Imagens estáticas | ✅ Sim — não contém dados privados |
| `offline-fallback` | Precache manual | `/offline.html` | ✅ Sim — página estática |

### Caches Removidos

| Cache Name | Motivo da Remoção |
|------------|-------------------|
| `supabase-rest` | Cacheava dados financeiros autenticados com 5min TTL |
| `html-pages` (antigo) | Versão antiga sem sufixo v3 |
| `static` (antigo) | Versão antiga sem sufixo v3 |

### Limpeza de Caches Antigos
- Implementada no evento `activate` do SW
- Array `EXPECTED_CACHES` define quais manter
- Todos os outros são deletados com log `[SW] Deleting old cache: <name>`

---

## 4. O Que o SW NÃO Cacheia (confirmado)

- ❌ GET REST do Supabase (removido)
- ❌ Respostas autenticadas (nenhum handler para Auth headers)
- ❌ Server Actions (POST, não interceptado)
- ❌ RSC payloads (Next.js internal, não interceptado)
- ❌ API routes (nenhum matcher para `/api/`)
- ❌ Dados de venda, caixa, financeiro (dados REST removidos)

---

## 5. Background Sync — ScoreBot

| Campo | Valor |
|-------|-------|
| **Cache** | `scorebot-queue` |
| **Estratégia** | NetworkOnly + BackgroundSyncPlugin |
| **Conteúdo** | POST requests para ScoreBot API |
| **TTL** | 24 horas de retenção |
| **Seguro?** | ✅ Sim — somente se `__SCOREBOT_URL__` estiver configurado |
| **Ação** | Manter — não afeta performance ERP |

---

## 6. Firebase / Push Notifications

| Campo | Valor |
|-------|-------|
| **Inicialização** | Lazy — busca config de `/api/firebase-config` no `activate` |
| **Push handler** | `onBackgroundMessage` + fallback para push direto |
| **Notification click** | Navega para URL da notificação |
| **Seguro?** | ✅ Sim — não cacheia dados, apenas exibe notificações |
| **Ação** | Manter — sem impacto em performance |

---

## 7. Lifecycle

| Evento | Comportamento | Status |
|--------|--------------|--------|
| `install` | Precache `offline.html` | ✅ OK |
| `activate` | Init Firebase + limpar caches antigos | ✅ MELHORADO (limpeza adicionada) |
| `message` (SKIP_WAITING) | `self.skipWaiting()` | ✅ OK |
| `fetch` (navigate) | Offline fallback | ✅ OK |
| `controllerchange` (client-side) | Banner não-invasivo | ✅ MELHORADO (antes: reload forçado) |

---

## 8. Cenários Testáveis

1. ✅ Usuário com SW antigo → novo deploy → banner aparece → atualiza quando quiser
2. ✅ Carrinho com itens → deploy → banner aparece → carrinho preservado
3. ✅ Agenda aberta → deploy → banner aparece → agenda preservada
4. ✅ Formulário de parcelamento → deploy → banner aparece → dados preservados
5. ✅ Conexão móvel → busca rede primeiro → fallback para cache em offline
6. ✅ Hard refresh → busca rede → SW atualiza
7. ✅ Logout → login → dados REST frescos (sem cache stale)
8. ✅ Venda concluída → dados imediatamente atualizados (sem cache REST)

---

## 9. Riscos Restantes

| # | Risco | Severidade | Ação |
|---|-------|-----------|------|
| R1 | `firebase-messaging-sw.js` duplicado em `public/` | 🟢 BAIXA | Remover em fase futura |
| R2 | HTML cacheado com NetworkFirst pode servir HTML antigo brevemente | 🟢 BAIXA | Aceitar — NetworkFirst busca rede primeiro |
| R3 | `skipWaiting` + `clientsClaim` pode causar descontinuidade em tabs muito antigas | 🟢 BAIXA | Aceitar — banner mitiga |
