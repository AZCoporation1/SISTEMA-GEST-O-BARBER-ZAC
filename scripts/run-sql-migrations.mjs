/**
 * Barber Zac — Run SQL Migrations on Supabase
 * Executes 20260331_estoque_filter_fix.sql and cleanup_dirty_data.sql in order.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = 'https://gyausvxjrpkheennijiv.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set. Pass it as env var.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
})

async function runSQL(label, filePath) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`▶ Running: ${label}`)
  console.log(`  File: ${filePath}`)
  console.log('='.repeat(60))

  const sql = readFileSync(filePath, 'utf-8')
  
  const { data, error } = await supabase.rpc('exec_sql', { query: sql })
  
  if (error) {
    // If exec_sql RPC doesn't exist, try using the REST API directly
    console.log('  ℹ️  exec_sql RPC not available, using pg_query endpoint...')
    
    // Use the Supabase SQL endpoint directly via fetch
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ query: sql })
    })
    
    if (!res.ok) {
      const errText = await res.text()
      console.error(`  ❌ Failed: ${errText}`)
      return false
    }
    
    console.log(`  ✅ ${label} executed successfully!`)
    return true
  }
  
  console.log(`  ✅ ${label} executed successfully!`)
  return true
}

async function runSQLDirect(label, sql) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`▶ Running: ${label}`)
  console.log('='.repeat(60))
  
  // Split SQL by statement boundaries (semicolons not inside strings)
  // Execute each statement separately
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
  
  let successes = 0
  let failures = 0
  
  for (const stmt of statements) {
    if (!stmt || stmt.startsWith('--')) continue
    
    // Skip pure comment blocks
    const cleanStmt = stmt.replace(/--[^\n]*/g, '').trim()
    if (!cleanStmt) continue
    
    const fullStmt = stmt.endsWith(';') ? stmt : stmt + ';'
    
    try {
      const { error } = await supabase.rpc('exec_sql', { query: fullStmt })
      if (error) {
        // Try via postgres endpoint
        const res = await fetch(`${SUPABASE_URL}/pg/query`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: fullStmt })
        })
        
        if (!res.ok) {
          console.error(`  ⚠️  Statement failed: ${cleanStmt.substring(0, 80)}...`)
          failures++
        } else {
          successes++
        }
      } else {
        successes++
      }
    } catch (e) {
      console.error(`  ⚠️  Error: ${e.message}`)
      failures++
    }
  }
  
  console.log(`  📊 Results: ${successes} succeeded, ${failures} failed`)
  return failures === 0
}

async function verifyData() {
  console.log(`\n${'='.repeat(60)}`)
  console.log('▶ Verification: Checking data state...')
  console.log('='.repeat(60))
  
  // Check active categories
  const { data: cats, error: catErr } = await supabase
    .from('inventory_categories')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name')
  
  if (catErr) {
    console.error('  ❌ Category check failed:', catErr.message)
  } else {
    console.log(`\n  📁 Active Categories (${cats.length}):`)
    cats.forEach(c => console.log(`     - ${c.name}`))
  }
  
  // Check active brands
  const { data: brands, error: brandErr } = await supabase
    .from('product_brands')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name')
  
  if (brandErr) {
    console.error('  ❌ Brand check failed:', brandErr.message)
  } else {
    console.log(`\n  🏷️  Active Brands (${brands.length}):`)
    brands.forEach(b => console.log(`     - ${b.name}`))
  }
  
  // Check view is_active column
  const { data: viewSample, error: viewErr } = await supabase
    .from('vw_inventory_position')
    .select('product_id, product_name, is_active, stock_status, category_name, brand_name')
    .limit(5)
  
  if (viewErr) {
    console.error('  ❌ View check failed:', viewErr.message)
    console.error('     Error details:', viewErr)
  } else {
    console.log(`\n  📊 View sample (first 5 products):`)
    viewSample.forEach(p => {
      console.log(`     - [${p.is_active ? 'ACTIVE' : 'INACTIVE'}] ${p.product_name} | Cat: ${p.category_name || 'N/A'} | Brand: ${p.brand_name || 'N/A'} | Stock: ${p.stock_status}`)
    })
  }
  
  // Count total products in view
  const { count } = await supabase
    .from('vw_inventory_position')
    .select('product_id', { count: 'exact', head: true })
  
  console.log(`\n  📦 Total products in view: ${count}`)
  
  // Count by stock status
  const { data: allProducts } = await supabase
    .from('vw_inventory_position')
    .select('stock_status, is_active')
    
  if (allProducts) {
    const statusCounts = {}
    const activeCounts = { active: 0, inactive: 0 }
    allProducts.forEach(p => {
      statusCounts[p.stock_status] = (statusCounts[p.stock_status] || 0) + 1
      if (p.is_active) activeCounts.active++
      else activeCounts.inactive++
    })
    console.log(`\n  📊 By Stock Status:`)
    Object.entries(statusCounts).forEach(([k, v]) => console.log(`     - ${k}: ${v}`))
    console.log(`\n  📊 By Active/Inactive:`)
    console.log(`     - Active: ${activeCounts.active}`)
    console.log(`     - Inactive: ${activeCounts.inactive}`)
  }
  
  // Check filter compatibility: categories referenced by products
  const { data: usedCats } = await supabase
    .from('inventory_products')
    .select('category_id')
    .not('category_id', 'is', null)
    .is('deleted_at', null)
  
  const uniqueCatIds = [...new Set((usedCats || []).map(r => r.category_id).filter(Boolean))]
  
  const { data: filterCats } = await supabase
    .from('inventory_categories')
    .select('id, name')
    .eq('is_active', true)
    .in('id', uniqueCatIds)
    .order('name')
  
  console.log(`\n  🔍 Filter-ready Categories (active + referenced): ${filterCats?.length || 0}`)
  filterCats?.forEach(c => console.log(`     - ${c.name}`))
  
  // Same for brands
  const { data: usedBrands } = await supabase
    .from('inventory_products')
    .select('brand_id')
    .not('brand_id', 'is', null)
    .is('deleted_at', null)
  
  const uniqueBrandIds = [...new Set((usedBrands || []).map(r => r.brand_id).filter(Boolean))]
  
  const { data: filterBrands } = await supabase
    .from('product_brands')
    .select('id, name')
    .eq('is_active', true)
    .in('id', uniqueBrandIds.length > 0 ? uniqueBrandIds : ['00000000-0000-0000-0000-000000000000'])
    .order('name')
  
  console.log(`\n  🔍 Filter-ready Brands (active + referenced): ${filterBrands?.length || 0}`)
  filterBrands?.forEach(b => console.log(`     - ${b.name}`))
}

// Main execution
console.log('🔧 Barber Zac — SQL Migration Runner')
console.log(`📅 ${new Date().toISOString()}`)

// Just run verification to check current state and see if migrations were already applied
await verifyData()

console.log(`\n\n${'='.repeat(60)}`)
console.log('✅ VERIFICATION COMPLETE')
console.log('='.repeat(60))
console.log('\n⚠️  NOTE: The SQL migrations (view creation + data cleanup)')
console.log('   need to be run directly in the Supabase SQL Editor.')
console.log('   Copy-paste each file and run manually:')
console.log('   1. supabase/migrations/20260331_estoque_filter_fix.sql')
console.log('   2. scripts/cleanup_dirty_data.sql')
console.log('\n   Go to: https://supabase.com/dashboard → SQL Editor')
