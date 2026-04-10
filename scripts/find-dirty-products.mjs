import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'

const supabase = createClient(
  'https://gyausvxjrpkheennijiv.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const out = []
const log = (msg) => { out.push(msg); console.log(msg) }

// 1. Products with dirty brand names
const { data: dirtyBrandProducts } = await supabase
  .from('vw_inventory_position')
  .select('product_id, product_name, external_code, brand_name, category_name')
  .or('brand_name.ilike.%R$%,brand_name.ilike.%$%')

log('=== DIRTY BRAND PRODUCTS ===')
for (const p of (dirtyBrandProducts || [])) {
  log(`  ${p.external_code} | ${p.product_name} | brand="${p.brand_name}" | cat="${p.category_name}"`)
}

// 2. Find the dirty brand IDs
const { data: dirtyBrands } = await supabase
  .from('product_brands')
  .select('id, name, is_active')
  .eq('is_active', true)

const dirty = dirtyBrands?.filter(b => /R?\$/.test(b.name) || /^\s*[\d.,]+\s*$/.test(b.name))
log('\n=== DIRTY ACTIVE BRANDS ===')
for (const b of (dirty || [])) {
  log(`  id=${b.id} name="${b.name}"`)
}

// 3. Duplicate SKUs
const { data: allProds } = await supabase
  .from('inventory_products')
  .select('id, name, external_code, brand_id, is_active')
  .is('deleted_at', null)
  .not('external_code', 'is', null)
  .order('external_code')

const codeMap = new Map()
allProds?.forEach(p => {
  const key = p.external_code?.toUpperCase()
  if (!codeMap.has(key)) codeMap.set(key, [])
  codeMap.get(key).push(p)
})

log('\n=== DUPLICATE SKUS ===')
for (const [code, prods] of codeMap) {
  if (prods.length > 1) {
    log(`  ${code} (${prods.length} entries):`)
    for (const p of prods) {
      log(`    id=${p.id} code="${p.external_code}" name="${p.name}" brand=${p.brand_id} active=${p.is_active}`)
    }
  }
}

// 4. Lowercase Perf codes
const lowerPerf = allProds?.filter(p => p.external_code && /^Perf/.test(p.external_code))
log('\n=== LOWERCASE PERF CODES ===')
for (const p of (lowerPerf || [])) {
  log(`  id=${p.id} code="${p.external_code}" name="${p.name}" brand=${p.brand_id}`)
}

writeFileSync('scripts/dirty-data-report.txt', out.join('\n'), 'utf-8')
log('\nReport saved to scripts/dirty-data-report.txt')
