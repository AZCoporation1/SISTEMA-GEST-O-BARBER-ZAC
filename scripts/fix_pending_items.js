/**
 * Barber Zac ERP — Fix Pending Items
 * 1. Resolve PERF 019 "Classic Stone" ambiguity → set Vista/Prazo pricing
 * 2. Deactivate 13 legacy "Perf" (lowercase) duplicates
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  let fixed = 0;
  let deactivated = 0;

  // ─── FIX 1: PERF 019 "Classic Stone" ───────────────────
  // Workbook PERF 019: "Classic Stone" → Vista=559.3, Prazo=658
  // DB PERF 019: "Classic Stone" cost=329, sale_gen=559.3 → MATCHES the workbook
  // DB PERF 076: "CLASSIC STONE" cost=660, sale_gen=660 → DIFFERENT product (already priced via code match: Vista=550, Prazo=660)
  // Resolution: PERF 019 gets the workbook PERF 019 pricing
  console.log('═══ FIX 1: PERF 019 Classic Stone ═══');

  const { data: perf019 } = await supabase
    .from('inventory_products')
    .select('id, name, external_code, sale_price_cash, sale_price_installment, sale_price_generated')
    .eq('external_code', 'PERF 019')
    .single();

  console.log('  Before:', JSON.stringify(perf019));

  const { error: err019 } = await supabase
    .from('inventory_products')
    .update({
      sale_price_cash: 559.3,
      sale_price_installment: 658,
    })
    .eq('id', perf019.id);

  if (err019) {
    console.log('  ❌ Error:', err019.message);
  } else {
    console.log('  ✅ Updated PERF 019: Vista=R$559.30, Prazo=R$658.00');
    fixed++;
  }

  // Verify PERF 076 already has pricing
  const { data: perf076 } = await supabase
    .from('inventory_products')
    .select('id, name, external_code, sale_price_cash, sale_price_installment')
    .eq('external_code', 'PERF 076')
    .single();
  
  console.log('  PERF 076 check:', JSON.stringify(perf076));
  if (perf076.sale_price_cash && perf076.sale_price_installment) {
    console.log('  ✅ PERF 076 already has pricing (Vista=R$' + perf076.sale_price_cash + ', Prazo=R$' + perf076.sale_price_installment + ')');
  }

  // ─── FIX 2: Deactivate legacy "Perf" duplicates ───────
  console.log('\n═══ FIX 2: Deactivate legacy "Perf" duplicates ═══');

  // Fetch all lowercase "Perf " entries (case-sensitive match)
  const { data: allProducts } = await supabase
    .from('inventory_products')
    .select('id, external_code, name, cost_price, is_active')
    .not('external_code', 'is', null)
    .ilike('external_code', 'Perf %')
    .is('deleted_at', null);

  // Filter to only the ones that start with lowercase "Perf" (not "PERF")
  const legacyDupes = (allProducts || []).filter(p => 
    p.external_code && 
    p.external_code.startsWith('Perf ') && 
    !p.external_code.startsWith('PERF')
  );

  console.log(`  Found ${legacyDupes.length} legacy duplicates`);

  for (const dupe of legacyDupes) {
    const status = dupe.is_active ? 'ACTIVE → deactivating' : 'already inactive';
    console.log(`  ${dupe.external_code} | "${dupe.name}" | cost=R$${dupe.cost_price} | ${status}`);

    if (dupe.is_active) {
      const { error } = await supabase
        .from('inventory_products')
        .update({ is_active: false })
        .eq('id', dupe.id);

      if (error) {
        console.log(`    ❌ Error: ${error.message}`);
      } else {
        console.log(`    ✅ Deactivated`);
        deactivated++;
      }
    }
  }

  // ─── SUMMARY ───────────────────────────────────────────
  console.log('\n═══ SUMMARY ═══');
  console.log(`  Ambiguity resolved: ${fixed}`);
  console.log(`  Legacy duplicates deactivated: ${deactivated}`);
  console.log(`  Already inactive: ${legacyDupes.filter(d => !d.is_active).length}`);

  // Final verification
  console.log('\n═══ VERIFICATION ═══');
  const { data: verify019 } = await supabase
    .from('inventory_products')
    .select('external_code, name, sale_price_cash, sale_price_installment')
    .eq('external_code', 'PERF 019')
    .single();
  console.log(`  PERF 019: Vista=R$${verify019.sale_price_cash} Prazo=R$${verify019.sale_price_installment}`);

  const { data: activePerfs } = await supabase
    .from('inventory_products')
    .select('id')
    .not('external_code', 'is', null)
    .ilike('external_code', '%PERF%')
    .eq('is_active', true)
    .is('deleted_at', null);
  console.log(`  Active PERF products: ${activePerfs.length}`);

  const { data: inactivePerfs } = await supabase
    .from('inventory_products')
    .select('id')
    .not('external_code', 'is', null)
    .ilike('external_code', '%PERF%')
    .eq('is_active', false)
    .is('deleted_at', null);
  console.log(`  Inactive PERF products: ${inactivePerfs.length}`);

  console.log('\n✅ All pending items resolved.');
}

main().catch(console.error);
