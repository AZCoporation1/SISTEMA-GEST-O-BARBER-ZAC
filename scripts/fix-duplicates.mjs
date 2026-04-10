/**
 * Fix duplicate payment methods and orphaned categories.
 * Run: node --env-file=.env.local scripts/fix-duplicates.mjs
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fix() {
  console.log('\n━━━ FIXING DUPLICATES ━━━\n');

  // 1. Fix duplicate payment methods — remove the non-accented duplicates
  const { data: pms } = await supabase.from('payment_methods').select('id, name');
  console.log('Current payment methods:', pms?.map(p => p.name));
  
  // Find non-accented versions that are duplicates
  const toDelete = pms?.filter(p => 
    p.name === 'Cartao de Credito' || p.name === 'Cartao de Debito'
  ) || [];
  
  for (const pm of toDelete) {
    const { error } = await supabase.from('payment_methods').delete().eq('id', pm.id);
    if (error) {
      console.log(`  ❌ Failed to delete "${pm.name}": ${error.message}`);
    } else {
      console.log(`  ✅ Deleted duplicate: "${pm.name}"`);
    }
  }

  // 2. Fix orphaned old categories — reassign products then delete
  // Old categories: "Minoxiddil" (typo) and "Produtos de Limpeza" (different name)
  const { data: cats } = await supabase.from('inventory_categories').select('id, name, code_prefix');
  
  // Find old "Minoxiddil" category (not the correct "Minoxidil" with prefix 5)
  const oldMinoxiddil = cats?.find(c => c.name === 'Minoxiddil');
  const correctMinoxidil = cats?.find(c => c.code_prefix === '5');
  
  if (oldMinoxiddil && correctMinoxidil && oldMinoxiddil.id !== correctMinoxidil.id) {
    // Reassign any products from old to correct
    const { data: orphanProducts } = await supabase.from('inventory_products')
      .select('id, name').eq('category_id', oldMinoxiddil.id);
    
    if (orphanProducts && orphanProducts.length > 0) {
      const { error } = await supabase.from('inventory_products')
        .update({ category_id: correctMinoxidil.id })
        .eq('category_id', oldMinoxiddil.id);
      console.log(`  🔄 Moved ${orphanProducts.length} products from "Minoxiddil" to "Minoxidil"`);
    }
    
    const { error } = await supabase.from('inventory_categories').delete().eq('id', oldMinoxiddil.id);
    if (error) {
      console.log(`  ❌ Failed to delete old "Minoxiddil": ${error.message}`);
    } else {
      console.log(`  ✅ Deleted old category "Minoxiddil"`);
    }
  }

  // Find old "Produtos de Limpeza" category
  const oldProdLimp = cats?.find(c => c.name === 'Produtos de Limpeza');
  const correctProdLimp = cats?.find(c => c.code_prefix === '6'); // Produto de Limpeza

  if (oldProdLimp && correctProdLimp && oldProdLimp.id !== correctProdLimp.id) {
    const { data: orphanProducts } = await supabase.from('inventory_products')
      .select('id, name').eq('category_id', oldProdLimp.id);
    
    if (orphanProducts && orphanProducts.length > 0) {
      const { error } = await supabase.from('inventory_products')
        .update({ category_id: correctProdLimp.id })
        .eq('category_id', oldProdLimp.id);
      console.log(`  🔄 Moved ${orphanProducts.length} products from "Produtos de Limpeza" to "Produto de Limpeza"`);
    }
    
    const { error } = await supabase.from('inventory_categories').delete().eq('id', oldProdLimp.id);
    if (error) {
      console.log(`  ❌ Failed to delete old "Produtos de Limpeza": ${error.message}`);
    } else {
      console.log(`  ✅ Deleted old category "Produtos de Limpeza"`);
    }
  }

  // 3. Also check for any products without a valid category 
  const { data: orphans } = await supabase.from('inventory_products')
    .select('id, name, external_code, category_id')
    .is('category_id', null);
  
  if (orphans && orphans.length > 0) {
    console.log(`\n  ⚠️ Products without category: ${orphans.length}`);
    for (const p of orphans) {
      const prefix = p.external_code?.split('_')[0];
      if (prefix) {
        const cat = cats?.find(c => c.code_prefix === prefix);
        if (cat) {
          await supabase.from('inventory_products').update({ category_id: cat.id }).eq('id', p.id);
          console.log(`    Fixed: ${p.external_code} "${p.name}" → ${cat.name}`);
        }
      }
    }
  }

  // 4. Final count
  const { count: catCount } = await supabase.from('inventory_categories').select('id', { count: 'exact', head: true });
  const { count: pmCount } = await supabase.from('payment_methods').select('id', { count: 'exact', head: true });
  console.log(`\n  Final: ${catCount} categories, ${pmCount} payment methods`);
  console.log('\n━━━ FIXES COMPLETE ━━━\n');
}

fix().catch(err => {
  console.error('Fix error:', err);
  process.exit(1);
});
