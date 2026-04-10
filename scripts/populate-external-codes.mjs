/**
 * One-time script to populate external_code in inventory_products
 * from the spreadsheet code mapping.
 * 
 * Matches products by normalized name (lowercase, trimmed).
 * Run with: node scripts/populate-external-codes.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Read .env.local for Supabase credentials
const envPath = resolve(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
envContent.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) env[key.trim()] = rest.join('=').trim()
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Spreadsheet code mapping (extracted from xlsx)
const codeMap = JSON.parse(readFileSync('/tmp/product_codes.json', 'utf-8'))

async function main() {
  console.log(`Loaded ${codeMap.length} codes from spreadsheet`)

  // Fetch all products from DB
  const { data: products, error } = await supabase
    .from('inventory_products')
    .select('id, name, normalized_name, external_code')

  if (error) {
    console.error('Error fetching products:', error.message)
    process.exit(1)
  }

  console.log(`Found ${products.length} products in database`)

  // Build normalized name maps
  const normalize = (s) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  let updated = 0
  let skipped = 0
  let notFound = 0

  for (const entry of codeMap) {
    const normalizedCode = normalize(entry.name)
    
    // Find best match
    const match = products.find(p => {
      const pNorm = normalize(p.name)
      return pNorm === normalizedCode || 
             pNorm.startsWith(normalizedCode) || 
             normalizedCode.startsWith(pNorm)
    })

    if (match) {
      if (match.external_code === entry.code) {
        skipped++
        continue
      }

      const { error: updateError } = await supabase
        .from('inventory_products')
        .update({ external_code: entry.code })
        .eq('id', match.id)

      if (updateError) {
        console.error(`  ✗ Failed to update ${match.name}: ${updateError.message}`)
      } else {
        console.log(`  ✓ ${entry.code} → ${match.name}`)
        updated++
      }
    } else {
      console.log(`  ? No match for: "${entry.name}" (code: ${entry.code})`)
      notFound++
    }
  }

  console.log(`\nDone! Updated: ${updated}, Skipped (already set): ${skipped}, Not found: ${notFound}`)
}

main().catch(console.error)
