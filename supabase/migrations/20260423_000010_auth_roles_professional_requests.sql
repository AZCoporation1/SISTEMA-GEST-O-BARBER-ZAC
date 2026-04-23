-- ============================================================
-- Barber Zac ERP — Migration #10
-- Auth Roles + Professional Requests (Approval Queue)
-- Date: 2026-04-23
-- STRICTLY ADDITIVE — No drops, no destructive changes
-- ============================================================

-- ============================================================
-- PART A: EXTEND user_profiles with role & collaborator linkage
-- ============================================================

-- A.1 Add system_role (keeps existing 'role' column untouched)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS system_role text
    CHECK (system_role IN ('admin_total', 'professional', 'owner_admin_professional'))
    DEFAULT 'professional';

-- A.2 Add display_name for UI
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS display_name text;

-- A.3 Add collaborator linkage (nullable — admins may not be professionals)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS collaborator_id uuid REFERENCES public.collaborators(id) ON DELETE SET NULL;

-- A.4 Add granular permission flags
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS can_approve_professional_requests boolean DEFAULT false;
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS can_view_all_professionals boolean DEFAULT false;
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS can_manage_system boolean DEFAULT false;
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS can_submit_professional_requests boolean DEFAULT false;

-- A.5 Index on collaborator_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_collaborator ON public.user_profiles(collaborator_id);

-- A.6 Update the handle_new_user trigger to set system_role
-- New users default to 'professional' (safest default)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (auth_user_id, full_name, email, role, system_role)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'operador',
    coalesce(new.raw_user_meta_data->>'system_role', 'professional')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PART B: professional_requests TABLE (Approval Queue)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.professional_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Who submitted
  professional_id uuid REFERENCES public.collaborators(id) ON DELETE RESTRICT NOT NULL,
  submitted_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL NOT NULL,

  -- Request classification
  request_type text NOT NULL CHECK (request_type IN (
    'inventory_sale',
    'service_sale',
    'perfume_sale',
    'stock_withdrawal',
    'manual_deduction'
  )),
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')) DEFAULT 'pending',

  -- Summary
  title text NOT NULL,
  payload_json jsonb NOT NULL,

  -- Optional linked entities (for context)
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name_snapshot text,
  customer_phone_snapshot text,
  inventory_product_id uuid REFERENCES public.inventory_products(id) ON DELETE SET NULL,
  service_id uuid,

  -- Linked records AFTER approval (populated by approval engine)
  linked_sale_id uuid,
  linked_perfume_sale_id uuid,
  linked_advance_id uuid,
  linked_cash_entry_id uuid,
  linked_financial_movement_id uuid,
  linked_stock_movement_id uuid,

  -- Admin actions
  admin_notes text,
  rejection_reason text,
  approved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_at timestamp with time zone,
  rejected_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  rejected_at timestamp with time zone,

  -- Timestamps
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prof_req_professional ON public.professional_requests(professional_id);
CREATE INDEX IF NOT EXISTS idx_prof_req_status ON public.professional_requests(status);
CREATE INDEX IF NOT EXISTS idx_prof_req_submitted_by ON public.professional_requests(submitted_by);
CREATE INDEX IF NOT EXISTS idx_prof_req_created ON public.professional_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prof_req_type ON public.professional_requests(request_type);

-- Trigger: updated_at
CREATE TRIGGER update_prof_requests_modtime
  BEFORE UPDATE ON public.professional_requests
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- RLS: same pattern as all existing tables (authenticated = full access)
ALTER TABLE public.professional_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all actions for authenticated users"
  ON public.professional_requests FOR ALL TO authenticated USING (true);

-- End of Migration
