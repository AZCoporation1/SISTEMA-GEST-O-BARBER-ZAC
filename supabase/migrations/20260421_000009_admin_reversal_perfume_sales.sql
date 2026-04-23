-- ============================================================
-- Barber Zac ERP — Migration #9
-- Admin Reversal Controls + Perfume Sales & Receivables Module
-- Date: 2026-04-21
-- STRICTLY ADDITIVE — No drops, no destructive changes
-- ============================================================

-- ============================================================
-- PART A: ADMIN REVERSAL — Additive columns on existing tables
-- ============================================================

-- A.1 professional_advances: cancellation metadata
ALTER TABLE public.professional_advances
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- A.2 professional_closures: cancellation metadata
ALTER TABLE public.professional_closures
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- A.3 cash_entries: status + reversal tracking
ALTER TABLE public.cash_entries
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS reversed_by_entry_id uuid REFERENCES public.cash_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reversal_of_entry_id uuid REFERENCES public.cash_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone;

-- ============================================================
-- PART B: PERFUME SALES MODULE
-- ============================================================

-- B.1 perfume_sales
CREATE TABLE IF NOT EXISTS public.perfume_sales (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Professional link
  professional_id uuid REFERENCES public.collaborators(id) ON DELETE RESTRICT NOT NULL,

  -- Customer link (nullable for walk-in)
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name_snapshot text NOT NULL,
  customer_phone_snapshot text,

  -- Product link
  inventory_product_id uuid REFERENCES public.inventory_products(id) ON DELETE RESTRICT NOT NULL,
  external_code_snapshot text,
  perfume_name_snapshot text NOT NULL,

  -- Sale data
  sale_date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  payment_mode text NOT NULL CHECK (payment_mode IN ('cash', 'installments')),
  installment_count integer,
  due_day integer,
  unit_price_snapshot numeric(14,2) NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  total_price numeric(14,2) NOT NULL,

  -- Commission
  commission_percent_snapshot numeric(5,2) NOT NULL DEFAULT 0,
  commission_amount_snapshot numeric(14,2) NOT NULL DEFAULT 0,

  -- Payment
  payment_method_initial text,

  -- Status
  status text NOT NULL CHECK (status IN (
    'active', 'cancelled', 'completed',
    'receivable_open', 'receivable_settled'
  )) DEFAULT 'active',

  -- Linked records
  linked_cash_entry_id uuid REFERENCES public.cash_entries(id) ON DELETE SET NULL,
  linked_financial_movement_id uuid REFERENCES public.financial_movements(id) ON DELETE SET NULL,
  stock_movement_id uuid REFERENCES public.stock_movements(id) ON DELETE SET NULL,

  -- Cancellation/reversal
  cancelled_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  cancelled_at timestamp with time zone,
  cancellation_reason text,

  -- Metadata
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_perfume_sales_professional ON public.perfume_sales(professional_id);
CREATE INDEX IF NOT EXISTS idx_perfume_sales_customer ON public.perfume_sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_perfume_sales_product ON public.perfume_sales(inventory_product_id);
CREATE INDEX IF NOT EXISTS idx_perfume_sales_date ON public.perfume_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_perfume_sales_status ON public.perfume_sales(status);

-- B.2 perfume_sale_installments
CREATE TABLE IF NOT EXISTS public.perfume_sale_installments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  perfume_sale_id uuid REFERENCES public.perfume_sales(id) ON DELETE RESTRICT NOT NULL,
  installment_number integer NOT NULL,
  due_date date NOT NULL,
  amount numeric(14,2) NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'paid', 'overdue', 'cancelled')) DEFAULT 'open',
  paid_at timestamp with time zone,
  paid_method text,
  cash_entry_id uuid REFERENCES public.cash_entries(id) ON DELETE SET NULL,
  financial_movement_id uuid REFERENCES public.financial_movements(id) ON DELETE SET NULL,

  -- Cancellation
  cancelled_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  cancelled_at timestamp with time zone,
  cancellation_reason text,

  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_perfume_installments_sale ON public.perfume_sale_installments(perfume_sale_id);
CREATE INDEX IF NOT EXISTS idx_perfume_installments_due ON public.perfume_sale_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_perfume_installments_status ON public.perfume_sale_installments(status);

-- B.3 Triggers for updated_at
CREATE TRIGGER update_perfume_sales_modtime
  BEFORE UPDATE ON public.perfume_sales
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_perfume_installments_modtime
  BEFORE UPDATE ON public.perfume_sale_installments
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- B.4 RLS — same pattern (authenticated = full access)
ALTER TABLE public.perfume_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfume_sale_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all actions for authenticated users"
  ON public.perfume_sales FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all actions for authenticated users"
  ON public.perfume_sale_installments FOR ALL TO authenticated USING (true);

-- End of Migration
