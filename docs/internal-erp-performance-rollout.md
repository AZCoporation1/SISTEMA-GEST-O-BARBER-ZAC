# Barber Zac ERP — Performance Interna: Rollout

> **Data**: 2026-06-26  
> **Branch**: `perf/internal-erp-optimization`  
> **HEAD**: `53bf49b`

---

## Gates de Deploy

| # | Gate | Status |
|---|------|--------|
| 1 | Produção e SHA rastreáveis | ✅ origin/main = `17d4dd0` |
| 2 | Estado de Git auditado | ✅ Branch limpa, sem pendências |
| 3 | Nenhum segredo rastreado | ✅ Confirmado |
| 4 | Nenhuma migration histórica alterada | ✅ Zero migrations tocadas |
| 5 | Nenhum `any`/`as any`/`@ts-nocheck` introduzido | ✅ Nenhum novo |
| 6 | Baseline documentado | ✅ `docs/internal-erp-performance-baseline.md` |
| 7 | Gargalos comprovados | ✅ 5 gargalos corrigidos com evidência |
| 8 | Mudanças vinculadas a métricas | ✅ Instrumentação adicionada em processSale |
| 9 | PWA auditada | ✅ `docs/internal-erp-performance-pwa-audit.md` |
| 10 | SW não cacheia dados privados | ✅ Cache REST Supabase removido |
| 11 | Revalidações auditadas | ✅ `docs/internal-erp-performance-cache-audit.md` |
| 12 | PDV preservado | ✅ Fluxo intacto, carrinho protegido |
| 13 | Caixa preservado | ✅ Zero alteração |
| 14 | Financeiro preservado | ✅ Zero alteração |
| 15 | Estoque preservado | ✅ Zero alteração, triggers intactos |
| 16 | Comissão preservada | ✅ 47%/20%/20% intactos |
| 17 | RLS preservada | ✅ Zero alteração |
| 18 | Vitest aprovado | ✅ 5/5 passed |
| 19 | TypeScript aprovado | ✅ Zero erros |
| 20 | Build aprovado | ✅ Todas as rotas compiladas |
| 21 | Preview validado | ⏳ Aguardando deploy em preview |
| 22 | Smoke test aprovado | ⏳ Aguardando validação operacional |
| 23 | Diff revisado | ✅ 8 arquivos, mudanças cirúrgicas |
| 24 | Commit seletivo e rastreável | ✅ 7 commits individuais |
| 25 | Rollback documentado | ✅ `docs/internal-erp-performance-results.md` |

---

## Checklist de Smoke Test (para Preview)

- [ ] Abrir PDV → adicionar produto → adicionar serviço → finalizar venda
- [ ] Simular erro de venda (caixa fechado) → confirmar carrinho preservado
- [ ] Abrir PDV → venda parcelada → confirmar fluxo completo
- [ ] Registrar perfume → confirmar fluxo completo
- [ ] Abrir/fechar caixa → confirmar dados atualizados imediatamente
- [ ] Navegar: dashboard → vendas → estoque → caixa → fluxo-de-caixa
- [ ] Verificar que dados de caixa atualizam após venda (sem refresh manual)
- [ ] Testar em mobile (320px)
- [ ] Verificar PWA: após deploy, banner de atualização aparece
- [ ] Verificar banner: clicar "Atualizar agora" recarrega
- [ ] Verificar banner: clicar "×" fecha o banner
- [ ] Login como profissional → verificar que não vê dados de outro
- [ ] Verificar gamificação flags: páginas carregam em modo leitura
- [ ] Console: verificar logs `[PERF] processSale` após uma venda

---

## Procedimento de Deploy

```powershell
# 1. Confirmar branch e estado
git branch --show-current
# Esperado: perf/internal-erp-optimization

git status --short
# Esperado: apenas untracked files pré-existentes

# 2. Verificar diff contra main
git diff main --stat

# 3. Merge na main (somente após smoke test aprovado)
git checkout main
git merge perf/internal-erp-optimization --no-ff -m "merge: perf/internal-erp-optimization — otimização interna ERP"

# 4. Push para origin
git push origin main

# 5. Aguardar deploy automático no Vercel (ou deploy via Git)

# 6. Confirmar SHA em produção
git rev-parse HEAD

# 7. Confirmar logs do Vercel
# Verificar que as rotas carregam sem erro

# 8. Confirmar PWA
# Um usuário existente deve ver o banner "Nova versão disponível"
```

---

## Gamificação — Confirmação Final

```
GAMIFICATION_PHASE2_ENABLED = false
GAMIFICATION_REWARD_FINANCIAL_APPLY_ENABLED = false
```

Zero alteração. Flags permanecem false.
