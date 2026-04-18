-- ============================================================
-- Migration: Barber Zac ERP — Customers Module & Walkin
-- Date: 2026-04-18
-- ============================================================

-- 1. Add fields to customers table additively
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS normalized_name text,
ADD COLUMN IF NOT EXISTS mobile_phone text,
ADD COLUMN IF NOT EXISTS ddi text,
ADD COLUMN IF NOT EXISTS cpf text,
ADD COLUMN IF NOT EXISTS rg text,
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS address_line text,
ADD COLUMN IF NOT EXISTS neighborhood text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS postal_code text,
ADD COLUMN IF NOT EXISTS address_number text,
ADD COLUMN IF NOT EXISTS complement text,
ADD COLUMN IF NOT EXISTS referral_source text,
ADD COLUMN IF NOT EXISTS legacy_login text,
ADD COLUMN IF NOT EXISTS loyalty_points integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS legacy_created_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS legacy_last_visit_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS days_since_last_visit integer,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Enable unaccent extension for normalized search
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Fallback to populate normalized_name using full_name if not null
UPDATE public.customers
SET normalized_name = lower(unaccent(full_name))
WHERE normalized_name IS NULL AND full_name IS NOT NULL;

-- Create useful indexes for searching
CREATE INDEX IF NOT EXISTS idx_customers_normalized_name ON public.customers(normalized_name);
CREATE INDEX IF NOT EXISTS idx_customers_mobile_phone ON public.customers(mobile_phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_cpf ON public.customers(cpf);


-- 2. Add snapshots to sales table additively
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS customer_name_snapshot text,
ADD COLUMN IF NOT EXISTS customer_phone_snapshot text;

-- End of File
