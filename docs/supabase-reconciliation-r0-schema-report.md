# Relatório de Captura de Schema Remoto — Fase R0.4

Este documento reporta o resultado da extração dos tipos do schema remoto diretamente via API (usando `gen types typescript --linked`), uma vez que o `db dump` falhou por falta do Docker local.

## Tabelas Encontradas no Schema Remoto:
A auditoria via extração remota provou a existência canônica das seguintes estruturas:
- **Gamificação (Phase 2):**
  - `gamification_feature_flags`
  - `gamification_goals`
  - `gamification_notification_logs`
  - `gamification_period_results`
  - `gamification_points_ledger`
  - `gamification_professional_assignments`
  - `gamification_recompute_queue`
  - `gamification_reward_applications`
  - `gamification_rule_sets`
- **Core / Auditoria:**
  - `audit_logs`
  - `user_profiles`
  - `app_settings`
- **Comissão e Vendas:** As tabelas base de `sales`, `sale_items`, `commissions`, `inventory_items` também constam nativamente no dump TypeScript.

## Análise de Roles e Enums:
A extração provou que a coluna `system_role` na tabela `user_profiles` é mapeada no banco de dados como `string | null` e não como um tipo Enum nativo do PostgreSQL.
Isso significa que as definições:
```typescript
export type SystemRoleEnum = 'admin_total' | 'professional' | 'owner_admin_professional'
```
São *aliases legítimos em TypeScript* mantidos manualmente no arquivo `types/supabase.ts` para auxiliar na checagem de tipos estáticos, e não structs estritos do BD.

## Riscos de Conflito para o 5S
1. **Tabelas 5S Remotas:** Zero tabelas de 5S encontradas. O módulo 5S não foi aplicado em produção.
2. **Migration 5S Aplicada:** Falso. A `20260627` remota é exclusivamente para `gamification_queue_and_flags`. A V2 do 5S nunca vazou para o remoto.
3. Isso confirma a viabilidade total da criação da migration V3 de 5S com um *novo timestamp*, sem colisões com a estrutura já solidificada remotamente.
