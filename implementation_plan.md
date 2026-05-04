# Implementação Funcional da Área do Cliente - Portal de Agendamento

Este plano detalha a resolução da tela vazia de serviços e a implementação do fluxo real de agendamentos no Portal do Cliente, usando os dados reais do sistema e mantendo a integridade com o restante do ERP Barber Zac.

## 1. Fase 1: Diagnóstico da Tela Vazia

A tela "Escolha o serviço" aparecia vazia ("Nenhum serviço disponível...") porque **o Supabase estava retornando erro oculto na requisição, resultando em dados nulos**.

A requisição atual em `app/cliente/agendar/page.tsx` estava utilizando a relação `categories(name)`. No entanto, no banco de dados do Barber Zac, a tabela que relaciona categorias de serviço se chama `service_categories`. Como o Supabase não encontrava a Foreign Key para a tabela `categories`, a query falhava e retornava nulo.

### Relatório de Serviços do Banco de Dados:
- **Total de serviços na base**: 70
- **Serviços ativos**: 68
- **Serviços agendáveis (`is_bookable = true`)**: 68
- **Serviços com duração válida**: 62

Os dados existem e estão corretos! Apenas corrigir a query já fará o catálogo renderizar.

## User Review Required

> [!WARNING]  
> A lógica para a listagem dos profissionais na tabela `collaborators` requer que existam os campos corretos (`name`, `avatar_url`, etc). O Supabase não reconheceu o campo `nickname` da tabela no teste inicial. Usarei o campo `name` para exibir os profissionais. Você confirma essa decisão?

> [!WARNING]  
> A verificação de horários exigirá a criação do endpoint ou server action `getCustomerAvailableSlots`. Precisarei ler a documentação interna da `availability.service.ts` já iniciada para estender corretamente, verificando `agenda_settings` e `professional_working_hours`.

## Open Questions

> [!IMPORTANT]  
> Você deseja que a funcionalidade "Sem preferência" de profissional esteja ativada nesta etapa, ou exigimos obrigatoriamente a escolha de um profissional específico por enquanto? Recomendo a obrigatoriedade temporária para maior previsibilidade do slot e integridade.

## Proposed Changes

---

### Catálogo de Serviços
Corrige a requisição de serviços e atualiza a UI para o padrão solicitado.

#### [MODIFY] `app/cliente/agendar/page.tsx`
- Alterar `.select("..., categories(name)")` para `.select("..., service_categories(name)")`.
- Implementar ícones contextuais na renderização dos serviços usando os padrões propostos.
- Melhorar a UX com busca de texto client-side.
- Ao clicar em "Agendar", armazenar no estado (URL params) as opções e redirecionar para `/cliente/agendar/profissional`.

---

### Fluxo de Escolha do Profissional
Cria a tela para seleção dos profissionais (`collaborators`) para o serviço escolhido.

#### [MODIFY] `app/cliente/agendar/profissional/page.tsx`
- Adicionar query real na tabela `collaborators` filtrando os profissionais ativos.
- Adicionar UI mobile-first com Cards com foto e nome.
- Ao selecionar, avançar para a data/hora mantendo os parâmetros.

---

### Fluxo de Escolha da Data e Hora
Cria a interface para exibir calendário horizontal e os slots reais baseados na jornada.

#### [MODIFY] `app/cliente/agendar/data-hora/page.tsx`
- Construir a UI de calendário em scroll horizontal.
- Realizar polling com o Server Action `getCustomerAvailableSlots` ao selecionar um dia.
- Exibir botões grandes para horários disponíveis.

#### [MODIFY] `features/agenda/services/availability.service.ts`
- Fortalecer ou implementar a lógica para gerar slots de acordo com a `duration_minutes` do serviço.
- Deduzir horários com base nos `appointment_blocks` e nos `appointments` ativos.
- Garantir agrupamento lógico de Manhã, Tarde e Noite.

---

### Confirmação e Autenticação
Implementar a regra rigorosa: Login *apenas* se ainda não autenticado no último passo.

#### [MODIFY] `middleware.ts` / `app/cliente/agendar/confirmacao/page.tsx`
- Validar se há usuário logado; se não, redirecionar via `router.push('/cliente/login')` preservando a query string para não perder o agendamento em andamento.
- Na tela de confirmação, exibir resumo total, mostrar cliente e permitir observações.
- Chamar o Server Action real `createCustomerAppointment`.

---

### Criação do Agendamento e Interação Interna
Implementar a rotina transacional segura.

#### [MODIFY] `features/agenda/actions/agenda.actions.ts`
- Finalizar a server action de criação validando conflitos.
- Adicionar explicitamente `source = 'customer'` na inserção do Supabase.

#### [MODIFY] `features/agenda/components/AgendaMobileView.tsx`
- Assegurar que ao renderizar um evento com `source = 'customer'` ele fique com coloração distintiva (ciano/teal) e inclua as indicações visuais de "Origem: Cliente/App".

## Verification Plan

### Automated Tests
1. `npx tsc --noEmit` para garantir ausência de regressão de tipos no novo código.
2. `npx next build` para verificar estabilidade da produção.

### Manual Verification
1. Abrir `/cliente/agendar` deslogado e buscar um serviço.
2. Clicar em "Agendar" -> Avançar para o profissional -> Escolher data e ver slots baseados em jornada.
3. Escolher slot e ser direcionado ao `/cliente/login`.
4. Logar -> Ser direcionado ao check-out.
5. Confirmar -> Entrar no sistema administrativo `/agendamento` e visualizar o card do cliente em cor diferente com a label correta.
