-- Migration: Barber Zac ERP — Product Forced Deletion and Snapshots Table
-- Date: 2026-05-27
-- Purpose: Add support for force deleting products with history, preserving their snapshots and relationships.

-- 1. Create snapshots table
CREATE TABLE IF NOT EXISTS public.inventory_product_deletion_snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_product_id uuid NOT NULL,
  product_snapshot jsonb NOT NULL,
  deletion_mode text NOT NULL CHECK (deletion_mode IN ('hard_delete', 'forced_archive', 'operational_delete')),
  reason text,
  dependency_summary jsonb NOT NULL,
  deleted_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  deleted_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add columns to inventory_products
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS deletion_reason text;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS deletion_mode text CHECK (deletion_mode IN ('hard_delete', 'forced_archive', 'operational_delete'));
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS deleted_snapshot_id uuid REFERENCES public.inventory_product_deletion_snapshots(id) ON DELETE SET NULL;

-- 3. Enable RLS and create policy for the new table
ALTER TABLE public.inventory_product_deletion_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_snapshots" ON public.inventory_product_deletion_snapshots;
CREATE POLICY "auth_all_snapshots" ON public.inventory_product_deletion_snapshots
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
