-- ============================================================
-- Barber Zac ERP — Data Hygiene: Cleanup Dirty Categories/Brands
-- Date: 2026-03-31
-- 
-- This script is SAFE and REVERSIBLE:
-- - It only sets is_active = false (soft-deactivate)
-- - No DELETE statements
-- - No product name/price/stock/financial changes
-- 
-- Run this manually against Supabase SQL Editor.
-- 
-- To REVERSE: UPDATE ... SET is_active = true WHERE ...
-- ============================================================

-- =========================================
-- STEP 1: Deactivate ghost categories
-- (no product references them)
-- =========================================
UPDATE public.inventory_categories
SET is_active = false, updated_at = now()
WHERE id NOT IN (
  SELECT DISTINCT category_id 
  FROM public.inventory_products 
  WHERE category_id IS NOT NULL 
    AND deleted_at IS NULL
)
AND is_active = true;

-- =========================================
-- STEP 2: Deactivate dirty categories
-- (name is numeric-only, currency-like, or blank)
-- =========================================
UPDATE public.inventory_categories
SET is_active = false, updated_at = now()
WHERE is_active = true
AND (
  -- blank / whitespace-only
  TRIM(name) = ''
  -- numeric-only (e.g. "123", "45.67")
  OR name ~ '^\s*[\d.,]+\s*$'
  -- currency-like (e.g. "R$ 110,00", "$ 5.99")
  OR name ~ '^\s*R?\$\s*[\d.,]+\s*$'
);

-- =========================================
-- STEP 3: Deactivate ghost brands
-- (no product references them)
-- =========================================
UPDATE public.product_brands
SET is_active = false, updated_at = now()
WHERE id NOT IN (
  SELECT DISTINCT brand_id 
  FROM public.inventory_products 
  WHERE brand_id IS NOT NULL 
    AND deleted_at IS NULL
)
AND is_active = true;

-- =========================================
-- STEP 4: Deactivate dirty brands
-- (name is numeric-only, currency-like, or blank)
-- =========================================
UPDATE public.product_brands
SET is_active = false, updated_at = now()
WHERE is_active = true
AND (
  -- blank / whitespace-only
  TRIM(name) = ''
  -- numeric-only
  OR name ~ '^\s*[\d.,]+\s*$'
  -- currency-like
  OR name ~ '^\s*R?\$\s*[\d.,]+\s*$'
);

-- =========================================
-- STEP 5: Normalize whitespace in remaining active entries
-- (trim + collapse repeated spaces)
-- =========================================
UPDATE public.inventory_categories
SET name = TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g')),
    normalized_name = LOWER(TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g'))),
    updated_at = now()
WHERE is_active = true
AND (name != TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g')));

UPDATE public.product_brands
SET name = TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g')),
    normalized_name = LOWER(TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g'))),
    updated_at = now()
WHERE is_active = true
AND (name != TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g')));

-- =========================================
-- VERIFICATION QUERIES (run after cleanup)
-- =========================================

-- Show remaining active categories
-- SELECT id, name, is_active FROM inventory_categories ORDER BY name;

-- Show remaining active brands
-- SELECT id, name, is_active FROM product_brands ORDER BY name;

-- Show categories with product count
-- SELECT c.name, COUNT(p.id) as product_count
-- FROM inventory_categories c
-- LEFT JOIN inventory_products p ON p.category_id = c.id AND p.deleted_at IS NULL
-- WHERE c.is_active = true
-- GROUP BY c.name
-- ORDER BY c.name;

-- Show brands with product count  
-- SELECT b.name, COUNT(p.id) as product_count
-- FROM product_brands b
-- LEFT JOIN inventory_products p ON p.brand_id = b.id AND p.deleted_at IS NULL
-- WHERE b.is_active = true
-- GROUP BY b.name
-- ORDER BY b.name;
