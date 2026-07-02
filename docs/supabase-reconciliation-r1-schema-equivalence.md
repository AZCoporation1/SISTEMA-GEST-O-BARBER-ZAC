# Prova de Equivalência de Schema — Fase R1.B

Este documento analisa cada migration local com timestamp divergente (`20260418`, `20260505`, `20260605`) rastreada no conjunto canônico de `origin/main` para provar se seus efeitos existem no banco remoto. A prova baseia-se estritamente na captura de tipos remotos (`supabase.remote.generated.ts`).

| Arquivo | Objeto/efeito | Existe no remoto | Evidência | Coberto por migration remota | Decisão |
| ------- | ------------- | ---------------- | --------- | ---------------------------- | ------- |
| `20260418_000007_customers_and_walkin.sql` | DML: `UPDATE public.customers` | Não se aplica | DML não exporta p/ tipos TS | `20260418` (aplicado, mas genérico) | **NAO_COMPROVADO** |
| `20260418_000008_services_module.sql` | Schema: `CREATE TABLE services, service_categories` | SIM | Encontrado no `.ts` gerado | `20260418` (aplicado) | **COBERTO_POR_REMOTA** |
| `20260505_000014_fix_handle_new_user.sql` | Schema: `FUNCTION handle_new_user()` | Não se aplica | Trigger DB não exporta em RPC | `20260505` (aplicado) | **NAO_COMPROVADO** |
| `20260505_000015_apply_reconcile.sql` | DML: `UPDATE/INSERT customers` | Não se aplica | DML não exporta p/ tipos TS | `20260505` (aplicado) | **NAO_COMPROVADO** |
| `20260605_000021_subscriptions_internal_fields.sql` | Schema: `ALTER customer_subscriptions, etc` | PROVÁVEL | Tabelas existem | `20260605` (aplicado) | **PRECISA_DE_REVIEW_HUMANO** |
| `20260605_000022_subscription_customizations.sql` | Schema: `ALTER customer_subscriptions` | PROVÁVEL | Tabelas existem | `20260605` (aplicado) | **PRECISA_DE_REVIEW_HUMANO** |

**Conclusão R1.B:** Várias migrações dependem de DMLs e Triggers não auditáveis somente pelos tipos TypeScript. Portanto, elas são não comprováveis passivamente. Segundo as restrições da Fase R1, nenhum repair pode ser proposto para arquivos `NAO_COMPROVADO` ou `PRECISA_DE_REVIEW_HUMANO`.
