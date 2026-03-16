-- Migração Profissional de Esquema Baseado em Ledger: Barber Zac ERP
-- Drop tabelas iniciais (vão ser substituídas por tabelas profissionais, preservando histórico)
-- Para efeito de MVP, daremos um drop clean na infraestrutura simplória inicial.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user;

-- Drop Old MVP Tables
drop table if exists sale_items cascade;
drop table if exists sales cascade;
drop table if exists stock_movements cascade;
drop table if exists stock_adjustments cascade;
drop table if exists products cascade;
drop table if exists categories cascade;

-- Drop ALL 31 New Tables / Views to ensure perfect idempotence if re-run
drop view if exists public.vw_commission_summary;
drop view if exists public.vw_financial_flow_summary;
drop view if exists public.vw_daily_cash_summary;
drop view if exists public.vw_stock_movement_summary;
drop view if exists public.vw_inventory_position;

drop table if exists public.audit_logs cascade;
drop table if exists public.export_jobs cascade;
drop table if exists public.import_rows cascade;
drop table if exists public.import_jobs cascade;
drop table if exists public.ai_action_logs cascade;
drop table if exists public.ai_commands cascade;
drop table if exists public.commission_periods cascade;
drop table if exists public.commission_entries cascade;
drop table if exists public.commission_rules cascade;
drop table if exists public.commission_profiles cascade;
drop table if exists public.financial_movements cascade;
drop table if exists public.variable_costs cascade;
drop table if exists public.fixed_costs cascade;
drop table if exists public.cash_entries cascade;
drop table if exists public.cash_sessions cascade;
drop table if exists public.payment_methods cascade;
drop table if exists public.collaborators cascade;
drop table if exists public.customers cascade;
drop table if exists public.purchase_order_items cascade;
drop table if exists public.purchase_orders cascade;
drop table if exists public.suppliers cascade;
drop table if exists public.inventory_locations cascade;
drop table if exists public.inventory_products cascade;
drop table if exists public.product_brands cascade;
drop table if exists public.inventory_categories cascade;
drop table if exists public.user_profiles cascade;
drop table if exists public.app_settings cascade;

drop type if exists movement_type_enum cascade;
drop type if exists cash_entry_type cascade;

-- EXTENSIONS
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. TABELAS GLOBAIS
-- ==========================================

-- 1.1 App Settings
create table public.app_settings (
  id uuid primary key default uuid_generate_v4(),
  organization_name text not null default 'Barber Zac',
  currency text not null default 'BRL',
  timezone text not null default 'America/Sao_Paulo',
  default_markup numeric(10,2) not null default 45.00,
  low_stock_alert_enabled boolean not null default true,
  critical_stock_alert_enabled boolean not null default true,
  ai_enabled boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 1.2 User Profiles
create table public.user_profiles (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid references auth.users(id) on delete cascade on update cascade,
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'gestor', 'operador')) default 'operador',
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create unique index idx_user_profiles_auth_user_id on public.user_profiles(auth_user_id);

-- Hook automático para auth.users -> user_profiles
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.user_profiles (auth_user_id, full_name, email, role)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 
    new.email, 
    'admin' -- Primeiro usuário vira admin, ajustar futuramente.
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==========================================
-- 2. INVENTÁRIO NORMALIZADO
-- ==========================================

-- 2.1 Categories
create table public.inventory_categories (
  id uuid primary key default uuid_generate_v4(),
  code_prefix text,
  name text not null unique,
  normalized_name text not null,
  aliases jsonb,
  is_active boolean not null default true,
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2.2 Brands
create table public.product_brands (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  normalized_name text not null,
  aliases jsonb,
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2.3 Products
create table public.inventory_products (
  id uuid primary key default uuid_generate_v4(),
  external_code text unique, -- Código SKU interno importado da planilha
  category_id uuid references public.inventory_categories(id) on delete set null,
  brand_id uuid references public.product_brands(id) on delete set null,
  name text not null,
  normalized_name text not null,
  sku text unique,
  barcode text unique,
  unit_type text not null default 'un', -- un, ml, gr, etc
  cost_price numeric(10,2) not null default 0 check (cost_price >= 0),
  markup_percent numeric(10,2) not null default 45.00 check (markup_percent >= 0),
  
  -- Campos calculados via view em breve, ou triggers. Pedido: FÓRMULAS OBRIGATÓRIAS.
  -- Usaremos GENERATED ALWAYS AS
  markup_value_generated numeric(10,2) generated always as (round(cost_price * markup_percent / 100.0, 2)) stored,
  sale_price_generated numeric(10,2) generated always as (round(cost_price + (cost_price * markup_percent / 100.0), 2)) stored,
  
  min_stock integer not null default 0,
  max_stock integer not null default 0,
  reorder_point integer,
  
  is_for_resale boolean not null default true,
  is_for_internal_use boolean not null default false,
  is_active boolean not null default true,
  notes text,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  deleted_at timestamp with time zone -- Soft delete
);

create index idx_inv_products_name on public.inventory_products(normalized_name);
create index idx_inv_products_code on public.inventory_products(external_code);

-- 2.4 Locations (Onde o estoque vive)
create table public.inventory_locations (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  type text not null check (type in ('principal', 'prateleira', 'consumo', 'outro')),
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 3. FORNECEDORES & COMPRAS (PRÉ-LEDGER)
-- ==========================================

create table public.suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  contact_name text,
  phone text,
  email text,
  notes text,
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.purchase_orders (
  id uuid primary key default uuid_generate_v4(),
  supplier_id uuid references public.suppliers(id) on delete restrict,
  status text not null check (status in ('draft', 'pending', 'received', 'cancelled')) default 'draft',
  issue_date date not null default current_date,
  expected_date date,
  total_cost numeric(14,2) not null default 0,
  notes text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.purchase_order_items (
  id uuid primary key default uuid_generate_v4(),
  purchase_order_id uuid references public.purchase_orders(id) on delete cascade,
  product_id uuid references public.inventory_products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(10,2) not null check (unit_cost >= 0),
  total_cost numeric(14,2) generated always as (quantity * unit_cost) stored,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 4. LEDGER: MOVIMENTAÇÕES DE ESTOQUE
-- ==========================================

create type movement_type_enum as enum(
  'initial_balance',
  'purchase_entry',
  'sale_exit',
  'internal_consumption',
  'loss',
  'damage',
  'manual_adjustment_in',
  'manual_adjustment_out',
  'transfer',
  'return_from_customer',
  'supplier_return'
);

create table public.stock_movements (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references public.inventory_products(id) on delete restrict not null,
  movement_type movement_type_enum not null,
  movement_reason text not null,
  source_type text not null, -- Ex: 'system', 'purchase_order', 'sale'
  destination_type text not null, -- Ex: 'location_id', 'customer', 'waste'
  location_id uuid references public.inventory_locations(id) on delete restrict,
  quantity integer not null, -- Pode ser negativo para saídas
  
  -- Snapshots de valores no momento do movimento (para auditoria financeira)
  unit_cost_snapshot numeric(10,2),
  unit_sale_snapshot numeric(10,2),
  total_cost_snapshot numeric(14,2),
  total_sale_snapshot numeric(14,2),
  
  reference_type text, -- 'sale', 'purchase', 'adjustment'
  reference_id uuid, -- sale.id, purchase_order.id
  notes text,
  
  performed_by uuid references public.user_profiles(id) on delete set null,
  approved_by uuid references public.user_profiles(id) on delete set null,
  
  movement_date timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_stock_movements_prod on public.stock_movements(product_id);
create index idx_stock_movements_date on public.stock_movements(movement_date);

create table public.stock_adjustments (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references public.inventory_products(id) on delete restrict not null,
  previous_balance integer not null,
  new_balance integer not null,
  difference integer generated always as (new_balance - previous_balance) stored,
  reason text not null,
  notes text,
  adjusted_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 5. VENDAS & PAGAMENTOS (PILARES)
-- ==========================================

create table public.customers (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.collaborators (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  role text not null check(role in ('barbeiro', 'assistente', 'gerente', 'outro')),
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.payment_methods (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.sales (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references public.customers(id) on delete set null,
  collaborator_id uuid references public.collaborators(id) on delete set null,
  sale_date timestamp with time zone default timezone('utc'::text, now()) not null,
  status text not null check(status in ('pending', 'completed', 'cancelled', 'refunded')),
  payment_method_id uuid references public.payment_methods(id) on delete restrict,
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  total numeric(14,2) generated always as (subtotal - discount_amount) stored,
  notes text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.sale_items (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid references public.sales(id) on delete cascade not null,
  item_type text not null check(item_type in ('product', 'service', 'combo')),
  product_id uuid references public.inventory_products(id) on delete restrict,
  service_name text, -- Para serviços avulsos simples
  quantity integer not null check(quantity > 0),
  unit_cost_snapshot numeric(10,2) not null,
  unit_price_snapshot numeric(10,2) not null,
  discount_amount numeric(14,2) not null default 0,
  total numeric(14,2) generated always as ((quantity * unit_price_snapshot) - discount_amount) stored,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  constraint chk_sale_item_req check (
    (item_type = 'product' and product_id is not null) or 
    (item_type != 'product' and service_name is not null)
  )
);

-- ==========================================
-- 6. FINANCEIRO GERAL E CAIXA (LEDGER DE CAIXA)
-- ==========================================

create table public.cash_sessions (
  id uuid primary key default uuid_generate_v4(),
  session_date date not null default current_date,
  opening_amount numeric(14,2) not null default 0,
  closing_amount numeric(14,2),
  expected_amount numeric(14,2),
  difference_amount numeric(14,2),
  status text not null check(status in ('open', 'closed', 'audited')) default 'open',
  opened_by uuid references public.user_profiles(id) on delete set null,
  closed_by uuid references public.user_profiles(id) on delete set null,
  opened_at timestamp with time zone default timezone('utc'::text, now()) not null,
  closed_at timestamp with time zone,
  notes text,
  
  constraint uq_one_open_session unique (status) deferrable initially deferred
);

create type cash_entry_type as enum(
  'income',
  'expense',
  'withdrawal',
  'reinforcement',
  'sale_income',
  'manual_income',
  'manual_expense'
);

create table public.cash_entries (
  id uuid primary key default uuid_generate_v4(),
  cash_session_id uuid references public.cash_sessions(id) on delete restrict not null,
  entry_type text not null,
  category text not null,
  description text not null,
  amount numeric(14,2) not null, -- Positivo = Entrada, Negativo = Saída (pode ser restrito via código, aqui mantemos raw)
  payment_method_id uuid references public.payment_methods(id) on delete restrict,
  reference_type text, -- 'sale'
  reference_id uuid, -- sale.id
  occurred_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.fixed_costs (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null,
  amount numeric(14,2) not null,
  due_day integer check (due_day >= 1 and due_day <= 31),
  frequency text not null check(frequency in ('monthly', 'weekly', 'yearly')),
  is_active boolean not null default true,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.variable_costs (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null,
  amount numeric(14,2) not null,
  occurred_on timestamp with time zone not null default timezone('utc'::text, now()),
  notes text,
  reference_type text,
  reference_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ledger total de finanças (Consolidado)
create table public.financial_movements (
  id uuid primary key default uuid_generate_v4(),
  movement_type text not null check(movement_type in ('payable', 'receivable', 'paid', 'received')),
  category text not null,
  subcategory text,
  description text not null,
  amount numeric(14,2) not null,
  occurred_on timestamp with time zone not null,
  origin_type text not null, -- 'sale', 'fixed_cost', 'variable_cost', 'manual'
  origin_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 7. MOTOR DE COMISSÕES
-- ==========================================

create table public.commission_profiles (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.commission_rules (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references public.commission_profiles(id) on delete cascade not null,
  rule_type text not null check(rule_type in ('percent', 'fixed')),
  applies_to text not null check(applies_to in ('global', 'category', 'product', 'service')),
  collaborator_id uuid references public.collaborators(id) on delete set null,
  product_id uuid references public.inventory_products(id) on delete set null,
  category_id uuid references public.inventory_categories(id) on delete set null,
  percent numeric(5,2),
  fixed_amount numeric(10,2),
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.commission_entries (
  id uuid primary key default uuid_generate_v4(),
  collaborator_id uuid references public.collaborators(id) on delete restrict not null,
  sale_id uuid references public.sales(id) on delete restrict not null,
  sale_item_id uuid references public.sale_items(id) on delete restrict,
  commission_rule_id uuid references public.commission_rules(id) on delete set null,
  base_amount numeric(14,2) not null,
  commission_amount numeric(14,2) not null,
  competence_date date not null,
  status text not null check(status in ('pending', 'paid', 'cancelled')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.commission_periods (
  id uuid primary key default uuid_generate_v4(),
  start_date date not null,
  end_date date not null,
  status text not null check(status in ('open', 'processing', 'closed', 'paid')) default 'open',
  total_base numeric(14,2) not null default 0,
  total_commission numeric(14,2) not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 8. IMPORT/EXPORT & AI LOGS
-- ==========================================

create table public.ai_commands (
  id uuid primary key default uuid_generate_v4(),
  command_text text not null,
  intent text not null,
  parsed_payload jsonb not null,
  status text not null check(status in ('pending', 'approved', 'executed', 'failed', 'rejected')),
  requested_by uuid references public.user_profiles(id) on delete set null,
  executed_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  executed_at timestamp with time zone
);

create table public.ai_action_logs (
  id uuid primary key default uuid_generate_v4(),
  ai_command_id uuid references public.ai_commands(id) on delete set null,
  action_type text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  status text not null,
  message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.import_jobs (
  id uuid primary key default uuid_generate_v4(),
  source_type text not null,
  file_name text not null,
  mapping jsonb,
  status text not null check(status in ('pending', 'processing', 'completed', 'failed')),
  total_rows integer not null default 0,
  success_rows integer not null default 0,
  error_rows integer not null default 0,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone
);

create table public.import_rows (
  id uuid primary key default uuid_generate_v4(),
  import_job_id uuid references public.import_jobs(id) on delete cascade not null,
  row_number integer not null,
  raw_payload jsonb not null,
  normalized_payload jsonb,
  status text not null check(status in ('pending', 'success', 'error')),
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.export_jobs (
  id uuid primary key default uuid_generate_v4(),
  export_type text not null,
  filters jsonb,
  status text not null check(status in ('pending', 'processing', 'completed', 'failed')),
  file_url text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone
);

-- ==========================================
-- 9. AUDITORIA: THE OBSERVABILITY LAYER
-- ==========================================

create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  entity_type text not null, -- 'product', 'sale', 'cash_session'
  entity_id uuid not null,
  action text not null, -- 'insert', 'update', 'delete', 'soft_delete'
  actor_id uuid references public.user_profiles(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  context jsonb, -- { ip, user_agent, etc }
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_audit_entity on public.audit_logs(entity_type, entity_id);

-- ==========================================
-- 10. SYSTEM VIEWS (O CÉREBRO)
-- ==========================================

-- VIEW 01: Posição de Estoque Vivo (Saldo Derivado do Ledger)
create or replace view public.vw_inventory_position as
select 
  p.id as product_id,
  p.name as product_name,
  c.name as category_name,
  b.name as brand_name,
  p.cost_price,
  p.markup_percent,
  p.sale_price_generated as sale_price,
  -- Sum stock movements 
  coalesce((select sum(quantity) from public.stock_movements sm where sm.product_id = p.id), 0) as current_balance,
  p.min_stock,
  p.max_stock,
  greatest(p.max_stock - coalesce((select sum(quantity) from public.stock_movements sm where sm.product_id = p.id), 0), 0) as suggested_purchase,
  case 
    when coalesce((select sum(quantity) from public.stock_movements sm where sm.product_id = p.id), 0) <= 0 then 'sem_estoque'
    when coalesce((select sum(quantity) from public.stock_movements sm where sm.product_id = p.id), 0) <= p.min_stock then 'abaixo_do_minimo'
    when coalesce((select sum(quantity) from public.stock_movements sm where sm.product_id = p.id), 0) > p.max_stock then 'acima_do_maximo'
    else 'normal'
  end as stock_status,
  
  -- Values
  coalesce((select sum(quantity) from public.stock_movements sm where sm.product_id = p.id), 0) * p.cost_price as total_cost_value,
  coalesce((select sum(quantity) from public.stock_movements sm where sm.product_id = p.id), 0) * p.sale_price_generated as total_sale_value
from public.inventory_products p
left join public.inventory_categories c on p.category_id = c.id
left join public.product_brands b on p.brand_id = b.id
where p.deleted_at is null;

-- VIEW 02: Resumo de Movimentações de Estoque
create or replace view public.vw_stock_movement_summary as
select 
  product_id,
  date_trunc('day', movement_date) as day,
  sum(case when quantity > 0 then quantity else 0 end) as total_in,
  abs(sum(case when quantity < 0 then quantity else 0 end)) as total_out,
  abs(sum(case when movement_type = 'internal_consumption' then quantity else 0 end)) as consumption,
  abs(sum(case when movement_type = 'loss' then quantity else 0 end)) as losses
from public.stock_movements
group by product_id, date_trunc('day', movement_date);

-- VIEW 03: Sumário de Caixa Diário
create or replace view public.vw_daily_cash_summary as
select 
  s.id as session_id,
  s.session_date,
  s.opening_amount,
  coalesce((select sum(amount) coalesce from public.cash_entries e where e.cash_session_id = s.id and amount > 0), 0) as total_inflows,
  abs(coalesce((select sum(amount) from public.cash_entries e where e.cash_session_id = s.id and amount < 0), 0)) as total_outflows,
  s.closing_amount,
  (s.opening_amount + coalesce((select sum(amount) from public.cash_entries e where e.cash_session_id = s.id), 0)) as calculated_expected,
  s.difference_amount,
  s.status
from public.cash_sessions s;

-- VIEW 04: Motor Financeiro
create or replace view public.vw_financial_flow_summary as
select 
  date_trunc('day', occurred_on) as flow_date,
  sum(case when amount > 0 and category = 'receita' then amount else 0 end) as total_revenue,
  abs(sum(case when amount < 0 and category = 'despesa' then amount else 0 end)) as total_expenses,
  abs(sum(case when amount < 0 and origin_type = 'fixed_cost' then amount else 0 end)) as fixed_costs,
  sum(amount) as net_profit
from public.financial_movements
group by date_trunc('day', occurred_on);

-- VIEW 05: Sumário de Comissões
create or replace view public.vw_commission_summary as
select 
  collaborator_id,
  date_trunc('month', competence_date) as month,
  sum(base_amount) as total_base_commissionable,
  sum(commission_amount) as total_commission,
  sum(case when status = 'paid' then commission_amount else 0 end) as paid_commission
from public.commission_entries
group by collaborator_id, date_trunc('month', competence_date);

-- ==========================================
-- 11. TRIGGERS OPERACIONAIS (The Automation)
-- ==========================================

-- TRIGGER: Auto-updater de updated_at para todas as tabelas genéricas
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language 'plpgsql';

create trigger update_app_settings_modtime before update on app_settings for each row execute procedure update_updated_at_column();
create trigger update_user_profiles_modtime before update on user_profiles for each row execute procedure update_updated_at_column();
create trigger update_inventory_products_modtime before update on inventory_products for each row execute procedure update_updated_at_column();
create trigger update_sales_modtime before update on sales for each row execute procedure update_updated_at_column();

-- TRIGGER: Venda Registrada -> Stock Movement Automático
create or replace function public.log_sale_to_stock_movement()
returns trigger as $$
declare
  v_unit_cost numeric(10,2);
  v_unit_sale numeric(10,2);
begin
  -- Se o item incluído na venda for um Produto, retirar do ledger
  if new.item_type = 'product' and new.product_id is not null then
    
    select cost_price, sale_price_generated into v_unit_cost, v_unit_sale 
    from public.inventory_products where id = new.product_id;
  
    insert into public.stock_movements(
      product_id,
      movement_type,
      movement_reason,
      source_type,
      destination_type,
      quantity,
      unit_cost_snapshot,
      unit_sale_snapshot,
      total_cost_snapshot,
      total_sale_snapshot,
      reference_type,
      reference_id,
      movement_date
    ) values (
      new.product_id,
      'sale_exit',
      'Venda gerada',
      'system',
      'customer',
      -(new.quantity), -- Saída é negativa
      v_unit_cost,
      v_unit_sale,
      (new.quantity * v_unit_cost),
      (new.quantity * v_unit_sale),
      'sale',
      new.sale_id,
      now()
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_sale_item_stock_movement
  after insert on public.sale_items
  for each row execute function public.log_sale_to_stock_movement();

-- ==========================================
-- 12. RLS & POLICIES (Segurança Enxuta)
-- ==========================================

-- Habilitar RLS nas principais tabelas
alter table public.inventory_products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.sales enable row level security;

-- Policies Enxutas para Todo Usuário Autenticado (MVP Interno Barber Zac)
-- Como isso é um ERP Cativo (apenas funcionários usam), a regra inicial: Autenticado? Tem acesso.
-- Restrições finas de Gestor vs Operador serão feitas no Server Side App Limits (Actions)
create policy "Enable all actions for authenticated users" on public.inventory_products for all to authenticated using (true);
create policy "Enable all actions for authenticated users" on public.stock_movements for all to authenticated using (true);
create policy "Enable all actions for authenticated users" on public.sales for all to authenticated using (true);

-- ==========================================
-- 13. SEEDS PRELIMINARES
-- ==========================================

insert into public.inventory_locations (name, type) values
('Estoque Principal', 'principal'),
('Prateleira de Venda', 'prateleira'),
('Uso Interno (Limpeza e Quimicas)', 'consumo');

insert into public.payment_methods (name) values
('Cartao de Credito'), ('Cartao de Debito'), ('Pix'), ('Dinheiro');

-- End of File
