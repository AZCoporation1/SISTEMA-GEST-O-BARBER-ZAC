/**
 * Reload Supabase schema cache and verify
 */
require('dotenv').config({ path: '.env.local' });
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MGMT_TOKEN = 'sbp_f5ed50c494359deb4b9e90c04eb19e792f07c176';
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];

async function main() {
  // Reload PostgREST schema cache
  console.log('Reloading PostgREST schema cache...');
  const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/postgrest`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${MGMT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ db_schema: 'public' }),
  });
  console.log('Reload status:', resp.status);
  const text = await resp.text();
  console.log('Response:', text.substring(0, 200));

  // Also send NOTIFY to reload
  const notifyResp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MGMT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: "NOTIFY pgrst, 'reload schema';" }),
  });
  console.log('NOTIFY status:', notifyResp.status);

  // Wait a bit for cache to refresh
  console.log('Waiting 3 seconds for cache refresh...');
  await new Promise(r => setTimeout(r, 3000));

  // Verify
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  
  console.log('\n=== Testing inventory_products columns ===');
  const { data: prodData, error: prodErr } = await supabase
    .from('inventory_products')
    .select('id, name, external_code, sale_price_cash, sale_price_installment, sale_price_generated')
    .not('external_code', 'is', null)
    .ilike('external_code', 'PERF%')
    .limit(5);
  
  if (prodErr) {
    console.log('❌ Products error:', prodErr.message);
  } else {
    console.log('✅ Products with PERF codes:', prodData.length);
    prodData.forEach(p => console.log(`  ${p.external_code} | ${p.name} | cash=${p.sale_price_cash} | inst=${p.sale_price_installment} | gen=${p.sale_price_generated}`));
  }

  console.log('\n=== Testing vw_inventory_position ===');
  const { data: viewData, error: viewErr } = await supabase
    .from('vw_inventory_position')
    .select('product_id, product_name, external_code, sale_price, sale_price_cash, sale_price_installment')
    .limit(3);

  if (viewErr) {
    console.log('❌ View error:', viewErr.message);
  } else {
    console.log('✅ View works!');
    viewData.forEach(v => console.log(`  ${v.external_code} | ${v.product_name} | sale=${v.sale_price} | cash=${v.sale_price_cash} | inst=${v.sale_price_installment}`));
  }

  // Count ALL existing PERF products
  console.log('\n=== Current PERF product count ===');
  const { data: allPerf, error: perfErr } = await supabase
    .from('inventory_products')
    .select('id, name, external_code, sale_price_generated, cost_price, category_id, brand_id')
    .not('external_code', 'is', null)
    .ilike('external_code', 'PERF%')
    .order('external_code');
  
  if (perfErr) {
    console.log('❌ Error:', perfErr.message);
  } else {
    console.log(`Total PERF products in DB: ${allPerf.length}`);
    allPerf.forEach(p => console.log(`  ${p.external_code} | ${p.name} | cost=${p.cost_price} | sale_gen=${p.sale_price_generated}`));
  }
}

main().catch(console.error);
