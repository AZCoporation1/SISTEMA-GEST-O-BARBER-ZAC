-- =====================================================
-- Barber Zac ERP — Subscriptions Module Schema
-- Migration: 20260522_000017_subscriptions_module.sql
--
-- Creates 6 new tables + alters appointments table.
-- Order: plans → plan_professionals → customer_subscriptions
--        → occurrences → alter appointments → payments → webhook_events
-- =====================================================

-- ═══════════════════════════════════════════════════════
-- 1. subscription_plans — Plan catalog
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_service_id uuid UNIQUE REFERENCES services(id) ON DELETE SET NULL,
  name text NOT NULL,
  display_name text NOT NULL,
  slug text NOT NULL,
  plan_number integer,
  monthly_price numeric NOT NULL CHECK (monthly_price >= 0),
  duration_minutes_per_visit integer NOT NULL CHECK (duration_minutes_per_visit > 0),
  visits_per_cycle integer NOT NULL CHECK (visits_per_cycle > 0),
  included_services_json jsonb DEFAULT '{}',
  visit_template_json jsonb NOT NULL DEFAULT '[]',
  professional_scope text,  -- 'zac' | 'gustavo_matheus' | 'all'
  needs_manual_review boolean NOT NULL DEFAULT false,
  imported_from_service boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  show_in_customer_portal boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════
-- 2. subscription_plan_professionals — Plan ↔ Professional
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS subscription_plan_professionals (
  plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES collaborators(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, professional_id)
);

-- ═══════════════════════════════════════════════════════
-- 3. customer_subscriptions — Active subscriptions
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_payment','active','past_due','cancelled','expired','failed')),
  fixed_weekday integer NOT NULL CHECK (fixed_weekday >= 0 AND fixed_weekday <= 6),
  fixed_time text NOT NULL,  -- "HH:MM"
  preferred_professional_id uuid REFERENCES collaborators(id) ON DELETE SET NULL,
  current_period_start date,
  current_period_end date,
  starts_at timestamptz,
  ends_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  -- Payment provider fields (placeholder)
  payment_provider text NOT NULL DEFAULT 'placeholder',
  provider_customer_id text,
  provider_subscription_id text,
  provider_checkout_id text,
  provider_checkout_url text,
  payment_method text,  -- 'card' | 'pix' | 'pix_automatic'
  -- Activation
  activated_manually boolean NOT NULL DEFAULT false,
  activated_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  activated_at timestamptz,
  checkout_mode text NOT NULL DEFAULT 'placeholder',
  -- Consent
  terms_accepted_at timestamptz,
  recurring_authorization_accepted_at timestamptz,
  -- Discount
  subscriber_discount_percent numeric NOT NULL DEFAULT 7,
  -- Metadata
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════
-- 4. subscription_occurrences — Cycle visits
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS subscription_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  occurrence_date date NOT NULL,
  occurrence_start_at timestamptz NOT NULL,
  occurrence_end_at timestamptz NOT NULL,
  occurrence_index integer NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','used','skipped','conflict','cancelled','failed')),
  template_items_json jsonb NOT NULL DEFAULT '[]',
  visit_label text,
  used_at timestamptz,
  used_by uuid,
  consumed_by_status text,  -- 'checked_in' | 'completed'
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, occurrence_index)
);

-- ═══════════════════════════════════════════════════════
-- 5. ALTER appointments — Add subscription fields
-- ═══════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'subscription_id'
  ) THEN
    ALTER TABLE appointments ADD COLUMN subscription_id uuid REFERENCES customer_subscriptions(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'subscription_occurrence_id'
  ) THEN
    ALTER TABLE appointments ADD COLUMN subscription_occurrence_id uuid REFERENCES subscription_occurrences(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'is_subscription'
  ) THEN
    ALTER TABLE appointments ADD COLUMN is_subscription boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════
-- 6. subscription_payments — Payment history
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  provider text NOT NULL DEFAULT 'placeholder',
  provider_payment_id text,
  provider_invoice_id text,
  amount numeric NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','refunded','cancelled')),
  payment_method text,
  due_at timestamptz,
  paid_at timestamptz,
  raw_event jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════
-- 7. subscription_webhook_events — Idempotency
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS subscription_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  processed_at timestamptz,
  raw_payload jsonb,
  status text NOT NULL DEFAULT 'received',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════
-- 8. Indexes
-- ═══════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_subscription_plans_source ON subscription_plans(source_service_id) WHERE source_service_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_customer ON customer_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_status ON customer_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_active ON customer_subscriptions(customer_id, status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_subscription_occurrences_sub ON subscription_occurrences(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_occurrences_date ON subscription_occurrences(occurrence_date);
CREATE INDEX IF NOT EXISTS idx_subscription_occurrences_appt ON subscription_occurrences(appointment_id) WHERE appointment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_payments_sub ON subscription_payments(subscription_id);

CREATE INDEX IF NOT EXISTS idx_appointments_subscription ON appointments(subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_is_subscription ON appointments(is_subscription) WHERE is_subscription = true;

-- ═══════════════════════════════════════════════════════
-- 9. RLS Policies
-- ═══════════════════════════════════════════════════════
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plan_professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role (server actions) can do everything
CREATE POLICY "service_role_all" ON subscription_plans FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON subscription_plan_professionals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON customer_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON subscription_occurrences FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON subscription_payments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON subscription_webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Anon can read active plans (for public portal)
CREATE POLICY "anon_read_active_plans" ON subscription_plans FOR SELECT TO anon USING (is_active = true AND show_in_customer_portal = true);
CREATE POLICY "anon_read_plan_professionals" ON subscription_plan_professionals FOR SELECT TO anon USING (true);

-- Authenticated users can read plans
CREATE POLICY "auth_read_plans" ON subscription_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_plan_professionals" ON subscription_plan_professionals FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_own_subscriptions" ON customer_subscriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_own_occurrences" ON subscription_occurrences FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_own_payments" ON subscription_payments FOR SELECT TO authenticated USING (true);
