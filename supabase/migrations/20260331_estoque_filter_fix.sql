-- ============================================================
-- Migration: Barber Zac ERP — Estoque Filter Fix
-- Date: 2026-03-31
-- Purpose: Add is_active to vw_inventory_position so the
--          frontend can filter by active/inactive products.
-- Scope: VIEW-only change, no table alterations.
-- ============================================================

CREATE OR REPLACE VIEW public.vw_inventory_position AS
SELECT 
  p.id AS product_id,
  p.external_code,
  p.name AS product_name,
  c.name AS category_name,
  b.name AS brand_name,
  p.cost_price,
  p.markup_percent,
  p.sale_price_generated AS sale_price,
  COALESCE((SELECT sum(quantity) FROM public.stock_movements sm WHERE sm.product_id = p.id), 0) AS current_balance,
  p.min_stock,
  p.max_stock,
  GREATEST(p.max_stock - COALESCE((SELECT sum(quantity) FROM public.stock_movements sm WHERE sm.product_id = p.id), 0), 0) AS suggested_purchase,
  CASE 
    WHEN COALESCE((SELECT sum(quantity) FROM public.stock_movements sm WHERE sm.product_id = p.id), 0) <= 0 THEN 'sem_estoque'
    WHEN COALESCE((SELECT sum(quantity) FROM public.stock_movements sm WHERE sm.product_id = p.id), 0) <= p.min_stock THEN 'abaixo_do_minimo'
    WHEN COALESCE((SELECT sum(quantity) FROM public.stock_movements sm WHERE sm.product_id = p.id), 0) > p.max_stock THEN 'acima_do_maximo'
    ELSE 'normal'
  END AS stock_status,
  COALESCE((SELECT sum(quantity) FROM public.stock_movements sm WHERE sm.product_id = p.id), 0) * p.cost_price AS total_cost_value,
  COALESCE((SELECT sum(quantity) FROM public.stock_movements sm WHERE sm.product_id = p.id), 0) * p.sale_price_generated AS total_sale_value,
  p.is_active
FROM public.inventory_products p
LEFT JOIN public.inventory_categories c ON p.category_id = c.id
LEFT JOIN public.product_brands b ON p.brand_id = b.id
WHERE p.deleted_at IS NULL;

-- Re-grant permissions (CREATE OR REPLACE resets them)
GRANT SELECT ON public.vw_inventory_position TO authenticated;
GRANT SELECT ON public.vw_inventory_position TO anon;

-- End of migration
