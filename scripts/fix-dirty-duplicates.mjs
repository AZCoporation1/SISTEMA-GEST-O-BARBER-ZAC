import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://gyausvxjrpkheennijiv.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// These are the dirty "Perf" (lowercase) duplicate products.
// Each has a clean "PERF" (uppercase) counterpart with proper brand data.
// We will soft-delete (set is_active=false) and mark deleted_at on duplicates.
const dirtyProductIds = [
  '324477a6-f2f9-4196-9094-f26fe1ef2f5b', // Perf 006 Angel (dirty brand R$ 60,00)
  '9ccfb3e5-4b6b-4f7c-bec0-1204f788dec6', // Perf 011 Assad (dirty brand R$ 149,00)
  '252eb6a0-a044-4a68-a1ee-dbfb554856a0', // Perf 015 Attar Al Wesal (dirty brand R$ 400,00)
  '539eb6a1-1d07-4b4e-b12b-3490888eee88', // Perf 017 Bacara (dirty)
  '3aba13d5-5166-46c8-848c-f1260867b77f', // Perf 018 Bade Al Oud (dirty brand R$ 480,00)
  '94de2a61-6bb7-49ef-a6f3-b946f012f732', // Perf 023 Cluib Di Nuit (dirty brand R$ 110,00)
  '596e9027-6000-4837-b53e-2342589f9816', // Perf 026 Eternal Toch (dirty brand R$ 120,00)
  'b28466ed-212b-4713-ad66-01a3c6fc6250', // Perf 032 Jubilant-Noir (dirty brand R$ 120,00)
  '2fdb1361-e98f-496d-8b98-f1a217810dba', // Perf 033 Jubilant-Oro (dirty brand R$ 120,00)
  '70cbbfef-4695-49c6-b95f-4e632a880246', // Perf 037 Kharmrah (dirty brand R$ 180,00)
  '2dc9731e-0db9-47e6-9ffb-4ec053cdd7f4', // Perf 044 Monocline (dirty brand R$ 120,00)
  '06238b83-d24c-4e59-a83e-5af7e327e6e4', // Perf 051 Pink Velvet (dirty brand R$ 200,00)
  '98d34854-2ecf-4b60-8b6e-accc2ec1676a', // Perf 065 Yara (dirty brand R$ 380,00)
]

console.log(`Soft-deleting ${dirtyProductIds.length} dirty duplicate products...`)

const { data, error } = await supabase
  .from('inventory_products')
  .update({ 
    is_active: false, 
    deleted_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  .in('id', dirtyProductIds)
  .select('id, name, external_code')

if (error) {
  console.error('ERROR:', error.message)
} else {
  console.log(`✅ Soft-deleted ${data.length} products:`)
  data.forEach(p => console.log(`   - ${p.external_code} ${p.name}`))
}

// Now deactivate the orphaned dirty brands
console.log('\nDeactivating orphaned dirty brands...')

// Get brand IDs used by dirty products
const dirtyBrandIds = [
  '2fa91424-4959-4440-b6a6-452f65dd0e5f', // R$ 60,00
  '7699d763-b524-4f2b-947b-9cc96b66399d', // R$ 149,00
  '789a63d8-36de-4224-a6db-adcc24847acd', // R$ 400,00
  '36b74b62-92ca-492f-b164-7e59c9cf1e56', // dirty brand for Bacara
  '8e8905a9-9264-4aa1-a7e2-57af1d9a7991', // R$ 480,00
  'd9244cef-0bf9-4ca4-9140-13791e020f48', // R$ 110,00
  '19ffa486-bc27-47b6-94b1-e71a8bcb0045', // R$ 120,00 (multiple products)
  '1e9307e9-d547-4c63-9b2f-3f465232bb3e', // R$ 180,00
  '17b95f8f-accf-49f3-b425-5823a5e9a110', // R$ 200,00
  '7b2c80c5-a5c7-47bc-8183-8cf6ca9f5807', // R$ 380,00
]

// Check if any active products still use these brands (besides the ones we just deleted)
for (const brandId of dirtyBrandIds) {
  const { data: activeProds } = await supabase
    .from('inventory_products')
    .select('id')
    .eq('brand_id', brandId)
    .eq('is_active', true)
    .is('deleted_at', null)
  
  if (!activeProds || activeProds.length === 0) {
    const { error: bErr } = await supabase
      .from('product_brands')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', brandId)
    
    if (bErr) console.log(`  ⚠️ Could not deactivate brand ${brandId}: ${bErr.message}`)
    else console.log(`  ✅ Deactivated brand ${brandId}`)
  } else {
    console.log(`  ⏭️ Brand ${brandId} still has ${activeProds.length} active products, skipping`)
  }
}

// Verify final state
console.log('\n=== VERIFICATION ===')
const { data: remaining } = await supabase
  .from('vw_inventory_position')
  .select('product_id, product_name, external_code, brand_name')
  .or('brand_name.ilike.%R$%,brand_name.ilike.%$%')

console.log(`Remaining products with dirty brands: ${remaining?.length || 0}`)
if (remaining?.length) {
  remaining.forEach(p => console.log(`  - ${p.external_code} ${p.product_name} brand="${p.brand_name}"`))
}

const { count } = await supabase
  .from('vw_inventory_position')
  .select('*', { count: 'exact', head: true })

console.log(`Total products in view: ${count}`)
