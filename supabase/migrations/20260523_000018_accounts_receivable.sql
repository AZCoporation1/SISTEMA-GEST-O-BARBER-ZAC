-- ============================================================
-- Migration: Accounts Receivable (Vendas Parceladas + A Receber)
-- Date: 2026-05-23
-- Purpose: Add installment/credit sales with receivables tracking
-- NON-DESTRUCTIVE: Only ADD tables and ALTER existing ones
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. ALTER TABLE sales — Add payment tracking fields
--    Default values ensure ALL existing sales remain valid
-- ──────────────────────────────────────────────────────────────

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'paid'
    CHECK (payment_status IN ('paid', 'partially_paid', 'receivable', 'cancelled')),
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'upfront'
    CHECK (payment_mode IN ('upfront', 'installment', 'mixed')),
  ADD COLUMN IF NOT EXISTS receivable_total numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS upfront_amount numeric(14,2) NOT NULL DEFAULT 0;

-- ──────────────────────────────────────────────────────────────
-- 2. accounts_receivable — Individual installments / parcelas
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.accounts_receivable (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Linkage
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name_snapshot text,
  customer_phone_snapshot text,
  professional_id uuid REFERENCES public.collaborators(id) ON DELETE SET NULL,

  -- Classification
  source_type text NOT NULL DEFAULT 'sale'
    CHECK (source_type IN ('sale', 'manual', 'reception', 'subscription')),
  payment_origin text NOT NULL DEFAULT 'store_credit'
    CHECK (payment_origin IN ('credit_card_installment', 'store_credit', 'mixed_payment')),

  -- Installment info
  installment_number integer NOT NULL DEFAULT 1,
  total_installments integer NOT NULL DEFAULT 1,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  amount_paid numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  due_date date NOT NULL,

  -- Status
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'partial', 'paid', 'overdue', 'cancelled', 'reversed')),

  -- Description & notes
  description text NOT NULL DEFAULT '',
  notes text,

  -- Financial linkage (filled when payment is received)
  cash_entry_id uuid,
  financial_movement_id uuid,

  -- Audit fields
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  paid_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  paid_at timestamptz,
  cancelled_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  cancellation_reason text,

  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ar_sale_id ON public.accounts_receivable(sale_id);
CREATE INDEX IF NOT EXISTS idx_ar_customer_id ON public.accounts_receivable(customer_id);
CREATE INDEX IF NOT EXISTS idx_ar_status ON public.accounts_receivable(status);
CREATE INDEX IF NOT EXISTS idx_ar_due_date ON public.accounts_receivable(due_date);
CREATE INDEX IF NOT EXISTS idx_ar_professional_id ON public.accounts_receivable(professional_id);

-- Auto-update updated_at
CREATE TRIGGER update_accounts_receivable_modtime
  BEFORE UPDATE ON public.accounts_receivable
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ──────────────────────────────────────────────────────────────
-- 3. accounts_receivable_payments — Payment receipts per installment
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.accounts_receivable_payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  receivable_id uuid REFERENCES public.accounts_receivable(id) ON DELETE CASCADE NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL
    CHECK (payment_method IN ('dinheiro', 'pix', 'debit_card', 'credit_card')),

  paid_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Financial linkage
  cash_entry_id uuid,
  financial_movement_id uuid,

  -- Audit
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  notes text,

  -- Status & reversal
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'reversed')),
  reversed_at timestamptz,
  reversed_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reversal_reason text,

  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_arp_receivable_id ON public.accounts_receivable_payments(receivable_id);

-- ──────────────────────────────────────────────────────────────
-- 4. RLS — Same pattern as rest of the ERP (authenticated users)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_receivable_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_accounts_receivable" ON public.accounts_receivable
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_all_ar_payments" ON public.accounts_receivable_payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- End of migration
