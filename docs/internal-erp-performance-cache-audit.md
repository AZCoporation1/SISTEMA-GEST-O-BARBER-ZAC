# Barber Zac ERP — Performance Interna: Auditoria de Cache e Revalidação

> **Data**: 2026-06-26  
> **Branch**: `perf/internal-erp-optimization`

---

## 1. Arquitetura de Cache Atual

### Descoberta Fundamental

O ERP inteiro usa **fetching 100% client-side** via React Query + Supabase Browser Client.

- O layout `(dashboard)/layout.tsx` é `'use client'`
- NENHUMA rota faz data fetching via Server Components
- As pages "SERVER" são wrappers que importam Client Components
- React Query gerencia cache local no navegador
- Server Actions são chamadas via `useMutation` do React Query
- React Query invalida queries locais via `invalidateQueries` no `onSuccess` de cada mutation

### Implicação para `revalidatePath`

`revalidatePath` invalida o cache de Server Components do Next.js. Como **não existem Server Components com data fetching** neste app, as chamadas `revalidatePath` estão invalidando cache que não contém dados.

O React Query já invalida os caches locais relevantes via `invalidateQueries` nos hooks:
- `usePOSMutations()` → invalida `["sales"]`, `["inventory"]`, `["cash"]`, `["receivables"]`, `["receivable-summary"]`
- `useCashMutations()` → invalida `["activeCashSession"]`, `["cashHistory"]`
- Cada feature hook tem suas próprias invalidações locais

---

## 2. Inventário Completo de `revalidatePath`

### Total: 96 chamadas em 12 arquivos

| Arquivo | Ações que revalidam | Rotas revalidadas | # |
|---------|--------------------|--------------------|---|
| `sales.actions.ts` | processSale | /vendas, /estoque, /caixa, /dashboard, /fluxo-de-caixa | 5 |
| `processSaleWithReceivables.ts` | processSaleWithReceivables | /vendas, /estoque, /caixa, /dashboard, /fluxo-de-caixa, /a-receber | 6 |
| `perfumes.actions.ts` | registrarPerfume, reversal | /perfumes, /estoque, /caixa, /fluxo-de-caixa, /clientes, /comissoes | 9 |
| `approve-request.actions.ts` | aprovarSolicitação | /aprovacao-profissionais, /profissional(3x), /vendas, /estoque, /caixa, /fluxo-de-caixa, /comissoes, /perfumes, /dashboard | 12 |
| `reception.actions.ts` | checkIn, pagamento, adiantamento, etc | /recepcao, /caixa, /estoque, /fluxo-de-caixa | ~16 |
| `receivables.actions.ts` | receberParcela, cancelar, etc | /a-receber, /caixa, /fluxo-de-caixa, /vendas | ~10 |
| `subscription.actions.ts` | CRUD + pagamentos | /assinaturas, /agendamento, /caixa, /fluxo-de-caixa | ~14 |
| `submit-request.actions.ts` | submeterSolicitação | /profissional, /profissional/solicitacoes, /aprovacao-profissionais | 5 |
| `settings.actions.ts` | salvarConfig | /(layout), /configuracoes, /dashboard | 3 |
| `services.actions.ts` | CRUD serviço | /servicos | 2 |
| `cash.actions.ts` | abrir/fechar/lançar caixa | via React Query invalidation | 0 |
| `inventory.actions.ts` | CRUD estoque | via React Query invalidation | 0 |

### Análise de Redundância

As rotas revalidadas via `revalidatePath` não contêm Server Component data fetching:
- `/vendas` → wrapper SC que renderiza `POSView` (CC com React Query)
- `/estoque` → wrapper SC que renderiza CC com `useInventory` (React Query)
- `/caixa` → wrapper SC que renderiza CC com `useCash` (React Query)
- `/dashboard` → CC inteiro com `useEffect` + `createClient()`
- `/fluxo-de-caixa` → wrapper SC com CC que usa `useCashFlow` (React Query)

**Todas as revalidações são redundantes** do ponto de vista de dados. O React Query já cuida da invalidação via `invalidateQueries` nos hooks de mutation.

### Decisão: NÃO REMOVER (ainda)

Apesar da redundância, as chamadas `revalidatePath` são mantidas por segurança:
1. **Custo medido**: A instrumentação C1 vai medir o custo real em ms
2. **Futuro**: Se o app migrar para Server Components com data fetching, as revalidações seriam necessárias
3. **Risco zero de manter**: O custo é apenas latência adicional na Server Action
4. **Risco de remover**: Se algum componente futuro usar Server Component data fetching, a remoção quebraria a invalidação

**Ação posterior**: Após medição C1 confirmar o custo real, documentar aqui e decidir se vale remover.

---

## 3. Inventário de Cache React Query

| queryKey | Fonte | staleTime | Invalidado por |
|----------|-------|-----------|----------------|
| `["sales", filters]` | `getSales()` | default (0) | `usePOSMutations` |
| `["paymentMethods"]` | `getPaymentMethods()` | default (0) | — |
| `["customers"]` | `getCustomers()` | default (0) | — |
| `["collaborators"]` | `getCollaborators()` | default (0) | — |
| `["inventory", filters]` | `getInventory()` | default (0) | `usePOSMutations` |
| `["activeCashSession"]` | `getActiveCashSession()` | default (0) | `useCashMutations` |
| `["cashHistory", filters]` | `getCashSessions()` | default (0) | `useCashMutations` |
| `["receivables", filters]` | `getReceivables()` | default (0) | `useReceivablesMutations` |
| `["receivable-summary"]` | — | default (0) | `usePOSMutations` |

**Observação**: Todos os queryKeys têm `staleTime: 0` (default do React Query v5), o que significa que são refetched em cada mount/window focus. Isso garante dados frescos mas pode causar fetches desnecessários.

### Oportunidade de melhoria (futura):
- `paymentMethods` e `collaborators` raramente mudam → poderiam ter `staleTime: 5 * 60 * 1000` (5 min)
- Não implementar agora — requer análise de impacto em CRUD de payment_methods

---

## 4. Cache do Service Worker

### Antes (problemático)
| Cache | Conteúdo | Estratégia | TTL | Problema |
|-------|----------|-----------|-----|---------|
| `supabase-rest` | GETs REST Supabase | StaleWhileRevalidate | 5 min | **Dados financeiros stale** |
| `html-pages` | Navegação HTML | NetworkFirst | — | Pode servir HTML antigo brevemente |
| `static` | JS/CSS/Workers | StaleWhileRevalidate | — | OK |

### Depois (corrigido — B1)
| Cache | Conteúdo | Estratégia | TTL | Status |
|-------|----------|-----------|-----|--------|
| `html-pages-v3` | Navegação HTML | NetworkFirst | — | ✅ Seguro |
| `static-v3` | JS/CSS/Workers | StaleWhileRevalidate | — | ✅ Seguro |
| `images` | Imagens | CacheFirst | 30 dias | ✅ Seguro |
| `offline-fallback` | offline.html | Manual | — | ✅ Seguro |

---

## 5. Dados que NÃO devem ser cacheados

| Dado | Motivo |
|------|--------|
| Vendas em andamento | Estado mutável, RLS-specific |
| Caixa atual | Sessão ativa, RLS-specific |
| Financeiro | Dados críticos, sensíveis |
| Sessão/Auth | Privado por definição |
| Permissões/Role | Segurança |
| Dados de outro profissional | RLS violation |
| Server Actions (POST) | Mutações |
| RSC payloads | Personalizados por sessão |
| Recebíveis | Dados financeiros sensíveis |

---

## 6. Rollback

- SW cache restaurável via `git revert` do commit B1
- React Query cache é efêmero (memória do navegador)
- `revalidatePath` mantido — nenhuma remoção
