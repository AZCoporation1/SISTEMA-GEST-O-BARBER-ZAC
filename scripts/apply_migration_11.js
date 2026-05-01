/**
 * Apply migration #11 via Supabase Management API
 * Uses the personal access token (sbp_...) for the Management API
 */
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MGMT_TOKEN = 'sbp_f5ed50c494359deb4b9e90c04eb19e792f07c176';
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];

async function runSQL(sql, label) {
  console.log(`\n[EXEC] ${label}`);
  const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MGMT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await resp.text();
  if (!resp.ok) {
    console.log(`  ❌ Status: ${resp.status}`);
    console.log(`  Response: ${text.substring(0, 500)}`);
    return false;
  }
  
  console.log(`  ✅ Success`);
  try {
    const result = JSON.parse(text);
    if (result && result.length > 0) {
      console.log(`  Result: ${JSON.stringify(result).substring(0, 200)}`);
    }
  } catch(e) {}
  return true;
}

async function main() {
  console.log('=== Migration #11: Perfume Dual Pricing ===');
  console.log(`Project: ${PROJECT_REF}`);

  // Step 1: Add columns
  let ok = await runSQL(`
    ALTER TABLE public.inventory_products
      ADD COLUMN IF NOT EXISTS sale_price_cash numeric(14,2),
      ADD COLUMN IF NOT EXISTS sale_price_installment numeric(14,2);
  `, 'Add dual pricing columns');

  if (!ok) {
    console.log('\n❌ Failed to add columns. Aborting.');
    return;
  }

  // Step 2: Update view
  ok = await runSQL(`
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
      p.sale_price_cash,
      p.sale_price_installment,
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
  `, 'Update vw_inventory_position view');

  // Step 3: Grants
  await runSQL('GRANT SELECT ON public.vw_inventory_position TO authenticated;', 'Grant to authenticated');
  await runSQL('GRANT SELECT ON public.vw_inventory_position TO anon;', 'Grant to anon');

  // Verify
  console.log('\n=== Final Verification ===');
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  
  const { data, error } = await supabase
    .from('inventory_products')
    .select('id, name, sale_price_cash, sale_price_installment')
    .limit(3);

  if (error) {
    console.log('❌ Columns NOT found:', error.message);
  } else {
    console.log('✅ Migration applied successfully!');
    console.log('Sample rows:', JSON.stringify(data, null, 2));
  }
}

main().catch(console.error);
