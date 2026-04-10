/**
 * Quick verification script to check database state after go-live reset.
 * Run: node --env-file=.env.local scripts/verify-golive.mjs
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  console.log('\n━━━ DATABASE STATE VERIFICATION ━━━\n');

  // 1. Categories
  const { data: cats, count: catCount } = await supabase.from('inventory_categories').select('id, name, code_prefix', { count: 'exact' });
  console.log(`Categories: ${catCount}`);
  cats?.forEach(c => console.log(`  [${(c.code_prefix||'?').padEnd(3)}] ${c.name}`));

  // 2. Brands
  const { data: brands, count: brandCount } = await supabase.from('product_brands').select('id, name', { count: 'exact' });
  console.log(`\nBrands: ${brandCount}`);
  brands?.forEach(b => console.log(`  ${b.name}`));

  // 3. Products
  const { count: prodCount } = await supabase.from('inventory_products').select('id', { count: 'exact', head: true });
  console.log(`\nProducts: ${prodCount}`);

  // 4. Stock Movements
  const { count: moveCount } = await supabase.from('stock_movements').select('id', { count: 'exact', head: true });
  console.log(`Stock Movements: ${moveCount}`);

  // 5. Inventory Position (view)
  const { data: positions } = await supabase.from('vw_inventory_position').select('product_name, current_balance, stock_status, external_code').order('external_code').limit(20);
  console.log(`\nInventory Positions (first 20):`);
  positions?.forEach(p => console.log(`  ${(p.external_code||'?').padEnd(8)} ${p.product_name?.substring(0,40).padEnd(42)} Bal: ${String(p.current_balance).padStart(4)}  ${p.stock_status}`));

  // 6. Transactional tables (should be empty)
  const { count: salesCount } = await supabase.from('sales').select('id', { count: 'exact', head: true });
  const { count: cashCount } = await supabase.from('cash_sessions').select('id', { count: 'exact', head: true });
  const { count: finCount } = await supabase.from('financial_movements').select('id', { count: 'exact', head: true });
  const { count: auditCount } = await supabase.from('audit_logs').select('id', { count: 'exact', head: true });
  console.log(`\nTransactional Data (should be minimal):`);
  console.log(`  Sales: ${salesCount}`);
  console.log(`  Cash Sessions: ${cashCount}`);
  console.log(`  Financial Movements: ${finCount}`);
  console.log(`  Audit Logs: ${auditCount} (1 = go-live log)`);

  // 7. Payment Methods
  const { data: pms } = await supabase.from('payment_methods').select('name, is_active');
  console.log(`\nPayment Methods:`);
  pms?.forEach(p => console.log(`  ${p.is_active ? '✅' : '❌'} ${p.name}`));

  // 8. Settings
  const { data: settings } = await supabase.from('app_settings').select('organization_name').limit(1).single();
  console.log(`\nOrganization: ${settings?.organization_name || '(not set)'}`);

  // 9. Customers
  const { count: custCount } = await supabase.from('customers').select('id', { count: 'exact', head: true });
  console.log(`Customers: ${custCount}`);

  // 10. Collaborators
  const { count: collabCount } = await supabase.from('collaborators').select('id', { count: 'exact', head: true });
  console.log(`Collaborators: ${collabCount}`);

  console.log('\n━━━ VERIFICATION COMPLETE ━━━\n');
}

verify().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
