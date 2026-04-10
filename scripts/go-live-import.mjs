/**
 * Go-live Import-Only (Step 3 fix)
 * Re-runs ONLY the import with header row auto-detection.
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { createRequire } from 'module'
import { resolve } from 'path'
import { writeFileSync } from 'fs'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SMART_SKU_REGEX = /^(PERF|BEBI|INSU)\s+\d{1,3}$/i

function cleanCurrency(val) {
  if (!val && val !== 0) return 0
  if (typeof val === 'number') return val
  const s = String(val).replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.').trim()
  return parseFloat(s) || 0
}
function cleanPercent(val) {
  if (!val && val !== 0) return 0
  if (typeof val === 'number') return val
  const s = String(val).replace('%', '').trim().replace(',', '.')
  return parseFloat(s) || 0
}
function cleanStock(val) {
  if (!val && val !== 0) return 0
  if (typeof val === 'number') return Math.max(0, Math.ceil(val))
  const s = String(val).replace(',', '.').trim()
  return Math.max(0, Math.ceil(parseFloat(s) || 0))
}

async function main() {
  const log = []
  const print = (msg) => { console.log(msg); log.push(msg) }
  
  print('═══ STEP 3: Import Revised Spreadsheet (with header fix) ═══')
  
  const filePath = resolve('..', 'Inventario para sistema Barber Zac revisada.xlsx')
  const wb = XLSX.readFile(filePath)
  
  // Only visible sheets
  const visibleSheets = wb.SheetNames.filter((name, idx) => {
    const hidden = wb.Workbook?.Sheets?.[idx]?.Hidden
    return !hidden || hidden === 0
  })
  print(`Visible sheets: ${visibleSheets.join(', ')}`)

  // Parse with header row auto-detection
  const allRows = []
  for (const sheetName of visibleSheets) {
    const ws = wb.Sheets[sheetName]
    if (!ws || !ws['!ref']) continue
    
    // Find header row
    const rawArrayRows = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 })
    const hdrIdx = rawArrayRows.findIndex(r => String(r[0] || '').trim() === 'Item')
    
    let sheetRows
    if (hdrIdx >= 0) {
      sheetRows = XLSX.utils.sheet_to_json(ws, { defval: '', range: hdrIdx })
      print(`  ${sheetName}: header at row ${hdrIdx}, ${sheetRows.length} data rows`)
    } else {
      sheetRows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      print(`  ${sheetName}: fallback parsing, ${sheetRows.length} rows`)
    }
    allRows.push(...sheetRows)
  }
  print(`Total normalized rows: ${allRows.length}`)

  // Normalize
  const normalizedRows = allRows.map(r => {
    const codigo = String(r['Item'] || r['CÓDIGO'] || '').trim()
    const nome = String(r['Descrição'] || r['PRODUTOS'] || '').trim()
    const categoria = String(r['Categoria'] || r['CATEGORIA'] || 'Sem Categoria').trim()
    const marca = String(r['Marca'] || r['MARCA'] || '').trim()
    const custo = cleanCurrency(r['Valor R$ Compra'] || r['CUSTO'] || r['Custo'])
    const markup = cleanPercent(r['Porcentagem %'] || r['%'])
    const precoVenda = cleanCurrency(r['Valor Venda'] || r['Valor a Vista'])
    const saldo = cleanStock(r['Estoque'] || r['Estoque dia'] || r['Estoque Dia'] || r['Saldo Estoque'])
    const minStock = cleanStock(r['Qtde Minimo'] || r['MINIMO'])
    const maxStock = cleanStock(r['Qtde Maximo'] || r['Maximo'])

    return { codigo, nome, categoria, marca, custo, markup, precoVenda, saldo, minStock, maxStock }
  }).filter(r => r.codigo && r.nome)

  // Filter Smart SKU rows
  const skuRows = normalizedRows.filter(r => SMART_SKU_REGEX.test(r.codigo))
  print(`Valid Smart SKU rows: ${skuRows.length}`)
  
  // Show breakdown by prefix
  const perfCount = skuRows.filter(r => r.codigo.toUpperCase().startsWith('PERF')).length
  const bebiCount = skuRows.filter(r => r.codigo.toUpperCase().startsWith('BEBI')).length
  const insuCount = skuRows.filter(r => r.codigo.toUpperCase().startsWith('INSU')).length
  print(`  PERF: ${perfCount}, BEBI: ${bebiCount}, INSU: ${insuCount}`)

  if (skuRows.length === 0) {
    print('⚠️ No valid Smart SKU rows. Aborting.')
    writeFileSync('golive_import_result.txt', log.join('\n'), 'utf8')
    return
  }

  // Resolve categories
  const { data: existingCats } = await supabase.from('inventory_categories').select('id, name')
  const categoryMap = new Map()
  if (existingCats) existingCats.forEach(c => categoryMap.set(c.name.toLowerCase().trim(), c.id))

  const { data: existingBrands } = await supabase.from('product_brands').select('id, name')
  const brandMap = new Map()
  if (existingBrands) existingBrands.forEach(b => brandMap.set(b.name.toLowerCase().trim(), b.id))

  let newCats = 0, newBrands = 0
  for (const row of skuRows) {
    const catKey = row.categoria.toLowerCase().trim()
    if (catKey && catKey !== 'sem categoria' && !categoryMap.has(catKey)) {
      const { data: newCat } = await supabase.from('inventory_categories').insert({
        name: row.categoria, normalized_name: catKey, is_active: true, sort_order: 0
      }).select().single()
      if (newCat) { categoryMap.set(catKey, newCat.id); newCats++ }
    }
    if (row.marca) {
      const brandKey = row.marca.toLowerCase().trim()
      if (brandKey && !brandMap.has(brandKey)) {
        const { data: newBrand } = await supabase.from('product_brands').insert({
          name: row.marca, normalized_name: brandKey, is_active: true
        }).select().single()
        if (newBrand) { brandMap.set(brandKey, newBrand.id); newBrands++ }
      }
    }
  }
  print(`Categories: ${categoryMap.size} total (${newCats} new)`)
  print(`Brands: ${brandMap.size} total (${newBrands} new)`)

  // Fetch existing products for cost preservation
  const codes = skuRows.map(r => r.codigo)
  const { data: existingProds } = await supabase
    .from('inventory_products')
    .select('id, external_code, cost_price')
    .in('external_code', codes)

  const existingCostMap = new Map()
  if (existingProds) existingProds.forEach(p => {
    if (p.external_code) existingCostMap.set(p.external_code.toUpperCase().trim(), p.cost_price || 0)
  })
  print(`Existing products matched by code: ${existingCostMap.size}`)

  // Resolve flags
  const resolveFlags = (code) => {
    const u = code.toUpperCase().trim()
    if (u.startsWith('PERF')) return { is_for_resale: true, is_for_internal_use: false }
    if (u.startsWith('BEBI')) return { is_for_resale: true, is_for_internal_use: false }
    return { is_for_resale: true, is_for_internal_use: true }
  }

  // Build upsert payload
  let zeroCostCount = 0
  const upsertData = skuRows.map(r => {
    let safeMaxStock = r.maxStock
    if (!safeMaxStock || safeMaxStock <= 0) safeMaxStock = Math.max((r.minStock || 0) + 1, 10)
    if (safeMaxStock <= (r.minStock || 0)) safeMaxStock = (r.minStock || 0) + 1

    let costPrice = r.custo || 0
    if (costPrice === 0) {
      const existing = existingCostMap.get(r.codigo.toUpperCase().trim())
      if (existing && existing > 0) costPrice = existing
    }
    if (costPrice === 0) zeroCostCount++

    const flags = resolveFlags(r.codigo)
    return {
      external_code: r.codigo,
      name: r.nome,
      normalized_name: r.nome.toLowerCase().trim(),
      category_id: categoryMap.get(r.categoria.toLowerCase().trim()) || null,
      brand_id: r.marca ? brandMap.get(r.marca.toLowerCase().trim()) || null : null,
      cost_price: costPrice,
      markup_percent: r.markup || 0,
      min_stock: r.minStock || 0,
      max_stock: safeMaxStock,
      is_for_resale: flags.is_for_resale,
      is_for_internal_use: flags.is_for_internal_use,
      is_active: true,
      unit_type: 'UN'
    }
  })

  print(`Upserting ${upsertData.length} products (${zeroCostCount} with zero cost)...`)

  const { data: upsertedProducts, error: upsertError } = await supabase
    .from('inventory_products')
    .upsert(upsertData, { onConflict: 'external_code', ignoreDuplicates: false })
    .select('id, external_code')

  if (upsertError) {
    print(`❌ Upsert failed: ${upsertError.message}`)
    writeFileSync('golive_import_result.txt', log.join('\n'), 'utf8')
    return
  }

  print(`✅ Upserted: ${upsertedProducts.length} products`)

  // Stock movements
  const productIds = upsertedProducts.map(p => p.id)
  const { data: positions } = await supabase
    .from('vw_inventory_position')
    .select('product_id, current_balance')
    .in('product_id', productIds)

  const posMap = new Map()
  if (positions) positions.forEach(p => posMap.set(p.product_id, p.current_balance))

  const movements = []
  for (const row of skuRows) {
    const dbP = upsertedProducts.find(p => p.external_code === row.codigo)
    if (!dbP) continue
    const target = row.saldo
    const current = posMap.get(dbP.id) || 0
    const diff = target - current
    if (diff !== 0 && !isNaN(diff) && isFinite(diff)) {
      movements.push({
        product_id: dbP.id,
        movement_type: diff > 0 ? (current === 0 ? 'initial_balance' : 'manual_adjustment_in') : 'manual_adjustment_out',
        movement_reason: 'Ajuste via Planilha/Importação',
        source_type: 'import_wizard',
        destination_type: 'inventory',
        quantity: diff,
        movement_date: new Date().toISOString(),
        notes: `Go-live sync. Target: ${target}`
      })
    }
  }

  if (movements.length > 0) {
    const { error: moveError } = await supabase.from('stock_movements').insert(movements)
    if (moveError) {
      print(`❌ Stock movements failed: ${moveError.message}`)
    } else {
      print(`✅ Stock movements: ${movements.length}`)
    }
  } else {
    print(`ℹ️ No stock adjustments needed`)
  }

  // Audit
  await supabase.from('audit_logs').insert({
    action: 'IMPORT',
    entity_type: 'inventory_products',
    entity_id: 'go_live_import',
    after_data: { products: upsertedProducts.length, movements: movements.length, zeroCost: zeroCostCount },
    context: { source: 'system', status: 'success', observation: `Go-live import: ${upsertedProducts.length} produtos, ${movements.length} movimentos, ${zeroCostCount} sem custo.` }
  })

  // Final summary
  print('\n═══ IMPORT RESULT ═══')
  print(`Products upserted: ${upsertedProducts.length}`)
  print(`Stock movements: ${movements.length}`)
  print(`Zero cost (need review): ${zeroCostCount}`)
  print(`New categories: ${newCats}`)
  print(`New brands: ${newBrands}`)

  // Verification queries
  const { data: allProds } = await supabase.from('inventory_products').select('id, external_code, cost_price, is_for_resale').is('deleted_at', null)
  const total = allProds?.length || 0
  const withSKU = allProds?.filter(p => p.external_code && SMART_SKU_REGEX.test(p.external_code.trim())).length || 0
  const zc = allProds?.filter(p => !p.cost_price || p.cost_price === 0).length || 0
  const resale = allProds?.filter(p => p.is_for_resale).length || 0

  const { data: stocked } = await supabase.from('vw_inventory_position').select('product_id, current_balance').gt('current_balance', 0)
  const { count: auditCount } = await supabase.from('audit_logs').select('id', { count: 'exact', head: true })

  print('\n═══ FINAL STATE ═══')
  print(`Total products: ${total}`)
  print(`With Smart SKU: ${withSKU}`)
  print(`Without Smart SKU: ${total - withSKU}`)
  print(`Zero cost: ${zc}`)
  print(`For resale (POS): ${resale}`)
  print(`With stock > 0: ${stocked?.length || 0}`)
  print(`Audit entries: ${auditCount || 0}`)
  print(`Status: ${withSKU === total ? '✅ ALL SMART SKU' : '⚠️ SOME MISSING'}`)

  writeFileSync('golive_import_result.txt', log.join('\n'), 'utf8')
  print('\nDone. Results saved to golive_import_result.txt')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
