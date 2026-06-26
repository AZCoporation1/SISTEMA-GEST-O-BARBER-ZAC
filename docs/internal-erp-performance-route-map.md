# Barber Zac ERP — Performance Interna: Mapa de Rotas

> **Data**: 2026-06-26  
> **Branch**: `perf/internal-erp-optimization`

---

## Legenda

| Símbolo | Significado |
|---------|-------------|
| 🔴 | Prioridade ALTA |
| 🟡 | Prioridade MÉDIA |
| 🟢 | Prioridade BAIXA |
| SC | Server Component (wrapper apenas) |
| CC | Client Component (fetch client-side) |

---

## 1. Rotas Administrativas

### `/dashboard` — 🔴 ALTA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/(dashboard)/dashboard/page.tsx` (13.5 KB) |
| **Renderização** | CC — `'use client'` com `useEffect` + `createClient()` |
| **Dados exibidos** | KPIs: estoque (custo/venda), vendas hoje, caixa, produtos críticos, resumo financeiro mensal |
| **Queries** | `vw_inventory_position(*)`, `sales(total,status)`, `cash_sessions(*)`, `sales(id,total,sale_date,status,customer)`, `stock_movements(id,type,qty,date,product)`, `financial_movements(type,amount,category)` |
| **Server Actions** | Nenhuma |
| **Revalidação** | Nenhuma (dados client-side via useEffect) |
| **Paginação** | Não — carrega tudo |
| **Cache** | Nenhum cache (useEffect a cada navegação) |
| **RLS** | Depende de policy por tabela |
| **Hipótese** | `vw_inventory_position(*)` pode ser pesada; aggregates calculados no browser |
| **Risco** | `select("*")` em view pesada; sem paginação |

### `/vendas` (PDV) — 🔴 CRÍTICA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/(dashboard)/vendas/page.tsx` → `POSView.tsx` (32.6 KB, 678 linhas) |
| **Renderização** | SC wrapper → CC monolítico |
| **Dados exibidos** | Catálogo produtos, catálogo serviços, carrinho, clientes, profissionais, métodos pagamento |
| **Queries** | `useInventory(perPage:1000)`, `useServices(perPage:1000)`, `getCustomers(id,full_name)`, `getCollaborators(id,name)`, `getPaymentMethods(id,name)` |
| **Server Actions** | `processSaleWithReceivables` → `processSale` |
| **Revalidação** | 5-6× `revalidatePath` pós-venda |
| **Paginação** | Não — perPage:1000 |
| **Cache** | React Query (staleTime default) |
| **Hipótese** | perPage:1000 pode ser excessivo; carrinho agora preservado em erro (B3 ✅) |
| **Risco** | Componente monolítico de 678 linhas; sem code splitting |

### `/caixa` — 🔴 ALTA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/(dashboard)/caixa/page.tsx` → CC via hooks |
| **Queries** | `getActiveCashSession()`, `getCashSessions()`, `getPaymentMethods()` |
| **Server Actions** | `openCashSession`, `closeCashSession`, `addCashEntry` |
| **Revalidação** | React Query invalidation local |
| **Cache** | React Query `queryKey: ["activeCashSession"]` |
| **Risco** | Dados stale agora resolvido (B1 ✅ — SW não cacheia REST) |

### `/agendamento` — 🔴 ALTA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/(dashboard)/agendamento/page.tsx` (320 B) → CC |
| **Queries** | `agenda.service.ts` — múltiplos `select("*")` |
| **RLS** | Filtra por profissional |
| **Risco** | `select("*")` em 5 locais |

### `/recepcao` — 🔴 ALTA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/(dashboard)/recepcao/page.tsx` (411 B) → CC |
| **Queries** | `reception.actions.ts` — 13× `select("*")` |
| **Server Actions** | Múltiplas ações de recepção (check-in, pagamento, adiantamento) |
| **Revalidação** | 3-4× `revalidatePath` por ação |
| **Risco** | Alto volume de select("*") |

### `/comissoes` — 🟡 MÉDIA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/(dashboard)/comissoes/page.tsx` (449 B) → CC |
| **Queries** | `useProfessionals()`, `useProfessionalLedger()` |
| **Imutabilidade** | 47% serviço, 20% produtos — SAGRADO |
| **Risco** | Nenhum (leitura somente) |

### `/fluxo-de-caixa` — 🟡 MÉDIA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/(dashboard)/fluxo-de-caixa/page.tsx` (389 B) → CC |
| **Queries** | `useCashFlow()` → `cash-flow.service.ts` com `select("*")` |
| **Risco** | `select("*")` em `financial_movements` |

### `/a-receber` — 🟡 MÉDIA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/(dashboard)/a-receber/page.tsx` (157 B) → CC |
| **Queries** | `useReceivables()` |
| **Server Actions** | `receivables.actions.ts` — 4× `select("*")` |
| **Revalidação** | 3-4× `revalidatePath` por ação |

### `/perfumes` — 🟡 MÉDIA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/(dashboard)/perfumes/page.tsx` (378 B) → CC |
| **Queries** | `usePerfumes()` |
| **Server Actions** | `perfumes.actions.ts` — 6× `revalidatePath` por ação |
| **Imutabilidade** | Comissão 20% — SAGRADO |

### `/clientes` — 🟡 MÉDIA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/(dashboard)/clientes/page.tsx` (384 B) → CC |
| **Queries** | `useCustomers()` |
| **Server Actions** | `customers.actions.ts` — `select("*")` para auditoria |

### `/assinaturas` — 🟡 MÉDIA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/(dashboard)/assinaturas/page.tsx` (394 B) → CC |
| **Server Actions** | `subscription.actions.ts` (1546 linhas!) — múltiplas revalidações |
| **Revalidação** | 2-4× `revalidatePath` por ação |

### `/estoque` — 🟢 BAIXA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/(dashboard)/estoque/page.tsx` (351 B) → CC |
| **Queries** | `useInventory()` — com paginação |
| **Imutabilidade** | Triggers de estoque — SAGRADO |

### `/servicos` — 🟢 BAIXA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/(dashboard)/servicos/page.tsx` (433 B) → CC |
| **Queries** | `useServices()` |
| **Revalidação** | 1× `revalidatePath("/servicos")` — adequado |

### `/movimentacoes` — 🟢 BAIXA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/(dashboard)/movimentacoes/page.tsx` (377 B) → CC |
| **Queries** | `useMovements()` |

### `/gamificacao` — 🟢 SOMENTE LEITURA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/(dashboard)/gamificacao/page.tsx` (2.7 KB) |
| **Renderização** | SC — sem data fetching pesado |
| **Flags** | `GAMIFICATION_PHASE2_ENABLED = false` |
| **Ação** | NÃO TOCAR — apenas manter flags false |

### `/gamificacao/regras` — 🟢 SOMENTE LEITURA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/(dashboard)/gamificacao/regras/page.tsx` (33.3 KB) |
| **Renderização** | CC |
| **Ação** | NÃO TOCAR |

---

## 2. Rotas Profissional

### `/profissional` — 🟡 MÉDIA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/profissional/page.tsx` (5.9 KB) |
| **Renderização** | CC |

### `/profissional/agenda` — 🔴 ALTA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/profissional/agenda/page.tsx` (6.8 KB) |
| **Renderização** | CC |
| **RLS** | Filtra por profissional logado |

### `/profissional/registrar` — 🔴 ALTA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/profissional/registrar/page.tsx` (19.4 KB) |
| **Renderização** | CC |
| **Server Actions** | Registro de atendimento / venda do profissional |

### `/profissional/solicitacoes` — 🟡 MÉDIA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/profissional/solicitacoes/page.tsx` (7.2 KB) |
| **Renderização** | CC |
| **Queries** | `useMyRequests()` |

### `/profissional/conta` — 🟢 BAIXA
| Campo | Valor |
|-------|-------|
| **Arquivo** | `app/profissional/conta/page.tsx` (7 KB) |
| **Renderização** | CC |

---

## 3. Top 10 Gargalos de Revalidação

| # | Arquivo | Ação | Revalidações | Severidade |
|---|---------|------|-------------|-----------|
| 1 | `approve-request.actions.ts` | aprovar solicitação | 10× | 🔴 |
| 2 | `perfumes.actions.ts` | venda perfume | 6× | 🔴 |
| 3 | `processSaleWithReceivables.ts` | venda parcelada | 6× | 🔴 |
| 4 | `sales.actions.ts` | venda comum | 5× | 🔴 |
| 5 | `reception.actions.ts` | check-in + pagamento | 4× | 🟡 |
| 6 | `receivables.actions.ts` | receber parcela | 4× | 🟡 |
| 7 | `subscription.actions.ts` | ação assinatura | 4× | 🟡 |
| 8 | `submit-request.actions.ts` | submeter solicitação | 3× | 🟡 |
| 9 | `settings.actions.ts` | salvar config | 3× | 🟡 |
| 10 | `cash.actions.ts` | operação caixa | via React Query | 🟢 |

---

## 4. Top 10 Queries com `select("*")`

| # | Arquivo | Tabela | Frequência | Tipo |
|---|---------|--------|-----------|------|
| 1 | `reception.actions.ts` | Múltiplas | 13× | Read+Write |
| 2 | `agenda.service.ts` | appointments, blocks | 5× | Read |
| 3 | `receivables.actions.ts` | receivables | 4× | Read+Write |
| 4 | `inventory.service.ts` | products/inventory | 3× | Read |
| 5 | `sales.service.ts` | sales, items | 3× | Read |
| 6 | `cash.actions.ts` | cash_sessions, entries | 2× | Read |
| 7 | `services.actions.ts` | services | 2× | Read+Write |
| 8 | `availability.service.ts` | availability | 2× | Read |
| 9 | `cash-flow.service.ts` | financial_movements | 1× | Read |
| 10 | `settings.service.ts` | settings | 1× | Read |

---

## 5. Componentes Pesados

| # | Componente | Tamanho | Localização |
|---|-----------|---------|-------------|
| 1 | `POSView.tsx` | 32.6 KB / 678 linhas | `features/sales/components/` |
| 2 | `gamificacao/regras/page.tsx` | 33.3 KB | `app/(dashboard)/gamificacao/regras/` |
| 3 | `whatsapp/page.tsx` | 28.4 KB | `app/(dashboard)/whatsapp/` (FORA DE ESCOPO) |
| 4 | `aprovacao-profissionais/page.tsx` | 20.6 KB | `app/(dashboard)/aprovacao-profissionais/` |
| 5 | `profissional/registrar/page.tsx` | 19.4 KB | `app/profissional/registrar/` |
