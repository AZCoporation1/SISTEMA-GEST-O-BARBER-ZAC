-- ============================================================
-- Barber Zac ERP — Reception Module Migration
-- Migration: 20260520_000016_reception_module.sql
-- 
-- ADDITIVE ONLY — does NOT modify any existing tables.
-- Creates: reception_staff, reception_closures, reception_advances
-- 
-- Order: staff → closures → advances (FK dependency safe)
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. RECEPTION STAFF
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.reception_staff (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_profile_id uuid UNIQUE REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  display_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  base_salary_per_period numeric(14,2),
  settlement_primary_day integer CHECK (settlement_primary_day >= 1 AND settlement_primary_day <= 31),
  settlement_secondary_day integer CHECK (settlement_secondary_day >= 1 AND settlement_secondary_day <= 31),
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reception_staff_active ON public.reception_staff(is_active);
CREATE INDEX IF NOT EXISTS idx_reception_staff_user_profile ON public.reception_staff(user_profile_id);

-- Auto-update updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_reception_staff_modtime'
  ) THEN
    CREATE TRIGGER update_reception_staff_modtime
      BEFORE UPDATE ON public.reception_staff
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- 2. RECEPTION CLOSURES (created BEFORE advances for FK safety)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.reception_closures (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id uuid NOT NULL REFERENCES public.reception_staff(id) ON DELETE RESTRICT,
  period_start date NOT NULL,
  period_end date NOT NULL,
  salary_amount numeric(14,2) NOT NULL DEFAULT 0,
  advances_total numeric(14,2) NOT NULL DEFAULT 0,
  adjustments_total numeric(14,2) NOT NULL DEFAULT 0,
  net_payable numeric(14,2) NOT NULL DEFAULT 0,
  legit_text text,
  status text NOT NULL CHECK (status IN ('draft', 'confirmed', 'paid', 'cancelled')) DEFAULT 'draft',
  paid_method text,
  paid_at timestamp with time zone,
  cash_entry_id uuid REFERENCES public.cash_entries(id) ON DELETE SET NULL,
  financial_movement_id uuid REFERENCES public.financial_movements(id) ON DELETE SET NULL,
  snapshot_json jsonb,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  confirmed_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  cancelled_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  cancelled_at timestamp with time zone,
  cancellation_reason text,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reception_closures_staff ON public.reception_closures(staff_id);
CREATE INDEX IF NOT EXISTS idx_reception_closures_period ON public.reception_closures(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_reception_closures_status ON public.reception_closures(status);

-- Anti-duplicate: only one non-cancelled closure per staff+period
-- Must use CREATE UNIQUE INDEX (not inline UNIQUE) for partial index
CREATE UNIQUE INDEX IF NOT EXISTS uq_reception_closure_active_period
  ON public.reception_closures(staff_id, period_start, period_end)
  WHERE status != 'cancelled';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_reception_closures_modtime'
  ) THEN
    CREATE TRIGGER update_reception_closures_modtime
      BEFORE UPDATE ON public.reception_closures
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- 3. RECEPTION ADVANCES (Pegos / Adiantamentos / Retiradas)
--    Created AFTER closures so FK to reception_closures is safe.
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.reception_advances (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id uuid NOT NULL REFERENCES public.reception_staff(id) ON DELETE RESTRICT,
  occurred_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  type text NOT NULL CHECK (type IN ('cash_advance', 'pix_advance', 'stock_withdrawal', 'manual_deduction')),
  source_method text NOT NULL CHECK (source_method IN ('caixa', 'pix', 'estoque', 'manual')),
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_amount numeric(14,2) NOT NULL,
  total_amount numeric(14,2) NOT NULL,
  product_id uuid REFERENCES public.inventory_products(id) ON DELETE SET NULL,
  cash_entry_id uuid REFERENCES public.cash_entries(id) ON DELETE SET NULL,
  financial_movement_id uuid REFERENCES public.financial_movements(id) ON DELETE SET NULL,
  stock_movement_id uuid REFERENCES public.stock_movements(id) ON DELETE SET NULL,
  closure_id uuid REFERENCES public.reception_closures(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'cancelled', 'applied')) DEFAULT 'active',
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  cancelled_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  cancelled_at timestamp with time zone,
  cancellation_reason text,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reception_advances_staff ON public.reception_advances(staff_id);
CREATE INDEX IF NOT EXISTS idx_reception_advances_period ON public.reception_advances(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_reception_advances_status ON public.reception_advances(status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_reception_advances_modtime'
  ) THEN
    CREATE TRIGGER update_reception_advances_modtime
      BEFORE UPDATE ON public.reception_advances
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- 4. RLS — Same permissive pattern as existing tables
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.reception_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reception_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reception_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all actions for authenticated users"
  ON public.reception_staff FOR ALL TO authenticated USING (true);

CREATE POLICY "Enable all actions for authenticated users"
  ON public.reception_closures FOR ALL TO authenticated USING (true);

CREATE POLICY "Enable all actions for authenticated users"
  ON public.reception_advances FOR ALL TO authenticated USING (true);

-- ════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ════════════════════════════════════════════════════════════
