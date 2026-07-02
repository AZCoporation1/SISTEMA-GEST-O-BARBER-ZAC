-- ============================================================
-- Migration: Sale Commission Snapshot (PDV Custom Commission)
-- Date: 2026-06-18
-- Purpose: Add commission snapshot fields to sales table
--          to support per-sale custom commission at checkout.
-- NON-DESTRUCTIVE: Only ADD nullable columns with CHECK constraints.
-- Existing sales: all new fields remain NULL / false (legacy fallback).
-- ============================================================

-- ── 1. Add commission snapshot fields ──

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS commission_base_amount_snapshot numeric(14,2) NULL,
  ADD COLUMN IF NOT EXISTS default_commission_percent_snapshot numeric(5,2) NULL,
  ADD COLUMN IF NOT EXISTS commission_percent_snapshot numeric(5,2) NULL,
  ADD COLUMN IF NOT EXISTS commission_amount_snapshot numeric(14,2) NULL,
  ADD COLUMN IF NOT EXISTS commission_is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_source text NULL,
  ADD COLUMN IF NOT EXISTS commission_override_reason text NULL,
  ADD COLUMN IF NOT EXISTS commission_configured_by uuid NULL;

-- ── 2. CHECK constraints (safe — NULL values pass CHECK) ──

ALTER TABLE public.sales
  ADD CONSTRAINT chk_commission_percent_range
    CHECK (commission_percent_snapshot IS NULL OR (commission_percent_snapshot >= 0 AND commission_percent_snapshot <= 100));

ALTER TABLE public.sales
  ADD CONSTRAINT chk_default_commission_percent_range
    CHECK (default_commission_percent_snapshot IS NULL OR (default_commission_percent_snapshot >= 0 AND default_commission_percent_snapshot <= 100));

ALTER TABLE public.sales
  ADD CONSTRAINT chk_commission_amount_nonneg
    CHECK (commission_amount_snapshot IS NULL OR commission_amount_snapshot >= 0);

ALTER TABLE public.sales
  ADD CONSTRAINT chk_commission_base_nonneg
    CHECK (commission_base_amount_snapshot IS NULL OR commission_base_amount_snapshot >= 0);

ALTER TABLE public.sales
  ADD CONSTRAINT chk_commission_source_valid
    CHECK (commission_source IS NULL OR commission_source IN ('default_collaborator', 'custom_checkout', 'legacy_fallback'));

-- ── 3. FK for commission_configured_by (who customized) ──

ALTER TABLE public.sales
  ADD CONSTRAINT fk_commission_configured_by
    FOREIGN KEY (commission_configured_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- End of migration
