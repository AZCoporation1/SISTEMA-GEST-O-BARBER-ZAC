# Barber Zac ERP — Performance Interna: Baseline Atualizado

> **Data**: 2026-06-26  
> **Branch de performance**: `perf/internal-erp-optimization`  
> **SHA base**: `9268e9c` (main)  
> **Escopo**: Área Administrativa + Área Profissional (somente rotas internas)

---

## 1. Estado do Repositório

| Campo | Valor |
|-------|-------|
| **Branch de trabalho** | `perf/internal-erp-optimization` (criada a partir de `main`) |
| **SHA base** | `9268e9c9c9bcd61a89adf17fb0acbc094af5edd2` |
| **origin/main** | `17d4dd0aa25f7e8110a7b72489752c434b75e0e0` |
| **main local vs origin** | 1 commit à frente (`9268e9c` — rastreabilidade de pagamento) |
| **Branch de gamificação** | `recovery/gamification-phase2-alignment` HEAD=`97d2575` — preservada com stash |
| **Stash** | `gamification-phase2-work-in-progress` (7 modified gamification files) |
| **Estado da branch perf** | Limpa — sem alterações de gamificação misturadas |

### Decisão de Branch
- Performance isolada em `perf/internal-erp-optimization`
- Sem mistura com gamificação, comissão, agenda ou tipos
- Base = `main` local incluindo commit de rastreabilidade de pagamento
- Gamificação preservada em stash na branch `recovery/gamification-phase2-alignment`

### Deploy em produção (provável)
- `origin/main` = `17d4dd0` — último commit pushed

---

## 2. Gamificação — Confirmação de Flags

| Flag | Valor | Arquivo |
|------|-------|---------|
| `GAMIFICATION_PHASE2_ENABLED` | `false` | `features/gamification/config.ts:30` |
| `GAMIFICATION_REWARD_FINANCIAL_APPLY_ENABLED` | `false` | `features/gamification/config.ts:45` |

✅ Zero queue, zero recomputação, zero pontos, zero notificação, zero bônus nesta fase.

---

## 3. Principais Queixas do Usuário

1. Sistema lento
2. Clique em elementos internos demora ou trava
3. Páginas exigem refresh manual
4. Fechamento de comanda/venda é lento
5. Interações com atraso
6. Navegação pesada
7. Áreas internas carregam dados demais
8. 220+ usuários
9. PWA pode contribuir para bundle desatualizado

---

## 4. Gargalos Comprovados (com evidência de código)

### G1 — Service Worker cacheia dados REST do Supabase (5min stale)
- **Arquivo**: `public/sw.js:192-205`
- **Evidência**: `StaleWhileRevalidate` com cacheName `supabase-rest`, maxEntries 200, maxAgeSeconds 300
- **Impacto**: Após venda, caixa/estoque/dashboard podem mostrar dados de até 5 minutos atrás
- **Causa**: SW intercepta GETs Supabase e serve cache stale
- **Severidade**: 🔴 CRÍTICA

### G2 — `controllerchange` dispara `window.location.reload()`
- **Arquivo**: `pwa/register-sw.ts:7-8`
- **Evidência**: `navigator.serviceWorker.addEventListener("controllerchange", () => { setTimeout(() => window.location.reload(), 300) })`
- **Impacto**: Reload inesperado após deploy, interrompe venda/formulário
- **Severidade**: 🔴 ALTA

### G3 — Revalidação massiva pós-venda
- **Arquivo**: `features/sales/actions/sales.actions.ts:185-189`
- **Evidência**: 5× `revalidatePath` após cada venda (vendas, estoque, caixa, dashboard, fluxo-de-caixa)
- **Arquivo**: `features/sales/actions/processSaleWithReceivables.ts:235-240`
- **Evidência**: 6× `revalidatePath` após venda parcelada (+a-receber)
- **Impacto**: Cada revalidação invalida o cache de rota inteira; rotas que ninguém está vendo são invalidadas
- **Observação IMPORTANTE**: Como TODAS as páginas são Client Components que fazem fetch via React Query no browser, `revalidatePath` nesta aplicação **não invalida cache de Server Components (porque não há SSR data fetching)**. O impacto real pode ser menor do que estimado inicialmente — precisa de medição de duração real.
- **Severidade**: 🟡 MÉDIA (requer medição para confirmar impacto real)

### G4 — POSView carrega perPage:1000 para inventário
- **Arquivo**: `features/sales/components/POSView.tsx:45`
- **Evidência**: `useInventory({ page: 1, perPage: 1000, status: "active", search: "" })`
- **Impacto**: Depende da quantidade de produtos ativos. Se <200, impacto baixo. Se >500, payload pesado
- **Severidade**: 🟡 MÉDIA (requer medição de quantidade real)

### G5 — `getCustomers()` carrega TODOS os clientes sem paginação
- **Arquivo**: `features/sales/services/sales.service.ts:58-66`
- **Evidência**: `supabase.from("customers").select("*").order("full_name")` — sem limit, sem paginação
- **Impacto**: Com 220+ usuários, payload cresce linearmente. Todas as colunas trazidas.
- **Severidade**: 🟡 MÉDIA

### G6 — `getCollaborators()` e `getPaymentMethods()` usam `select("*")`
- **Arquivo**: `features/sales/services/sales.service.ts:46-55, 69-79`
- **Evidência**: Trazem todas as colunas; profissionais provavelmente <20, métodos <10
- **Severidade**: 🟢 BAIXA (tabelas pequenas)

### G7 — Dashboard 100% client-side com `select("*")` em view pesada
- **Arquivo**: `app/(dashboard)/dashboard/page.tsx:60`
- **Evidência**: `supabase.from("vw_inventory_position").select("*")` — view com subquery correlacionada para saldo
- **Impacto**: Toda a view materializada é transferida para o browser para calcular aggregates
- **Severidade**: 🟡 MÉDIA (requer EXPLAIN para quantificar)

### G8 — `getSales()` traz `sale_items(*)` em listagem
- **Arquivo**: `features/sales/services/sales.service.ts:10-16`
- **Evidência**: `select("*, items:sale_items(*), collaborator(...), customer(...), payment_method(...)")`
- **Impacto**: Cada venda na listagem traz TODOS os itens com TODAS as colunas. Em listagem paginada de 20 vendas, pode significar centenas de sale_items
- **Severidade**: 🟡 MÉDIA

### G9 — Carrinho limpo antes de verificar resultado da venda
- **Arquivo**: `features/sales/components/POSView.tsx:241-256`
- **Evidência**: `await processSale(payload)` seguido imediatamente de reset do carrinho, sem verificar `res.success`
- **Impacto**: Em caso de erro, carrinho é perdido — operador precisa refazer toda a venda
- **Severidade**: 🔴 ALTA (UX de checkout)

### G10 — `select("*")` em 40+ locais do codebase
- **Evidência**: Auditoria de grep encontrou 40+ usos de `.select("*")`
- **Locais críticos**: reception.actions.ts (13×), inventory.service.ts (3×), cash.actions.ts (2×), sales.service.ts (3×)
- **Severidade**: 🟡 MÉDIA (depende de tamanho de tabela e se a tela usa os dados)

---

## 5. Revalidações Mapeadas (completo)

| Action File | Ação | Rotas revalidadas | Contagem |
|-------------|------|-------------------|----------|
| `sales.actions.ts` | processSale | vendas, estoque, caixa, dashboard, fluxo-de-caixa | 5 |
| `processSaleWithReceivables.ts` | processSaleWithReceivables | vendas, estoque, caixa, dashboard, fluxo-de-caixa, a-receber | 6 |
| `perfumes.actions.ts` | registrar perfume | perfumes, estoque, caixa, fluxo-de-caixa, clientes, comissoes | 6 |
| `perfumes.actions.ts` | reversal | perfumes, caixa, fluxo-de-caixa | 3 |
| `approve-request.actions.ts` | aprovar solicitação | aprovacao-profissionais, profissional(3×), vendas, estoque, caixa, fluxo-de-caixa, comissoes, perfumes, dashboard | 10 |
| `reception.actions.ts` | ações diversas | recepcao, caixa, estoque, fluxo-de-caixa | 3-4 por ação |
| `receivables.actions.ts` | receber parcela | a-receber, caixa, fluxo-de-caixa, vendas | 4 |
| `subscription.actions.ts` | operações de assinatura | assinaturas, agendamento, caixa, fluxo-de-caixa | 2-4 |
| `settings.actions.ts` | salvar config | `/` (layout), configuracoes, dashboard | 3 |
| `services.actions.ts` | CRUD serviço | servicos | 1 |
| `submit-request.actions.ts` | submeter solicitação | profissional, profissional/solicitacoes, aprovacao-profissionais | 3 |
| **TOTAL** | | | **~96 chamadas em 12 arquivos** |

---

## 6. Arquitetura Observada

### Padrão de Data Fetching
- **100% client-side** via React Query + Supabase Browser Client
- Nenhuma rota usa Server Components para fetch de dados
- `app/(dashboard)/layout.tsx` é `'use client'` — todos os filhos são Client Components
- Pages "SERVER" na listagem são apenas wrappers que importam Client Components

### Padrão de Mutations
- Server Actions chamadas via `useMutation` do React Query
- React Query invalida queries locais (`invalidateQueries`) após sucesso
- Server Actions fazem `revalidatePath` no servidor (que é redundante quando dados são client-side)

### Implicação da Redundância
Se todas as rotas fazem fetch client-side via React Query, os `revalidatePath` do server **podem estar fazendo trabalho desnecessário** — invalidando cache de Server Components que não existem. O React Query já invalida seus próprios caches locais via `invalidateQueries`. Isso precisa ser confirmado com medição de duração real das Server Actions.

---

## 7. Plano de Rollback

- Branch isolada `perf/internal-erp-optimization`
- Cada mudança = commit isolado
- `git revert <commit>` para qualquer mudança individual
- Stash de gamificação preservado separadamente
- Nenhuma migration aplicada sem aprovação
- Nenhum `git add .`

---

## 8. Hipóteses (ordenadas por confiança)

| # | Hipótese | Confiança | Próximo passo |
|---|---------|-----------|--------------|
| H1 | SW cache de Supabase REST causa dados stale | ALTA | Remover cache REST do SW |
| H2 | `controllerchange` reload interrompe operação | ALTA | Substituir por banner |
| H3 | Carrinho limpo antes de confirmar sucesso | ALTA (código comprovado) | Verificar resultado antes de limpar |
| H4 | `revalidatePath` redundante (dados são client-side) | MÉDIA | Medir duração real das Server Actions |
| H5 | Dashboard query pesada (`vw_inventory_position`) | MÉDIA | EXPLAIN da view |
| H6 | Clientes carregados sem limit no POSView | MÉDIA | Verificar cardinalidade |
| H7 | Sale items trazidos na listagem | MÉDIA | Verificar uso real dos dados |
