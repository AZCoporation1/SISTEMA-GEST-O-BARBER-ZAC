# Barber Zac ERP — Performance Interna: Resultados

> **Data**: 2026-06-26  
> **Branch**: `perf/internal-erp-optimization`  
> **Base**: `9268e9c` (main)  
> **Commits**: 7

---

## 1. Rotas Analisadas

28 rotas internas (22 admin + 6 profissional). Mapa completo em `docs/internal-erp-performance-route-map.md`.

---

## 2. Gargalos Comprovados e Correções

### G1 — Service Worker cacheava dados REST Supabase (5min stale) ✅ CORRIGIDO
| Campo | Antes | Depois |
|-------|-------|--------|
| **Cache** | `StaleWhileRevalidate` 5min TTL para GETs Supabase | Removido — dados sempre frescos |
| **Comportamento** | Após venda, caixa/estoque mostravam dados de até 5min atrás | Dados atualizados imediatamente |
| **Arquivo** | `public/sw.js:192-205` | `public/sw.js` — bloco removido |
| **Commit** | — | `042974e` |

### G2 — Reload automático em controllerchange ✅ CORRIGIDO
| Campo | Antes | Depois |
|-------|-------|--------|
| **Comportamento** | `window.location.reload()` após 300ms no SW update | Banner não-invasivo "Nova versão disponível" |
| **Impacto** | Interrompia venda em andamento, agenda, formulário | Operador escolhe quando atualizar |
| **Arquivos** | `pwa/register-sw.ts` | `pwa/register-sw.ts` + `components/UpdateBanner.tsx` |
| **Commit** | — | `042974e` |

### G9 — Carrinho limpo antes de confirmar sucesso da venda ✅ CORRIGIDO
| Campo | Antes | Depois |
|-------|-------|--------|
| **Comportamento** | Carrinho resetado incondicionalmente após `await processSale()` | Reset apenas se `result.success === true` |
| **Impacto** | Em erro, operador perdia todo o carrinho | Carrinho preservado, retry possível |
| **Arquivo** | `features/sales/components/POSView.tsx:241-256` | Mesma localização com guard |
| **Commit** | — | `0678d36` |

### G5/G6 — select("*") no POS dependencies ✅ CORRIGIDO
| Campo | Antes | Depois |
|-------|-------|--------|
| **getPaymentMethods** | `select("*")` | `select("id, name, is_active")` |
| **getCustomers** | `select("*")` — todas as colunas | `select("id, full_name")` |
| **getCollaborators** | `select("*")` | `select("id, name, is_active")` |
| **Tipo de retorno** | `as unknown as Row[]` | `Pick<Row, ...>[]` (type-safe) |
| **Commit** | — | `e57d6b0` |

### Leituras do processSale ✅ OTIMIZADO
| Campo | Antes | Depois |
|-------|-------|--------|
| **auth + cash check** | 2 round-trips sequenciais | 1 round-trip paralelo (`Promise.all`) |
| **customer + paymentMethod lookup** | 2 round-trips sequenciais | 1 round-trip paralelo (`Promise.all`) |
| **Round-trips de leitura** | 5 sequenciais | 3 (2× `Promise.all` + 1 `resolveUserProfileId`) |
| **Instrumentação** | Nenhuma | Timing logs `[PERF] processSale reads/writes/revalidation` |
| **Commit** | — | `64bc718` |

---

## 3. Queries Alteradas

| Query | Antes | Depois | Tabela |
|-------|-------|--------|--------|
| `getPaymentMethods` | `select("*")` | `select("id, name, is_active")` | `payment_methods` |
| `getCustomers` | `select("*")` | `select("id, full_name")` | `customers` |
| `getCollaborators` | `select("*")` | `select("id, name, is_active")` | `collaborators` |
| `processSale` customer lookup | `select("full_name, phone, mobile_phone")` | `select("full_name")` | `customers` |

---

## 4. N+1 Removidos

Nenhum N+1 foi encontrado nos fluxos críticos. Os `select("*")` eram queries únicas, não em loops.

---

## 5. Índices Criados

Nenhum. Não houve evidência (EXPLAIN) que justificasse criação de índice nesta fase.

---

## 6. Cache Removido

| Cache | Motivo |
|-------|--------|
| `supabase-rest` (SW) | Cacheava dados financeiros com 5min TTL |
| `html-pages` v1/v2 (SW) | Substituído por `html-pages-v3` com cleanup |
| `static` v1/v2 (SW) | Substituído por `static-v3` com cleanup |

---

## 7. Cache Criado

Nenhum cache novo foi criado. A arquitetura 100% client-side via React Query é mantida.

---

## 8. Revalidações

96 chamadas `revalidatePath` mapeadas em 12 arquivos. Nenhuma removida.

**Decisão documentada**: Todas são redundantes (dados são client-side via React Query), mas mantidas por segurança e compatibilidade futura. Instrumentação adicionada para medir custo real.

---

## 9. Alterações do PDV
- Carrinho preservado em erro (B3)
- Colunas otimizadas nos dropdowns (B4)
- Leituras paralelizadas no `processSale` (C1)
- Nenhuma alteração na lógica de venda, comissão, estoque ou caixa

## 10. Alterações da PWA
- Cache REST Supabase removido do SW (B1)
- Reload automático substituído por banner (B2)
- Cache versionado com cleanup de caches antigos
- Firebase/push preservado integralmente

## 11. Alterações do Dashboard
- Error boundary global adicionado para todas as rotas admin (D2)

## 12. Alterações de Agenda
- Nenhuma

## 13. Alterações da Área Profissional
- Nenhuma

---

## 14. Testes

| Teste | Resultado |
|-------|-----------|
| `npx tsc --noEmit` | ✅ PASSED |
| `npm run build` | ✅ PASSED — todas as rotas compiladas |
| `npx vitest run` | ✅ 5/5 PASSED (412ms) |
| `git diff --check` | ✅ Sem whitespace errors |

---

## 15. Riscos Restantes

| # | Risco | Severidade | Ação |
|---|-------|-----------|------|
| R1 | `firebase-messaging-sw.js` duplicado | 🟢 BAIXA | Remover em fase futura |
| R2 | 40+ `select("*")` restantes em outros módulos | 🟡 MÉDIA | Endereçar por módulo conforme evidência |
| R3 | `revalidatePath` redundante (96 chamadas) | 🟢 BAIXA | Medir custo via logs C1, decidir depois |
| R4 | POSView monolítico (678 linhas) | 🟡 MÉDIA | Split em componentes menores em fase futura |
| R5 | `@ts-nocheck` em sales.actions.ts e processSaleWithReceivables.ts | 🟡 MÉDIA | Remover e corrigir tipos gradualmente |

---

## 16. Rollback

Cada commit é isolado e reversível via `git revert`:

| Commit | Para reverter |
|--------|--------------|
| `042974e` | SW/PWA: restaura cache REST + reload automático |
| `0678d36` | POSView: restaura reset incondicional do carrinho |
| `e57d6b0` | POS queries: restaura `select("*")` |
| `64bc718` | processSale: restaura leituras sequenciais |
| `8a5d564` | Docs: baseline + PWA audit |
| `e4b5cf7` | Docs: route map + cache audit |
| `53bf49b` | Error boundary: remover |

---

## 17. Arquivos Alterados

| Arquivo | Mudança |
|---------|---------|
| `public/sw.js` | Removido cache REST Supabase, versionamento de caches, cleanup |
| `pwa/register-sw.ts` | Substituído reload por CustomEvent |
| `components/UpdateBanner.tsx` | **NOVO** — banner de atualização |
| `app/layout.tsx` | Adicionado UpdateBanner |
| `features/sales/components/POSView.tsx` | Carrinho preservado em erro |
| `features/sales/services/sales.service.ts` | Colunas específicas nos dropdowns POS |
| `features/sales/actions/sales.actions.ts` | Leituras paralelizadas + instrumentação |
| `app/(dashboard)/error.tsx` | **NOVO** — error boundary global |

## 18. Arquivos Preservados (não alterados)

- `features/commissions/` — 100% preservado
- `features/gamification/config.ts` — flags false mantidas
- `features/audit/` — 100% preservado
- `features/cash/` — 100% preservado
- `features/inventory/` — 100% preservado
- `features/reception/` — 100% preservado
- `features/receivables/` — 100% preservado
- `features/subscriptions/` — 100% preservado
- `features/perfumes/` — 100% preservado
- `supabase/migrations/` — 100% preservado
- RLS policies — 100% preservadas
- Triggers de estoque — 100% preservados

## 19. Commits

```
53bf49b feat(ux): add global error boundary for dashboard route group
e4b5cf7 docs: add route map and cache audit documentation
64bc718 perf(sales): parallelize independent reads in processSale, add timing instrumentation
8a5d564 docs: add performance baseline and PWA audit documentation
e57d6b0 perf(pos): select only necessary columns for POS dependency queries
0678d36 fix(pos): preserve cart on sale error, only reset after confirmed success
042974e perf(pwa): remove Supabase REST cache from SW, replace forced reload with update banner
```

## 20. SHA de Preview

Branch: `perf/internal-erp-optimization`  
HEAD: `53bf49b`  
Base: `9268e9c` (main)

## 21. SHA de Produção

origin/main: `17d4dd0`

---

## 22. Decisão Final (Pós-Auditoria)

**BLOQUEADO — build atual não possui as otimizações relatadas**

### Evidências Matemáticas da Auditoria
1. O commit `9268e9c` (base da otimização) não é ancestral de `origin/main` (`17d4dd0`). O código da otimização **nunca foi enviado para o GitHub**.
2. A Vercel constrói a partir do GitHub (`origin/main`), logo o deployment atual `barber-9khjt9xgr-ichtonnys-projects.vercel.app` (alias: `barber-zac.vercel.app`) não contém os arquivos alterados, a instrumentação `[PERF]`, nem a remoção do cache REST do Service Worker.
3. Não há ganho operacional mensurável em produção porque o código otimizado reside apenas na branch local `perf/internal-erp-optimization`.

**Ação Obrigatória**:
Para validar as otimizações e medir o ganho de performance operacional, é indispensável sincronizar a árvore local com o repositório remoto (push) e provisionar um deployment (produção ou preview alias) contendo a respectiva build. Nenhuma medição de PDV ou dashboard é válida no domínio atual.
