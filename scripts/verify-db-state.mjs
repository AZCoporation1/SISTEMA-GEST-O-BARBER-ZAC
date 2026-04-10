import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://gyausvxjrpkheennijiv.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// Check view
const { data: v, error: ve } = await supabase.from('vw_inventory_position').select('is_active').limit(1)
if (ve) { console.log('VIEW_STATUS: BROKEN -', ve.message) }
else { console.log('VIEW_STATUS: OK, is_active=' + (v[0]?.is_active !== undefined ? 'EXISTS' : 'MISSING')) }

// Count products
const { count: total } = await supabase.from('vw_inventory_position').select('*', { count: 'exact', head: true })
console.log('TOTAL_PRODUCTS:', total)

// Active cats
const { data: aCats } = await supabase.from('inventory_categories').select('name').eq('is_active', true).order('name')
console.log('ACTIVE_CATS:', aCats?.length, '-', aCats?.map(c => c.name).join(', '))

// Inactive cats
const { data: iCats } = await supabase.from('inventory_categories').select('name').eq('is_active', false).order('name')
console.log('INACTIVE_CATS:', iCats?.length, '-', iCats?.map(c => c.name).join(', '))

// Active brands
const { data: aBrands } = await supabase.from('product_brands').select('name').eq('is_active', true).order('name')
console.log('ACTIVE_BRANDS:', aBrands?.length, '-', aBrands?.map(b => b.name).join(', '))

// Inactive brands
const { data: iBrands } = await supabase.from('product_brands').select('name').eq('is_active', false).order('name')
console.log('INACTIVE_BRANDS:', iBrands?.length, '-', iBrands?.map(b => b.name).join(', '))

// Check dirty active data
const dirtyPatterns = aCats?.filter(c => /^\s*[\d.,]+\s*$/.test(c.name) || /^\s*R?\$/.test(c.name) || c.name.trim() === '')
console.log('DIRTY_ACTIVE_CATS:', dirtyPatterns?.length || 0)

const dirtyBrands = aBrands?.filter(b => /^\s*[\d.,]+\s*$/.test(b.name) || /^\s*R?\$/.test(b.name) || b.name.trim() === '')
console.log('DIRTY_ACTIVE_BRANDS:', dirtyBrands?.length || 0)
