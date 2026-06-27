# Módulo 5S Operacional — Smoke Test de Produção (Vercel)

Este documento detalha o que deve ser conferido manualmente no ambiente de produção após o merge da branch `feat/5s-presentation-shell` na `main`.

## 1. Sidebar e Menus
- [ ] O menu "Gamificação" deve estar visível e abaixo de "Fluxo de Caixa / Custos" para administradores.
- [ ] O menu "5S Operacional" deve estar visível imediatamente abaixo de "Gamificação" para administradores.
- [ ] Acessando como "Profissional", no menu do app mobile/desktop, o item "Meu 5S" deve estar visível na sidebar de profissionais.

## 2. Bloqueios e Read-Only States
- [ ] Acessar `/5s-operacional`. A página deve carregar o Dashboard de Visão Geral com cards marcando "Aguardando ativação operacional".
- [ ] Todos os botões em `/5s-operacional` (ex: Iniciar Abertura) devem estar desabilitados e, ao passar o mouse, exibir tooltip "Ação disponível após a ativação segura do banco 5S."
- [ ] Acessar `/5s-operacional/checklist`. Deve exibir 3 colunas (Abertura, Durante o Dia, Fechamento) com 7 itens cada, todos em status "Pendente" e checkboxes não clicáveis.
- [ ] Acessar `/5s-operacional/configuracoes`. Os campos de Gerente, Lembretes e Multiplicador devem carregar com os valores padrão e estar totalmente desabilitados (`disabled`). O botão "Salvar Configurações" deve estar desabilitado.
- [ ] Acessar `/profissional/5s` logado como profissional. Deve apresentar um estado vazio ("Ainda não há resultados disponíveis").

## 3. Segurança (RBAC Local)
- [ ] Tentativa de acesso manual: Um Profissional tentando acessar `/5s-operacional` deve ser redirecionado para a home do profissional pelo middleware.
- [ ] Acessar a aplicação: Não deve haver nenhum erro de console ou erro 500 no carregamento do layout devido à ausência de tabelas no Supabase (pois toda a UI deve ser puramente baseada em estados estáticos nesta versão).
