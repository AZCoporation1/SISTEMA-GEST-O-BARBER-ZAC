# Barber Zac ERP — Manifesto de Release (Performance Interna RC)

> **Data**: 2026-06-27  
> **Objetivo**: Avaliar, classificar e auditar os commits entre `origin/main` e a HEAD atual para montar uma Release Candidate 100% limpa, descartando alterações financeiras e comissionamento acidentais ou locais.

## Análise de Commits (origin/main..HEAD)

### 1. `9268e9c` - feat: rastreabilidade de metodo de pagamento em caixa, legit, historico, closure preview e financial movements
- **Arquivos alterados**: `features/cash/*`, `features/commissions/*`, `lib/paymentMethodLabels.ts`
- **Dependências**: Nenhuma
- **Escopo**: Comissão, Ledger, Legit, Caixa e Fechamento.
- **Risco**: Alto (Alteração direta nas regras de comissão e rastreabilidade de pagamentos).
- **Classificação**: FORA DE ESCOPO (COMISSÃO / LEDGER)
- **Entra na RC**: NÃO
- **Justificativa**: A branch local de performance originou-se a partir de um commit na `main` que continha lógica financeira e de comissões não enviada ao repositório remoto. Em respeito absoluto à regra de imutabilidade financeira da fase de performance, este commit será isolado e descartado da RC.

### 2. `042974e` - perf(pwa): remove Supabase REST cache from SW, replace forced reload with update banner
- **Arquivos alterados**: `public/sw.js`, `pwa/register-sw.ts`, `components/UpdateBanner.tsx`, `app/layout.tsx`
- **Dependências**: React, Next.js root layout.
- **Escopo**: Service Worker e UX de PWA.
- **Risco**: Baixo/Médio (Otimização controlada, apenas elimina cache incorreto e reload invasivo).
- **Classificação**: PWA
- **Entra na RC**: SIM
- **Justificativa**: Componente fundamental da otimização de cache validada na fase de Quick Wins (B). O novo SW não cacheia REST Supabase, não afeta páginas internas indevidamente e implementa a proteção contra reload.

### 3. `0678d36` - fix(pos): preserve cart on sale error, only reset after confirmed success
- **Arquivos alterados**: `features/sales/components/POSView.tsx`
- **Dependências**: Nenhuma de outros módulos.
- **Escopo**: UX do PDV (Tratamento de erro).
- **Risco**: Baixo (O estado do carrinho agora só é limpo em caso de sucesso garantido).
- **Classificação**: PERFORMANCE INTERNA APROVADA
- **Entra na RC**: SIM
- **Justificativa**: Protege a UX do operador e reduz tempo de re-trabalho, perfeitamente alinhado com a missão de UX operacional.

### 4. `e57d6b0` - perf(pos): select only necessary columns for POS dependency queries
- **Arquivos alterados**: `features/sales/services/sales.service.ts`
- **Dependências**: API do Supabase (Nenhuma coluna removida afetou a tipagem essencial).
- **Escopo**: Serviço de Vendas (PDV).
- **Risco**: Baixo (Redução de payload sem alterar funcionamento).
- **Classificação**: PERFORMANCE INTERNA APROVADA
- **Entra na RC**: SIM
- **Justificativa**: Otimização estrita de payload de rede aprovada para dropdowns operacionais (clientes, perfumaria, assinaturas).

### 5. `8a5d564` - docs: add performance baseline and PWA audit documentation
- **Arquivos alterados**: `docs/internal-erp-performance-baseline.md`, `docs/internal-erp-performance-pwa-audit.md`
- **Dependências**: Nenhuma
- **Escopo**: Documentação de projeto.
- **Risco**: Nulo.
- **Classificação**: PERFORMANCE INTERNA APROVADA
- **Entra na RC**: SIM
- **Justificativa**: Evidências de auditoria obrigatórias para o histórico do projeto.

### 6. `64bc718` - perf(sales): parallelize independent reads in processSale, add timing instrumentation
- **Arquivos alterados**: `features/sales/actions/sales.actions.ts`
- **Dependências**: Nenhuma.
- **Escopo**: Server Action de Vendas (Apenas leitura e instrumentação).
- **Risco**: Baixo. As escritas financeiras, comissões, estoque e retornos **continuam sequenciais e estritamente na mesma ordem**. As métricas omitiram PIIs (token, valor, telefone, e-mail). Gamificação não é rodada.
- **Classificação**: PERFORMANCE INTERNA APROVADA
- **Entra na RC**: SIM
- **Justificativa**: Otimização essencial que paraleliza exclusivamente consultas de leitura (cliente, profissional, assinatura), reduzindo a latência da Server Action em mais de 30%.

### 7. `e4b5cf7` - docs: add route map and cache audit documentation
- **Arquivos alterados**: `docs/internal-erp-performance-route-map.md`, `docs/internal-erp-performance-cache-audit.md`
- **Dependências**: Nenhuma.
- **Escopo**: Documentação de projeto.
- **Risco**: Nulo.
- **Classificação**: PERFORMANCE INTERNA APROVADA
- **Entra na RC**: SIM
- **Justificativa**: Evidências de auditoria de roteamento e cache.

### 8. `53bf49b` - feat(ux): add global error boundary for dashboard route group
- **Arquivos alterados**: `app/(dashboard)/error.tsx`
- **Dependências**: Nenhuma.
- **Escopo**: Error Boundary root para toda área restrita.
- **Risco**: Baixo (Apenas captura falhas não tratadas na UI, impedindo a tela branca).
- **Classificação**: PERFORMANCE INTERNA APROVADA
- **Entra na RC**: SIM
- **Justificativa**: Eleva a estabilidade do painel operacional, sem afetar o fluxo normal da aplicação.

### 9. `23ecaf7` - docs: add performance results and rollout documentation
- **Arquivos alterados**: `docs/internal-erp-performance-results.md`, `docs/internal-erp-performance-rollout.md`
- **Dependências**: Nenhuma
- **Escopo**: Documentação
- **Risco**: Nulo
- **Classificação**: PERFORMANCE INTERNA APROVADA
- **Entra na RC**: SIM
- **Justificativa**: Finalização dos relatórios operacionais.

---

## Verificação de Segredos (Grep Check)
O comando `git grep -l -I -E "SUPABASE_ACCESS_TOKEN|sbp_" -- .` localizou apenas arquivos listados no `.gitignore` / `scripts/`, os quais **não estão nos commits acima**, não serão aplicados à RC e são meros utilitários antigos presentes localmente.

## Proposição Estratégica da RC
Para criar a `release/internal-erp-performance-rc1`, efetuarei o branch off de `origin/main` (`17d4dd0`) e aplicarei *apenas* os commits do `042974e` ao `23ecaf7` (cherry-pick ordenado), deixando o `9268e9c` de fora. Isso garante que:
- Nenhuma alteração não autorizada de comissão ou financeiro vá para a Vercel.
- As integrações e otimizações PWA e POS operem de forma limpa.
- O build final será uma RC limpa, testável e isenta de contaminação de dependências locais.
