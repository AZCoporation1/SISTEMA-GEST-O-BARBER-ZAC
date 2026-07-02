# Inventário do Worktree Sujo — Fase R0.1

Este documento registra o estado forense da branch `feat/operational-5s-module` antes da criação do worktree limpo de reconciliação. Nenhuma alteração foi feita neste diretório durante a extração deste inventário.

## Status do Git
- **Branch atual:** `feat/operational-5s-module`
- **SHA Atual:** `63fb78cb8d5266bfd515f2d9e64bc1c3df0e2b86`
- **SHA origin/main:** `63fb78cb8d5266bfd515f2d9e64bc1c3df0e2b86`

A branch baseia-se corretamente na origin/main, mas o working tree contém modificações e arquivos untracked.

### Modificações Locais (Tracked)
1. `supabase/.temp/cli-latest` - **TRACKED_MODIFICADO**
2. `types/supabase.ts` - **TRACKED_MODIFICADO** (Sobrescrito com tipos remotos usando a flag `--linked` na V2. Contém Gamification e retirou V2 manual).
3. `supabase/migrations/20260505_000015_diagnostic.sql` - **TRACKED_REMOVIDO_LOCALMENTE**
4. `supabase/migrations/20260505_000015_dry_run_reconcile.sql` - **TRACKED_REMOVIDO_LOCALMENTE**

### Arquivos Untracked / Outros
1. `docs/internal-erp-performance-post-release-audit.md` - **DOCUMENTACAO**
2. `docs/internal-erp-performance-pwa-production-verification.md` - **DOCUMENTACAO**
3. `docs/internal-erp-performance-rc-validation.md` - **DOCUMENTACAO**
4. `docs/internal-erp-performance-release-manifest.md` - **DOCUMENTACAO**
5. `docs/internal-erp-performance-security-containment.md` - **DOCUMENTACAO**
6. `docs/operational-5s-architecture-audit.md` - **DOCUMENTACAO**
7. `features/operational-5s/actions/checklist.actions.ts` - **DOMINIO_REUTILIZAVEL_APOS_REVIEW** (Criado na V2).
8. `features/operational-5s/actions/corrective-actions.actions.ts` - **DOMINIO_REUTILIZAVEL_APOS_REVIEW** (Criado na V2).
9. `features/operational-5s/types.ts` - **DOMINIO_REUTILIZAVEL_APOS_REVIEW** (Criado na V2).
10. `prod.html` - **SCRIPT_TEMPORARIO**
11. `supabase/migrations/20260618_sale_item_commission.sql` - **UNTRACKED** (Migration de negócio pendente de outro módulo).
12. `vercel_inspect.json` - **SCRIPT_TEMPORARIO**
13. `vercel_list.json` - **SCRIPT_TEMPORARIO**

### Migrações Movidas (Quarentena em `migrations_temp`)
Estes arquivos causaram a falha no `db pull` original por duplicação de timestamps com os arquivos já rastreados:
1. `20260418_000007_customers_and_walkin.sql` - **MOVIDO_PARA_MIGRATIONS_TEMP**
2. `20260418_services_module.sql` - **MOVIDO_PARA_MIGRATIONS_TEMP**
3. `20260505_000014_fix_handle_new_user.sql` - **MOVIDO_PARA_MIGRATIONS_TEMP**
4. `20260505_000015_diagnostic.sql` - **MOVIDO_PARA_MIGRATIONS_TEMP**
5. `20260505_000015_dry_run_reconcile.sql` - **MOVIDO_PARA_MIGRATIONS_TEMP**
6. `20260505_apply_reconcile.sql` - **MOVIDO_PARA_MIGRATIONS_TEMP**
7. `20260605_000021_subscriptions_internal_fields.sql` - **MOVIDO_PARA_MIGRATIONS_TEMP**
8. `20260605_subscription_customizations.sql` - **MOVIDO_PARA_MIGRATIONS_TEMP**
9. `20260618_000021_sale_commission_snapshot.sql` - **MOVIDO_PARA_MIGRATIONS_TEMP**
10. `20260627_000000_operational_5s_v2.sql` - **MIGRATION_5S_DESCARTAR_SEM_APLICAR** (Isolada da árvore de execução real do banco).

---
*Nenhuma edição neste worktree sujo deve ocorrer.*
