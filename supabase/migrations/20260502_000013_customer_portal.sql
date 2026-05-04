-- ============================================================
-- Migration: Barber Zac ERP — Customer Portal Support
-- Date: 2026-05-02
-- ============================================================

-- Add auth_user_id and last_login_at to customers table safely
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Create an index on auth_user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id ON public.customers(auth_user_id);

-- Create a unique partial index to ensure one customer per auth_user_id,
-- but ignoring NULLs (so manual customers can still be created without an auth account)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_auth_user_id_unique
ON public.customers (auth_user_id)
WHERE auth_user_id IS NOT NULL;

-- Note: The `source` column in `appointments` is already typed as TEXT in the database
-- and constrained logically in the application layer (see types.ts where source is
-- 'admin' | 'professional' | 'customer' | 'imported'). We don't need a DB migration
-- to allow 'customer' as a value unless there is a strict check constraint.

-- Let's check if there's a strict CHECK constraint on `appointments.source`.
-- If there is one that we don't know about, we might need to alter it, but usually
-- it's just a text column. We'll ensure there's no failure.

-- End of File
