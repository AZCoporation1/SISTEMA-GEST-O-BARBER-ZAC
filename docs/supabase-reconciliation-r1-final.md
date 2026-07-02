# Relatório Final de Reconciliação — Fase R1

## 1. Contexto e Escopo
1. **Worktree usado:** `chore/supabase-history-reconciliation` (limpo).
2. **SHA da base:** `63fb78cb8d5266bfd515f2d9e64bc1c3df0e2b86`.
3. **Arquivos analisados:** 30 arquivos em `supabase/migrations` (worktree limpo) e 8 arquivos em `supabase/migrations_temp` (worktree sujo original).

## 2. Diagnóstico dos Arquivos
4. **Arquivos duplicados:** Múltiplas versões para `20260418`, `20260505` e `20260605` encontradas entre o ambiente trackeado em main e a quarentena.
5. **Arquivos diagnostic/dry-run:** `20260505_000015_diagnostic.sql` e `20260505_000015_dry_run_reconcile.sql` identificados. Eles jamais deveriam ser rastreados como migrations aplicáveis.
6. **Arquivos em quarentena:** Preservados intocados no worktree original.
7. **Migrations recuperadas do remoto:** `20260616` (Gamification), `20260626` (Fase 2) e `20260627` (Queue e Flags) totalmente recuperadas com sucesso e integradas à pasta canônica candidata.
8. **Migrations canônicas candidatas:** Isoladas em `artifacts/supabase/canonical-migrations-candidate`, compondo 24 migrations válidas, removendo temporários e diagnósticos.

## 3. Avaliação de Equivalência de Schema e DML
9. **Migrations que não reproduzem o remoto:** `20260418_000007_customers_and_walkin.sql`, `20260505_000014_fix_handle_new_user.sql`, e `20260505_000015_apply_reconcile.sql`. Elas falham na prova passiva (apenas baseada em tipos TS) e falharam na prova ativa (db diff).
10. **DML não comprovado:** `UPDATE public.customers` e `INSERT INTO public.customers` presentes em arquivos conflitantes.
11. **RLS não comprovada:** Não há como auditar RLS passivamente pelos tipos gerados.
12. **Functions/triggers não comprovados:** A trigger function `handle_new_user()` não foi listada nos tipos remotos por ser interna do Auth.

## 4. DB Diff e Consequência Crítica
13. **Resultado do db diff:** Falhou. A Supabase CLI exige Docker para instanciar o Shadow Database que compila as migrations locais antes da comparação. Sem Docker, o diff foi classificado automaticamente como **G (Diferença de DML não verificável)**.
14. **Necessidade de repair:** Bloqueado por falta de prova incontestável.
15. **Lista de repair:** Nenhuma, operação abortada.

## 5. Artefatos Complementares
16. **Situação da migration 5S V2:** Mantida em quarentena e isolada de qualquer processo remoto ou de geração de tipos.
17. **Situação de types/supabase.ts:** Intocado.

## 6. Próximos Passos Seguros
18. **Arquivos que podem entrar no commit de reconciliação:** Nenhum no momento atual, pois o conjunto não tem chancela de aprovação do diff.
19. **Arquivos que devem permanecer em quarentena:** Todas as duplicatas criadas pelo histórico defeituoso.
20. **Riscos:** Executar um repair às cegas marcaria arquivos com DML inauditado como "aplicados" remotamente. Se esse DML na verdade não estiver lá, o banco de produção e o histórico local ficarão fatalmente dessincronizados na próxima migration.
21. **Rollback:** Garantido pelo isolamento total no worktree `chore/supabase-history-reconciliation`. O ambiente sujo (`main` original) segue intacto.

---
## 22. DECISÃO FINAL:

**BLOQUEADO — CONJUNTO LOCAL NÃO REPRODUZ O SCHEMA REMOTO**
