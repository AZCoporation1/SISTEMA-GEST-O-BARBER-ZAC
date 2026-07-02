# Auditoria da Arquitetura Atual — Módulo 5S Operacional IBZ

## 1. Contexto Base
- **Branch atual:** `feat/operational-5s-module`
- **SHA base:** `63fb78cb8d5266bfd515f2d9e64bc1c3df0e2b86` (da branch `main`)
- **Fuso horário adotado:** `America/Sao_Paulo` (obrigatório, conforme regras de negócio)

## 2. Autenticação e Perfis (Roles)
- **Middleware (`middleware.ts`):** O controle de acesso é baseado na coluna `system_role` da tabela `user_profiles`. Não há fallback.
- **Roles existentes (`SystemRoleEnum`):**
  - `admin_total`: Acesso total ao admin.
  - `professional`: Acesso apenas ao painel do profissional.
  - `owner_admin_professional`: Superuser com acesso a ambas as áreas (bypassa a maioria das validações granulares).
- **Relacionamento Auth ↔ Operação:**
  - `auth.users(id) -> user_profiles(auth_user_id)`
  - `user_profiles(collaborator_id) -> collaborators(id)`
- **Gerente 5S configurado:** O módulo precisará de um `default_5s_manager_user_id` (que será o ID do perfil de usuário de "Fábio", sem hardcode do nome) na tabela de configurações.

## 3. Banco de Dados e Permissões (RLS)
- **RLS:** A maioria das tabelas utiliza um padrão permissivo (`FOR ALL TO authenticated USING (true)`). A autorização (RBAC) é feita a nível de aplicação nas rotas (Middleware) e Server Actions.
- **Auditoria (`audit_logs`):** A tabela já existe e é ideal para o 5S. Ela possui `entity_type`, `entity_id`, `before_data`, `after_data`, etc. A política RLS dela é apenas de `SELECT` e `INSERT` (imutável).
- **Gamificação:** **NÃO EXISTE** infraestrutura de tabelas de gamificação na base atual. As flags informadas (`gamification_phase2_enabled`) deverão ser simuladas ou adicionadas às configurações do 5S sem quebrar dependências, visto que o módulo 5S Fase 2 apenas projetará os pontos.
- **Feature Flags / Configurações:** A tabela `app_settings` centraliza configurações gerais. O módulo 5S precisará de uma tabela de configurações própria (`operational_5s_settings`) para não sobrecarregar ou alterar os dados do core financeiro da `app_settings`.
- **Uploads / Anexos:** A base não possui buckets de Storage ou tabelas dedicadas a anexos. Existem apenas campos de URL texto (ex: `avatar_url`, `image_url`). Conforme as instruções ("anexar evidência apenas se infraestrutura já existir"), o 5S usará apenas campos de texto ou URL manual, ou não terá anexo de foto nativo até que a infraestrutura seja aprovada.

## 4. Padrões de Arquitetura Reutilizáveis
- **Server Actions:** O padrão utiliza a injeção do usuário logado via `resolveUserProfileId()`.
- **Notificações:** O sistema possui a infraestrutura `push_subscriptions` e `notification_events`. As notificações automáticas de pendências do 5S podem usar essa arquitetura sem necessidade de loops ou polling (via envio direto de evento `dispatchNotification` adaptado).
- **React Query:** Utilizado extensivamente (observado nos hooks da aplicação). O módulo 5S usará SWR ou React Query a depender da biblioteca local.
- **Exportação:** Existe infraestrutura em `import-export/actions/` e `export_jobs`. Relatórios 5S podem adotar a exportação no mesmo padrão.
- **Interface Admin / Profissional:** 
  - Admin (`app/(dashboard)`): Onde o gerente validará os 5S.
  - Profissional (`app/profissional`): Onde os membros da equipe verão o status do dia e suas pendências.

## 5. Proposta de Modelagem de Dados
Para o módulo 5S operar independentemente, as seguintes tabelas serão necessárias (todas com `uuid` e idempotência baseada no `America/Sao_Paulo`):
1. `operational_5s_settings`
2. `operational_5s_templates` (versionado)
3. `operational_5s_template_items`
4. `operational_5s_daily_checklists`
5. `operational_5s_daily_answers`
6. `operational_5s_action_items` (pendências)

## 6. Decisão de Integração com Gamificação
Como exigido, o 5S calculará a **disciplina e a contribuição operacional projetada** (Camada 2) e gravará esse `score` e histórico nas próprias tabelas do módulo. Isso garante isolamento e zero impacto na Gamificação atual, comissão, finanças, ou outros cálculos imutáveis.
