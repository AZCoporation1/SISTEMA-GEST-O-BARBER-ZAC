-- ============================================================
-- Migration: Add commission snapshot fields to sales AND sale_items
-- Purpose: Enable per-item commission calculation (service=47%, product=20%)
-- Safety: 100% idempotent — safe to run multiple times
-- All columns are nullable, no existing data is altered
-- ============================================================

-- 1. Add commission columns to sale_items (idempotent via IF NOT EXISTS)
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS commission_percent_snapshot numeric(5,2) NULL,
  ADD COLUMN IF NOT EXISTS commission_amount_snapshot numeric(14,2) NULL,
  ADD COLUMN IF NOT EXISTS commission_rule_snapshot text NULL;

-- 2. Add commission columns to sales (idempotent via IF NOT EXISTS)
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS commission_amount_snapshot numeric(14,2) NULL,
  ADD COLUMN IF NOT EXISTS commission_is_custom boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_source text NULL;

-- 3. CHECK constraints for sale_items (idempotent — only create if not exists)
-- 3a. Percent range
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_si_commission_percent_range'
  ) THEN
    ALTER TABLE public.sale_items
      ADD CONSTRAINT chk_si_commission_percent_range
      CHECK (
        commission_percent_snapshot IS NULL OR
        (commission_percent_snapshot >= 0 AND commission_percent_snapshot <= 100)
      );
  END IF;
END $$;

-- 3b. Amount non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_si_commission_amount_nonneg'
  ) THEN
    ALTER TABLE public.sale_items
      ADD CONSTRAINT chk_si_commission_amount_nonneg
      CHECK (
        commission_amount_snapshot IS NULL OR commission_amount_snapshot >= 0
      );
  END IF;
END $$;

-- 3c. Rule valid values (includes combo_service_47 for combo=service scenarios)
-- If old constraint exists without combo values, drop and recreate safely
DO $$
BEGIN
  -- Drop old constraint if it exists (it may not include combo_service_47)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_si_commission_rule_valid'
  ) THEN
    ALTER TABLE public.sale_items DROP CONSTRAINT chk_si_commission_rule_valid;
  END IF;

  -- Create updated constraint with all valid rule values
  ALTER TABLE public.sale_items
    ADD CONSTRAINT chk_si_commission_rule_valid
    CHECK (
      commission_rule_snapshot IS NULL OR commission_rule_snapshot IN (
        'service_standard_47',
        'product_fixed_20',
        'combo_service_47',
        'combo_product_20',
        'legacy_fallback',
        'unknown_no_commission'
      )
    );
END $$;

-- 4. Comments
COMMENT ON COLUMN public.sale_items.commission_percent_snapshot
  IS 'Commission percent applied at sale time: service/combo 47%, product/perfume 20%';

COMMENT ON COLUMN public.sale_items.commission_amount_snapshot
  IS 'Commission amount calculated from item total and commission percent';

COMMENT ON COLUMN public.sale_items.commission_rule_snapshot
  IS 'Applied commission rule: service_standard_47, product_fixed_20, combo_service_47, combo_product_20, legacy_fallback, unknown_no_commission';

COMMENT ON COLUMN public.sales.commission_amount_snapshot
  IS 'Total commission amount for the sale calculated via backend rules at sale time';

COMMENT ON COLUMN public.sales.commission_is_custom
  IS 'Boolean indicating if the commission was customized (overridden) by the operator';

COMMENT ON COLUMN public.sales.commission_source
  IS 'Indicates the source of the commission rules e.g., per_item_rules';
