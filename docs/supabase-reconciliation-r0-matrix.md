# Matriz de Reconciliação do Histórico — Fase R0.3

Esta matriz compara o estado do worktree sujo, do worktree limpo (`origin/main`) e do histórico remoto após a execução de `npx supabase migration fetch`.

| Timestamp | origin/main | Worktree sujo | migrations_temp | Histórico remoto | Recuperada via fetch | Decisão Proposta |
| --------- | ----------- | ------------- | --------------- | ---------------- | -------------------- | ------- |
| `20260418` | 2 arquivos | 2 arquivos | 2 arquivos | 1 aplicado | NÃO (já existia) | **MIGRATION_LOCAL_NAO_APLICADA** (ou DUPLICADA, há 2 locais mas 1 remoto) |
| `20260505` | 4 arquivos | 2 arquivos (2 removidos) | 4 arquivos | 1 aplicado | NÃO (já existia) | **MIGRATION_LOCAL_NAO_APLICADA** (há 4 locais, apenas 1 no remoto) |
| `20260605` | 2 arquivos | 2 arquivos | 2 arquivos | 1 aplicado | NÃO (já existia) | **MIGRATION_LOCAL_NAO_APLICADA** (há 2 locais, apenas 1 no remoto) |
| `20260616` | AUSENTE | AUSENTE | AUSENTE | 1 aplicado | SIM (`gamification_module.sql`) | **RECUPERAR_DO_REMOTO** |
| `20260618` | 1 arquivo | 1 arquivo (untracked) | 1 arquivo | 1 aplicado | NÃO (já existia) | **MANTER_EM_ORIGIN** (O fetch detectou que já estava lá) |
| `20260626` | AUSENTE | AUSENTE | AUSENTE | 1 aplicado | SIM (`gamification_phase2.sql`) | **RECUPERAR_DO_REMOTO** |
| `20260627` | AUSENTE | AUSENTE (criada `_v2`) | `_v2.sql` | 1 aplicado | SIM (`gamification_queue_and_flags.sql`) | **CONFLITO_REAL** (Timestamp pertence à Gamificação remota; a V2 local é inválida e bloqueada) |

### Análise:
O comando `fetch` funcionou perfeitamente e baixou os arquivos da Gamificação que estavam perdidos:
- `20260616_000023_gamification_module.sql`
- `20260626_000024_gamification_phase2.sql`
- `20260627_000025_gamification_queue_and_flags.sql`

No entanto, o problema central não é apenas a falta desses arquivos. O problema é que `origin/main` rastreia arquivos com prefixos `20260418`, `20260505`, e `20260605` de forma repetida (vários arquivos para a mesma data de sufixo diferente), mas o histórico remoto acusa que apenas **um** arquivo de cada dia foi aplicado na tabela de migrations.

Isto recai diretamente sobre o **Cenário B**: Persistem diferenças, e requer aprovação explícita para `migration repair`.
