# Ledger Forense de Migrations — Fase R1.A

## Metodologia
Todos os arquivos presentes na pasta `supabase/migrations` do worktree limpo (`chore/supabase-history-reconciliation`) e `supabase/migrations_temp` do worktree sujo (`../barber-zac/supabase/migrations_temp`) foram analisados.

---

### Migrations Canônicas Recentes (Tracked em origin/main)

| Arquivo | Prefixo | SHA-256 (prefixo) | Origem | DML/Schema | Decisão |
|---|---|---|---|---|---|
| `20260418_000007_customers_and_walkin.sql` | 20260418 | 08FB... | Tracked origin/main | UPDATE public.customers | **CANONICA_LOCAL** |
| `20260418_000008_services_module.sql` | 20260418 | B717... | Tracked origin/main | CREATE service_categories, services | **CANONICA_LOCAL** |
| `20260505_000014_fix_handle_new_user.sql` | 20260505 | 26ED... | Tracked origin/main | FUNCTION handle_new_user | **CANONICA_LOCAL** |
| `20260505_000015_apply_reconcile.sql` | 20260505 | AAC5... | Tracked origin/main | UPDATE/INSERT customers | **CANONICA_LOCAL** |
| `20260505_000015_diagnostic.sql` | 20260505 | 5CA6... | Tracked origin/main | Diagnóstico | **DIAGNOSTICO_NAO_DEVE_SER_MIGRATION** |
| `20260505_000015_dry_run_reconcile.sql` | 20260505 | 612E... | Tracked origin/main | Dry-run | **DRY_RUN_NAO_DEVE_SER_MIGRATION** |
| `20260605_000021_subscriptions_internal_fields.sql` | 20260605 | 7BD0... | Tracked origin/main | ALTER | **CANONICA_LOCAL** |
| `20260605_000022_subscription_customizations.sql` | 20260605 | 635A... | Tracked origin/main | ALTER | **CANONICA_LOCAL** |
| `20260618_sale_item_commission.sql` | 20260618 | 0336... | Tracked origin/main | DML/Schema | **CANONICA_LOCAL** |

### Migrations Recuperadas do Remoto

| Arquivo | Prefixo | SHA-256 (prefixo) | Origem | DML/Schema | Decisão |
|---|---|---|---|---|---|
| `20260616_000023_gamification_module.sql` | 20260616 | CDBD... | Fetch Remoto | Gamificação | **CANONICA_REMOTA** |
| `20260626_000024_gamification_phase2.sql` | 20260626 | A52E... | Fetch Remoto | Gamificação Fase 2 | **CANONICA_REMOTA** |
| `20260627_000025_gamification_queue_and_flags.sql` | 20260627 | 7EF2... | Fetch Remoto | Gamificação Flags | **CANONICA_REMOTA** |

### Quarentena (`migrations_temp` do worktree sujo)

| Arquivo | Prefixo | SHA-256 (prefixo) | Origem | DML/Schema | Decisão |
|---|---|---|---|---|---|
| `20260418_000007_customers_and_walkin.sql` | 20260418 | 5906... | Untracked Local | UPDATE customers | **DUPLICATA_LOCAL** |
| `20260418_services_module.sql` | 20260418 | 774E... | Untracked Local | CREATE services | **DUPLICATA_LOCAL** |
| `20260505_000014_fix_handle_new_user.sql` | 20260505 | 26ED... | Untracked Local | FUNCTION | **DUPLICATA_LOCAL** |
| `20260505_apply_reconcile.sql` | 20260505 | A523... | Untracked Local | UPDATE/INSERT | **DUPLICATA_LOCAL** |
| `20260605_000021_subscriptions_internal_fields.sql` | 20260605 | 7C01... | Untracked Local | ALTER | **DUPLICATA_LOCAL** |
| `20260605_subscription_customizations.sql` | 20260605 | E5BD... | Untracked Local | ALTER | **DUPLICATA_LOCAL** |
| `20260618_000021_sale_commission_snapshot.sql` | 20260618 | 1878... | Untracked Local | Schema | **DUPLICATA_LOCAL** |
| `20260627_000000_operational_5s_v2.sql` | 20260627 | 6557... | Untracked Local | CREATE 7 tabelas | **BLOQUEADA_POR_EFEITO_NAO_COMPROVADO** |

---
**Conclusão R1.A:** As migrations rastreadas em `origin/main` e as recuperadas do remoto formam o conjunto canônico inicial. As duplicatas locais em `migrations_temp` contêm o mesmo teor de schema mas nomes ligeiramente diferentes, confirmando que causaram a colisão. Os arquivos de `diagnostic` e `dry_run` em `origin/main` não devem habitar a pasta oficial.
