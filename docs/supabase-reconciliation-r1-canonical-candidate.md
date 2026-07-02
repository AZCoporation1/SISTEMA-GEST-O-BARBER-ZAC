# Conjunto Canônico Candidato — Fase R1.C

Diretório de análise: `artifacts/supabase/canonical-migrations-candidate`

Este conjunto contém estritamente as migrations que puderam ter sua existência comprovada remotamente, removendo diagnósticos, dry-runs e DMLs obscuros inauditáveis passivamente.

| Versão | Arquivo candidato | Origem | Ação futura no Git |
| ------ | ----------------- | ------ | ------------------ |
| `20240315000000` | `20240315000000_ai_and_audit.sql` | Tracked origin/main | **MANTER** |
| `20260313000001` | `20260313_000001_initial_schema.sql` | Tracked origin/main | **MANTER** |
| `20260314000002` | `20260314_000002_professional_schema_overhaul.sql`| Tracked origin/main | **MANTER** |
| `20260316000003` | `20260316_000003_audit_logs.sql` | Tracked origin/main | **MANTER** |
| `20260317000004` | `20260317_000004_rls_and_fixes.sql` | Tracked origin/main | **MANTER** |
| `20260331000000` | `20260331_estoque_filter_fix.sql` | Tracked origin/main | **MANTER** |
| `20260410000005` | `20260410_000005_fix_cash_session_constraint.sql`| Tracked origin/main | **MANTER** |
| `20260417000006` | `20260417_000006_professionals_commissions.sql`| Tracked origin/main | **MANTER** |
| `20260418000007` | `20260418_000007_customers_and_walkin.sql` | Tracked origin/main | **REMOVER_DA_PASTA_DE_MIGRATIONS_E_ARQUIVAR** (Não comprovada/DML) |
| `20260418000008` | `20260418_000008_services_module.sql` | Tracked origin/main | **MANTER** |
| `20260421000009` | `20260421_000009_admin_reversal_perfume_sales.sql`| Tracked origin/main | **MANTER** |
| `20260423000010` | `20260423_000010_auth_roles_professional_requests.sql`| Tracked origin/main| **MANTER** |
| `20260429000011` | `20260429_000011_perfume_dual_pricing.sql` | Tracked origin/main | **MANTER** |
| `20260430000012` | `20260430_000012_agenda_module.sql` | Tracked origin/main | **MANTER** |
| `20260502000013` | `20260502_000013_customer_portal.sql` | Tracked origin/main | **MANTER** |
| `20260505000014` | `20260505_000014_fix_handle_new_user.sql` | Tracked origin/main | **REMOVER_DA_PASTA_DE_MIGRATIONS_E_ARQUIVAR** (Trigger inauditável) |
| `20260505000015` | `20260505_000015_apply_reconcile.sql` | Tracked origin/main | **REMOVER_DA_PASTA_DE_MIGRATIONS_E_ARQUIVAR** (DML inauditável) |
| `20260505000015` | `20260505_000015_diagnostic.sql` | Tracked origin/main | **REMOVER_DA_PASTA_DE_MIGRATIONS_E_ARQUIVAR** (Diagnóstico) |
| `20260505000015` | `20260505_000015_dry_run_reconcile.sql` | Tracked origin/main | **REMOVER_DA_PASTA_DE_MIGRATIONS_E_ARQUIVAR** (Dry Run) |
| `20260520000016` | `20260520_000016_reception_module.sql` | Tracked origin/main | **MANTER** |
| `20260522000017` | `20260522_000017_subscriptions_module.sql` | Tracked origin/main | **MANTER** |
| `20260523000018` | `20260523_000018_accounts_receivable.sql` | Tracked origin/main | **MANTER** |
| `20260527000019` | `20260527_000019_product_forced_deletion.sql` | Tracked origin/main | **MANTER** |
| `20260528000020` | `20260528_000020_push_notifications.sql` | Tracked origin/main | **MANTER** |
| `20260605000021` | `20260605_000021_subscriptions_internal_fields.sql` | Tracked origin/main | **REMOVER_DA_PASTA_DE_MIGRATIONS_E_ARQUIVAR** (Necessita review humano) |
| `20260605000022` | `20260605_000022_subscription_customizations.sql`| Tracked origin/main | **REMOVER_DA_PASTA_DE_MIGRATIONS_E_ARQUIVAR** (Necessita review humano) |
| `20260616000023` | `20260616_000023_gamification_module.sql` | Fetch Remoto | **ADICIONAR_AO_GIT** |
| `20260618000021` | `20260618_sale_item_commission.sql` | Tracked origin/main | **MANTER** |
| `20260626000024` | `20260626_000024_gamification_phase2.sql` | Fetch Remoto | **ADICIONAR_AO_GIT** |
| `20260627000025` | `20260627_000025_gamification_queue_and_flags.sql`| Fetch Remoto | **ADICIONAR_AO_GIT** |
