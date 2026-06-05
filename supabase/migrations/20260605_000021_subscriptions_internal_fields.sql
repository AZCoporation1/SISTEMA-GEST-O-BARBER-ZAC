-- =====================================================
-- Barber Zac ERP — Internal Subscriptions Additive Fields
-- Migration: 20260605_000021_subscriptions_internal_fields.sql
--
-- Adds fields needed for internal (admin) subscription creation:
--   source, billing_day, created_by, notes
-- Expands occurrence status CHECK to include 'missed', 'rescheduled', 'pending'.
-- Expands payment status CHECK to include 'overdue', 'waived'.
--
-- ALL operations are safe / idempotent (IF NOT EXISTS / exception handling).
-- =====================================================

-- ═══════════════════════════════════════════════════════
-- 1. customer_subscriptions — new columns
-- ═══════════════════════════════════════════════════════

DO $$
BEGIN
  -- source: distinguishes where the subscription was created
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_subscriptions' AND column_name = 'source'
  ) THEN
    ALTER TABLE customer_subscriptions
      ADD COLUMN source text NOT NULL DEFAULT 'customer_portal';
  END IF;

  -- billing_day: fixed day of month for payment (1-31)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_subscriptions' AND column_name = 'billing_day'
  ) THEN
    ALTER TABLE customer_subscriptions
      ADD COLUMN billing_day integer CHECK (billing_day >= 1 AND billing_day <= 31);
  END IF;

  -- created_by: who created the subscription
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_subscriptions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE customer_subscriptions
      ADD COLUMN created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL;
  END IF;

  -- notes: admin observations
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_subscriptions' AND column_name = 'notes'
  ) THEN
    ALTER TABLE customer_subscriptions
      ADD COLUMN notes text;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════
-- 2. subscription_occurrences — expand status CHECK
-- ═══════════════════════════════════════════════════════
-- Drop old check constraint and add new one with extra statuses

DO $$
BEGIN
  -- Try to drop the existing constraint (name varies)
  BEGIN
    ALTER TABLE subscription_occurrences DROP CONSTRAINT IF EXISTS subscription_occurrences_status_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Re-add with expanded statuses
  BEGIN
    ALTER TABLE subscription_occurrences
      ADD CONSTRAINT subscription_occurrences_status_check
      CHECK (status IN ('scheduled','used','skipped','conflict','cancelled','failed','missed','rescheduled','pending'));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- ═══════════════════════════════════════════════════════
-- 3. subscription_payments — expand status CHECK
-- ═══════════════════════════════════════════════════════

DO $$
BEGIN
  BEGIN
    ALTER TABLE subscription_payments DROP CONSTRAINT IF EXISTS subscription_payments_status_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER TABLE subscription_payments
      ADD CONSTRAINT subscription_payments_status_check
      CHECK (status IN ('pending','paid','failed','refunded','cancelled','overdue','waived'));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- ═══════════════════════════════════════════════════════
-- 4. Indexes for new columns
-- ═══════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_source ON customer_subscriptions(source);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_billing_day ON customer_subscriptions(billing_day) WHERE billing_day IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_professional ON customer_subscriptions(preferred_professional_id) WHERE preferred_professional_id IS NOT NULL;
