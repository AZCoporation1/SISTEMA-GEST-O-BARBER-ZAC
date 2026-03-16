# Sistema de Gestão Barber Zac ✂️

ERP Administrativo e Operacional premium desenvolvido para controle total da Barber Zac. 
Um sistema robusto focado na usabilidade, velocidade de caixa, rastreabilidade máxima e automação através da IA Assistente.

## 🎯 Visão do Sistema
Este não é apenas um "PDV", mas um **ERP focado na realidade de uma Barbearia de alto padrão**.
Cada movimentação no estoque gera um rastro contábil de auditoria. Cada venda deduz o estoque em tempo real e consolida o Caixa e o Fluxo Financeiro, garantindo que o Custo Fixo e Variável cruzem perfeitamente com o Faturamento, culminando no cálculo exato das Comissões dos colaboradores.

## 🛠️ Stack Tecnológico
- **Frontend/Framework**: Next.js 16 (App Router) + React 19
- **Estilização**: Tailwind CSS + Shadcn UI + Framer Motion (para UI premium)
- **Gerenciamento de Estado**: Zustand + Tanstack Query
- **Validação de Dados**: Zod & React Hook Form
- **Inteligência Artificial**: OpenAI (GPT-4o API)
- **Banco de Dados & Auth**: Supabase (PostgreSQL) com RLS completo
- **Testes**: Vitest

## 📦 Módulos Principais
1. **Estoque e Inventário**: Cadastro de produtos categorizados, controle de mínimos/máximos, cálculo automático de Markup e lucro.
2. **Movimentações (Ledger)**: Histórico imutável de entradas, ajustes, perdas e retornos de fornecedores.
3. **Vendas (Frente de Caixa)**: Lançamento expresso de comanda e baixa do estoque na mesma transação.
4. **Caixa Físico**: Abertura, suprimento, sangria e conferência cega do operador (`Expected vs Actual`).
5. **Fluxo de Caixa (Dashboard)**: Aglutinador financeiro mensal extraindo receita líquida contra custos fixos operacionais.
6. **Gestão de Custos**: Módulo simplificado para listar contas recorrentes e compras pontuais de abastecimento.
7. **Motor de Comissões**: Criação de regras (Percentual ou Fixo) atreladas à Vendas globais ou atreladas a uma Categoria.
8. **Relatórios**: Dashboards visuais e relatórios estratégicos extraídos em tempo real através das Database Views.
9. **Importação e Exportação**: Módulo inteligente capaz de sugar planilhas legadas (`.xlsx`/`.csv`) ou interpretar NFTs (Textos OCR via `.pdf`) e tabular massivamente. Pode exportar qualquer View do sistema para planilhas limpas.
10. **Operador IA**: Módulo interpretativo integrado. Basta abrir a barra "Ctrl+K" ou o Assitente Flutuante e pedir na linguagem natural.

## 🚀 Setup Local

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure suas Variáveis de Ambiente criando um `.env.local`:
   (Veja a seção abaixo para copiar o template e trocar pelas chaves originais).

3. Inicie o servidor:
   ```bash
   npm run dev
   ```
   Acesse a URL gerada (geralmente `http://localhost:3000`).

## 🔐 Variáveis de Ambiente
Crie um arquivo `.env.local` na raiz com as chaves abaixo (substitua os valores com os dados reais de acesso via Console da Vercel ou Supabase):

```env
# Banco de Dados & RLS do Frontend
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Para o Next.js gerenciar as funções administrativas seguras na camada Server Action
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Motor de Inteligência Operacional
OPENAI_API_KEY=your_openai_api_key
```

## 🗃️ Modelagem do Banco (Supabase Ledger Pattern)
O ERP roda sob o princípio de "Ledger Financeiro":
- Nunca damos um leve "UPDATE saldo = saldo - 1".
- A modelagem insere linhas em `stock_movements`.
- O saldo em tempo real provém da super-view `vw_inventory_position` agregada via SQL `SUM()`. O Supabase consolida isso eficientemente via Indexes escaláveis.
- O histórico não é perdido, nem pode ser manipulado pela exclusão do produto, porque geramos um Soft-Delete nas regras da FK do Supabase se existirem ligações no passado.

## 🔁 Fluxos Principais
- **Baixa de Estoque por Venda**: Emite a venda (`sales` -> `sale_items`) -> Uma trigger emite no banco o respectivo registro em `stock_movements` subtraindo a quantia, marcando source='sale' com snapshot no Custo da Venda do dia atual.
- **Fechamento de Caixa Corrigido do Diferenças**: Quando o Barbeiro clica em Fechar, ele preenche apenas o "valor da gaveta" que conta naquele instante. O ERP cruza isso contra o `Opening Balance + Cash_Entries_Sum` resultando no campo de Auditoria de Desvios perfeitamente imutável para a gerência.
- **Alocação Rápida de Comissão**: Um produto categorizado como "Serviço Corte" pode ter a regra de dar 50% de comissão ao Operador X. A Venda detecta isso e agenda a comissão na tabela `commission_entries`. Na virada de mês, a tabela `commission_periods` transaciona e abate tudo pago.

## 📥 Importação e Exportação OCR/CSV/XLSX
- O sistema reconhece ativamente extensões vindas das versões legadas da barbearia.
- A IA extrai e limpa cifrões, moedas esquisitas ou espaços que flutuem na formatação de tabela de CSVs.
- Todos os grids da solução (`/estoque`, `/relatorio`, etc) têm suporte via Client Component à exportação PDF visual contendo o logo e fontes exclusivas da marca gerada via `jspdf-autotable`.

## 🤖 Uso da Inteligência Artificial (Operador Assistente)
O Módulo IA funciona consumindo o `GPT-4o`.
- **Prevenção Agressiva (Anomalia)**: O script mapeia Diariamente "Produtos Críticos" ou Produtos "Sem Custo de Compra Aplicado" via SQL View local para que a IA te alerte sempre que vir que a tesão de reposição quebrou.
- **Data Mutation Limitada**: A IA formata para si um payload restrito baseado nas views que tem. E constrói o JSON. Mas a camada do Next.js bloqueia todas requisições pedindo o Preview via Dialog `AiPreviewDialog.tsx`. O usuário só acata quando as ações mapeadas aparecem claras, protegendo transações com banco e gerando Logs Auditáveis.

## 🌐 Deploy Completo (Vercel)
O ERP está otimizado estritamente para subir limpo na **Vercel**:
- Possui SSR protegido e ações servidas. Bibliotecas nativas sem fallback Web como `pdfjs-dist` carregam async logicamente sem corromper builds estáticos (`await import('...')`).
- Vá em Vercel, conecte seu Github apontando para este projeto.
- Insira as Variáveis da fase anterior na Engine UI da Vercel.
- Faça o Deploy!

## 🛣️ Próximos Passos (Evolução)
- Ativar agendamento visual calendarizado (Página Placeholder criada) para a interface do cliente ligar ao operador.
- Ampliar os modelos de Relatórios adicionando Gráficos de Crescimento Mensal sobrepostos com Recharts nativo da UI atual.
- Atrelar uma conta PagBank para puxar APIs diretas de recebimento físico / split de comissão fiscal.
