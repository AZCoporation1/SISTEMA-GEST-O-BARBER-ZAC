-- ============================================================
-- Barber Zac ERP — Professionals + Commissions Operational Module
-- ADDITIVE MIGRATION ONLY — No drops, no destructive changes
-- ============================================================

-- 1. EXTEND collaborators table with professional fields
ALTER TABLE public.collaborators
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS default_commission_percent numeric(5,2) DEFAULT 47.00,
  ADD COLUMN IF NOT EXISTS settlement_primary_day integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS settlement_secondary_day integer DEFAULT 20;

-- 2. PROFESSIONAL ADVANCES (adiantamentos, pegos, consumo)
CREATE TABLE IF NOT EXISTS public.professional_advances (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id uuid REFERENCES public.collaborators(id) ON DELETE RESTRICT NOT NULL,
  occurred_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  type text NOT NULL CHECK (type IN ('cash_advance', 'pix_advance', 'stock_consumption', 'manual_deduction', 'deferred_deduction')),
  source_method text NOT NULL CHECK (source_method IN ('caixa', 'pix', 'estoque', 'manual')),
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  product_id uuid REFERENCES public.inventory_products(id) ON DELETE SET NULL,
  cash_entry_id uuid REFERENCES public.cash_entries(id) ON DELETE SET NULL,
  financial_movement_id uuid REFERENCES public.financial_movements(id) ON DELETE SET NULL,
  stock_movement_id uuid REFERENCES public.stock_movements(id) ON DELETE SET NULL,
  closure_id uuid, -- FK added after professional_closures table is created
  carry_over_to_next_period boolean NOT NULL DEFAULT false,
  status text NOT NULL CHECK (status IN ('active', 'cancelled', 'applied')) DEFAULT 'active',
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prof_advances_professional ON public.professional_advances(professional_id);
CREATE INDEX IF NOT EXISTS idx_prof_advances_occurred ON public.professional_advances(occurred_at);
CREATE INDEX IF NOT EXISTS idx_prof_advances_status ON public.professional_advances(status);

-- 3. PROFESSIONAL CLOSURES (fechamentos quinzenais)
CREATE TABLE IF NOT EXISTS public.professional_closures (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id uuid REFERENCES public.collaborators(id) ON DELETE RESTRICT NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  payment_reference_date date NOT NULL,
  gross_total numeric(14,2) NOT NULL DEFAULT 0,
  commission_percent_snapshot numeric(5,2) NOT NULL,
  barber_share numeric(14,2) NOT NULL DEFAULT 0,
  barbershop_share numeric(14,2) NOT NULL DEFAULT 0,
  advances_total numeric(14,2) NOT NULL DEFAULT 0,
  deferred_total numeric(14,2) NOT NULL DEFAULT 0,
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
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prof_closures_professional ON public.professional_closures(professional_id);
CREATE INDEX IF NOT EXISTS idx_prof_closures_period ON public.professional_closures(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_prof_closures_status ON public.professional_closures(status);

-- 4. Add FK from advances to closures (now that closures table exists)
ALTER TABLE public.professional_advances
  ADD CONSTRAINT fk_advance_closure
  FOREIGN KEY (closure_id) REFERENCES public.professional_closures(id) ON DELETE SET NULL;

-- 5. updated_at triggers for new tables
CREATE TRIGGER update_prof_advances_modtime
  BEFORE UPDATE ON public.professional_advances
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_prof_closures_modtime
  BEFORE UPDATE ON public.professional_closures
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 6. RLS — same pattern as existing system (authenticated = full access)
ALTER TABLE public.professional_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all actions for authenticated users"
  ON public.professional_advances FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all actions for authenticated users"
  ON public.professional_closures FOR ALL TO authenticated USING (true);

-- 7. SEED professionals (insert only if not already present)
INSERT INTO public.collaborators (name, role, display_name, default_commission_percent, is_active)
SELECT 'Gustavo', 'barbeiro', 'GuhSP', 47.00, true
WHERE NOT EXISTS (SELECT 1 FROM public.collaborators WHERE name = 'Gustavo');

INSERT INTO public.collaborators (name, role, display_name, default_commission_percent, is_active)
SELECT 'Matheus', 'barbeiro', 'Gulu', 47.00, true
WHERE NOT EXISTS (SELECT 1 FROM public.collaborators WHERE name = 'Matheus');

INSERT INTO public.collaborators (name, role, display_name, default_commission_percent, is_active)
SELECT 'Lucas Zaquiel', 'barbeiro', 'Barber Zac', 47.00, true
WHERE NOT EXISTS (SELECT 1 FROM public.collaborators WHERE name = 'Lucas Zaquiel');

-- Update display_name and commission for existing records that don't have them yet
UPDATE public.collaborators SET display_name = 'GuhSP', default_commission_percent = COALESCE(default_commission_percent, 47.00) WHERE name = 'Gustavo' AND display_name IS NULL;
UPDATE public.collaborators SET display_name = 'Gulu', default_commission_percent = COALESCE(default_commission_percent, 47.00) WHERE name = 'Matheus' AND display_name IS NULL;
UPDATE public.collaborators SET display_name = 'Barber Zac', default_commission_percent = COALESCE(default_commission_percent, 47.00) WHERE name = 'Lucas Zaquiel' AND display_name IS NULL;

-- End of Migration
