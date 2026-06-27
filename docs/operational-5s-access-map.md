# Mapa de Acessos — Módulo 5S Operacional

Este documento decreta as regras imutáveis de Role-Based Access Control (RBAC) aplicadas à camada de apresentação e que guiarão o futuro esquema RLS.

## Roles Autorizadas

- `owner_admin_professional` (Gestor Máximo)
- `admin_total` (Gerência)
- `professional` (Equipe)

*Qualquer outro papel, incluindo `unknown` ou nulo (clientes), é estritamente proibido.*

## Mapeamento de Rotas (Front-End)

| Rota Base | Papéis Permitidos | Acesso | Comportamento Bloqueado |
| :--- | :--- | :--- | :--- |
| `/5s-operacional/*` | `owner`, `admin_total` | Total (Read/Write) | Exibe erro 403 / Redirecionamento (Dashboard ou /profissional) para quem não tiver `hasAdminAccess`. Proteção via `middleware.ts` e Layout `useAuth()`. |
| `/profissional/5s` | `professional`, `owner` | Read-only | Redirecionado pelo `middleware.ts` para `/dashboard` se for um admin puro tentando acessar. |

## Mapeamento Previsto (Banco de Dados RLS)
*O banco não foi alterado na V3 (Presentation Shell), mas seguirá a seguinte regra de RLS:*
- `operational_5s_daily_reports`: Leitura/Escrita por `admin`, Leitura por `professional` restrita aos dias aprovados.
- `operational_5s_checklist_items`: Leitura para todos; Escrita por `admin`.
- `operational_5s_pendencies`: Leitura/Escrita global interna.
