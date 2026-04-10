import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://gyausvxjrpkheennijiv.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// Verify: any remaining dirty brand products?
const { data: remaining } = await supabase
  .from('vw_inventory_position')
  .select('product_id, product_name, external_code, brand_name')
  .or('brand_name.ilike.%R$%,brand_name.ilike.%$%')

console.log('Dirty brand products remaining:', remaining?.length || 0)
if (remaining?.length) remaining.forEach(p => console.log(`  ${p.external_code} ${p.product_name} brand="${p.brand_name}"`))

// Verify: any lowercase "Perf" codes still visible?
const { data: lowerPerf } = await supabase
  .from('vw_inventory_position')
  .select('product_id, product_name, external_code')
  .ilike('external_code', 'Perf%')

console.log('Lowercase Perf codes remaining:', lowerPerf?.length || 0)

// Total products
const { count } = await supabase
  .from('vw_inventory_position')
  .select('*', { count: 'exact', head: true })
console.log('Total products in view:', count)

// Active brands with no products
const { data: activeBrands } = await supabase
  .from('product_brands')
  .select('id, name')
  .eq('is_active', true)
  .order('name')

console.log(`Active brands: ${activeBrands?.length}`)
for (const b of activeBrands || []) {
  const { count: prodCount } = await supabase
    .from('inventory_products')
    .select('*', { count: 'exact', head: true })
    .eq('brand_id', b.id)
    .is('deleted_at', null)
  console.log(`  ${b.name}: ${prodCount} products`)
}

// Active categories
const { data: activeCats } = await supabase
  .from('inventory_categories')
  .select('id, name')
  .eq('is_active', true)
  .order('name')

console.log(`\nActive categories: ${activeCats?.length}`)
activeCats?.forEach(c => console.log(`  ${c.name}`))
