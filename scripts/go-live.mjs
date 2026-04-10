/**
 * Barber Zac ERP — Go-Live Script
 * Runs backfill (Smart SKU) + bootstrap (payment methods) directly via service role.
 * 
 * Usage: node scripts/go-live.mjs
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { resolve } from 'path'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ═══════════════════════════════════════════════
// SMART SKU PREFIXES
// ═══════════════════════════════════════════════
const SMART_SKU_REGEX = /^(PERF|BEBI|INSU)\s+\d{1,3}$/i

function isValidSmartSKU(code) {
  if (!code) return false
  return SMART_SKU_REGEX.test(code.trim())
}

function formatSmartSKU(prefix, num) {
  return `${prefix} ${String(num).padStart(3, '0')}`
}

function resolvePrefix(categoryName) {
  if (!categoryName) return 'INSU'
  const lower = categoryName.toLowerCase().trim()

  if (lower.includes('perfum') || lower.includes('amadeirad') || lower.includes('oriental')
    || lower.includes('floral') || lower.includes('aromátic') || lower.includes('fougère')
    || lower.includes('bergamot') || lower.includes('baunilha') || lower.includes('especiad')
    || lower.includes('bolso') || lower.includes('cabelo') || lower.includes('frutado')
    || lower.includes('gourmet')) {
    return 'PERF'
  }

  if (lower.includes('bebid') || lower.includes('refrigerant') || lower.includes('energétic')
    || lower.includes('água') || lower.includes('cervej') || lower.includes('conveniênc')
    || lower.includes('coca') || lower.includes('suco')) {
    return 'BEBI'
  }

  return 'INSU'
}

// ═══════════════════════════════════════════════
// STEP 1: BACKFILL SMART SKUs
// ═══════════════════════════════════════════════
async function backfillSmartSKUs() {
  console.log('\n══════════════════════════════════════════')
  console.log('  STEP 1: Smart SKU Backfill')
  console.log('══════════════════════════════════════════')

  // Read all products
  const { data: products, error: prodError } = await supabase
    .from('inventory_products')
    .select('id, external_code, name, normalized_name, category_id, is_for_resale, is_for_internal_use')
    .is('deleted_at', null)
    .order('name')

  if (prodError) {
    console.error('❌ Failed to read products:', prodError.message)
    return false
  }

  console.log(`  📦 Total products: ${products.length}`)

  if (products.length === 0) {
    console.log('  ⚠️ No products found. Skipping backfill.')
    return true
  }

  // Read categories
  const { data: categories } = await supabase
    .from('inventory_categories')
    .select('id, name')

  const categoryMap = new Map()
  if (categories) categories.forEach(c => categoryMap.set(c.id, c.name))

  // Separate valid vs needs-migration
  const alreadyValid = []
  const needsMigration = []

  for (const p of products) {
    if (p.external_code && isValidSmartSKU(p.external_code)) {
      alreadyValid.push(p.external_code.toUpperCase().trim())
    } else {
      const catName = p.category_id ? categoryMap.get(p.category_id) || null : null
      const prefix = resolvePrefix(catName)
      needsMigration.push({ id: p.id, name: p.name, categoryName: catName, prefix })
    }
  }

  console.log(`  ✅ Already valid Smart SKU: ${alreadyValid.length}`)
  console.log(`  🔄 Need migration: ${needsMigration.length}`)

  if (needsMigration.length === 0) {
    console.log('  ✅ All products already have valid Smart SKUs.')
    return true
  }

  // Find max existing numbers per prefix
  const maxNumbers = { PERF: 0, BEBI: 0, INSU: 0 }
  for (const code of alreadyValid) {
    const match = code.match(/^(PERF|BEBI|INSU)\s+(\d+)$/i)
    if (match) {
      const p = match[1].toUpperCase()
      const n = parseInt(match[2], 10)
      if (n > maxNumbers[p]) maxNumbers[p] = n
    }
  }

  console.log(`  📊 Max existing: PERF=${maxNumbers.PERF}, BEBI=${maxNumbers.BEBI}, INSU=${maxNumbers.INSU}`)

  // Group by prefix and assign codes
  const grouped = { PERF: [], BEBI: [], INSU: [] }
  needsMigration.forEach(p => grouped[p.prefix].push(p))

  let successCount = 0
  const errors = []

  for (const prefix of ['PERF', 'BEBI', 'INSU']) {
    const group = grouped[prefix].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    let counter = maxNumbers[prefix]

    for (const product of group) {
      counter++
      const newCode = formatSmartSKU(prefix, counter)

      if (alreadyValid.includes(newCode.toUpperCase())) {
        console.log(`  ⚠️ Collision skipped: ${newCode} for "${product.name}"`)
        continue
      }

      const { error } = await supabase
        .from('inventory_products')
        .update({ external_code: newCode })
        .eq('id', product.id)

      if (error) {
        errors.push(`${newCode}: ${error.message}`)
        console.log(`  ❌ Failed: ${newCode} for "${product.name}": ${error.message}`)
      } else {
        successCount++
        console.log(`  ✅ ${newCode} → "${product.name}" (cat: ${product.categoryName || 'N/A'})`)
        alreadyValid.push(newCode.toUpperCase())
      }
    }
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    action: 'UPDATE',
    entity_type: 'inventory_products',
    entity_id: 'smart_sku_backfill',
    after_data: { updated: successCount, errors: errors.length },
    context: { source: 'system', status: 'success', observation: `Backfill Smart SKU: ${successCount} atualizados.` }
  })

  console.log(`\n  📋 Backfill result: ${successCount} updated, ${errors.length} errors`)
  return errors.length === 0
}

// ═══════════════════════════════════════════════
// STEP 2: PAYMENT METHODS BOOTSTRAP
// ═══════════════════════════════════════════════
async function ensurePaymentMethods() {
  console.log('\n══════════════════════════════════════════')
  console.log('  STEP 2: Payment Methods Bootstrap')
  console.log('══════════════════════════════════════════')

  const { data: existing, error: checkError } = await supabase
    .from('payment_methods')
    .select('id, name')
    .eq('is_active', true)

  if (checkError) {
    console.error('❌ Failed to check payment methods:', checkError.message)
    return false
  }

  if (existing && existing.length > 0) {
    console.log(`  ✅ Payment methods already exist (${existing.length}):`)
    existing.forEach(m => console.log(`     • ${m.name}`))
    return true
  }

  const methods = [
    { name: 'Dinheiro', is_active: true },
    { name: 'Pix', is_active: true },
    { name: 'Cartão de Débito', is_active: true },
    { name: 'Cartão de Crédito', is_active: true },
  ]

  const { error: insertError } = await supabase
    .from('payment_methods')
    .insert(methods)

  if (insertError) {
    console.error('❌ Failed to insert payment methods:', insertError.message)
    return false
  }

  await supabase.from('audit_logs').insert({
    action: 'INSERT',
    entity_type: 'payment_methods',
    entity_id: 'bootstrap',
    after_data: { methods: methods.map(m => m.name) },
    context: { source: 'system', status: 'success', observation: 'Bootstrap: formas de pagamento inseridas.' }
  })

  console.log('  ✅ Payment methods seeded:')
  methods.forEach(m => console.log(`     • ${m.name}`))
  return true
}

// ═══════════════════════════════════════════════
// STEP 3: IMPORT REVISED SPREADSHEET
// ═══════════════════════════════════════════════
async function importRevisedSpreadsheet() {
  console.log('\n══════════════════════════════════════════')
  console.log('  STEP 3: Import Revised Spreadsheet')
  console.log('══════════════════════════════════════════')

  let XLSX
  try {
    XLSX = (await import('xlsx')).default || (await import('xlsx'))
  } catch {
    console.error('❌ xlsx module not found. Make sure it is installed.')
    return false
  }

  const filePath = resolve('..', 'Inventario para sistema Barber Zac revisada.xlsx')
  let wb
  try {
    wb = XLSX.readFile(filePath)
  } catch (err) {
    console.error(`❌ Failed to read file: ${filePath}`, err.message)
    return false
  }

  // Only visible sheets
  const visibleSheets = wb.SheetNames.filter((name, idx) => {
    const hidden = wb.Workbook?.Sheets?.[idx]?.Hidden
    return !hidden || hidden === 0
  })

  console.log(`  📄 Visible sheets: ${visibleSheets.join(', ')}`)

  // Parse all visible sheets
  const allRows = []
  for (const sheetName of visibleSheets) {
    const ws = wb.Sheets[sheetName]
    if (!ws || !ws['!ref']) continue
    const data = XLSX.utils.sheet_to_json(ws, { defval: '' })
    allRows.push(...data)
  }

  console.log(`  📊 Total raw rows: ${allRows.length}`)

  // Column cleaning helpers
  const cleanCurrency = (val) => {
    if (!val && val !== 0) return 0
    if (typeof val === 'number') return val
    const s = String(val).replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.').trim()
    return parseFloat(s) || 0
  }
  const cleanPercent = (val) => {
    if (!val && val !== 0) return 0
    if (typeof val === 'number') return val
    const s = String(val).replace('%', '').trim().replace(',', '.')
    return parseFloat(s) || 0
  }
  const cleanStock = (val) => {
    if (!val && val !== 0) return 0
    if (typeof val === 'number') return Math.max(0, Math.ceil(val))
    const s = String(val).replace(',', '.').trim()
    return Math.max(0, Math.ceil(parseFloat(s) || 0))
  }

  // Normalize rows
  const normalizedRows = allRows.map(rawRow => {
    const codigo = String(rawRow['Item'] || rawRow['CÓDIGO'] || rawRow['Codigo'] || '').trim()
    const nome = String(rawRow['Descrição'] || rawRow['PRODUTOS'] || rawRow['NOME'] || rawRow['Produto'] || '').trim()
    const categoria = String(rawRow['Categoria'] || rawRow['CATEGORIA'] || 'Sem Categoria').trim()
    const marca = String(rawRow['Marca'] || rawRow['MARCA'] || '').trim()

    // COST — only from explicit cost columns
    const custo = cleanCurrency(rawRow['Valor R$ Compra'] || rawRow['CUSTO'] || rawRow['Custo'])
    const markup = cleanPercent(rawRow['Porcentagem %'] || rawRow['%'] || rawRow['MARKUP'] || rawRow['Margem'])
    const precoVenda = cleanCurrency(rawRow['Valor Venda'] || rawRow['VALOR VENDA'] || rawRow['Valor a Vista'])

    // Stock
    const saldo = cleanStock(
      rawRow['Estoque'] || rawRow['Qtde Estoque'] || rawRow['Saldo Estoque'] ||
      rawRow['Estoque dia'] || rawRow['Estoque Dia'] || rawRow['SALDO\nATUAL'] || rawRow['SALDO']
    )
    const minStock = cleanStock(rawRow['Qtde Minimo'] || rawRow['MINIMO'] || rawRow['Mínimo'])
    const maxStock = cleanStock(rawRow['Qtde Maximo'] || rawRow['SUG. DE COMPRA'] || rawRow['Maximo'])

    return { codigo, nome, categoria, marca, custo, markup, precoVenda, saldo, minStock, maxStock }
  }).filter(r => r.codigo && r.codigo !== '' && r.nome && r.nome !== '')

  // Filter only rows with Smart SKU pattern
  const skuRows = normalizedRows.filter(r => /^(PERF|BEBI|INSU)\s+\d/i.test(r.codigo))
  console.log(`  ✅ Valid Smart SKU rows: ${skuRows.length}`)

  if (skuRows.length === 0) {
    console.log('  ⚠️ No valid Smart SKU rows found. Aborting import.')
    return false
  }

  // Resolve/create categories
  const { data: existingCats } = await supabase.from('inventory_categories').select('id, name')
  const categoryMap = new Map()
  if (existingCats) existingCats.forEach(c => categoryMap.set(c.name.toLowerCase().trim(), c.id))

  const { data: existingBrands } = await supabase.from('product_brands').select('id, name')
  const brandMap = new Map()
  if (existingBrands) existingBrands.forEach(b => brandMap.set(b.name.toLowerCase().trim(), b.id))

  for (const row of skuRows) {
    const catKey = row.categoria.toLowerCase().trim()
    if (catKey && catKey !== 'sem categoria' && !categoryMap.has(catKey)) {
      const { data: newCat } = await supabase.from('inventory_categories').insert({
        name: row.categoria,
        normalized_name: catKey,
        is_active: true,
        sort_order: 0
      }).select().single()
      if (newCat) categoryMap.set(catKey, newCat.id)
    }

    if (row.marca) {
      const brandKey = row.marca.toLowerCase().trim()
      if (brandKey && !brandMap.has(brandKey)) {
        const { data: newBrand } = await supabase.from('product_brands').insert({
          name: row.marca,
          normalized_name: brandKey,
          is_active: true
        }).select().single()
        if (newBrand) brandMap.set(brandKey, newBrand.id)
      }
    }
  }

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

  // Resolve flags by prefix
  const resolveFlags = (code) => {
    const upper = code.toUpperCase().trim()
    if (upper.startsWith('PERF')) return { is_for_resale: true, is_for_internal_use: false }
    if (upper.startsWith('BEBI')) return { is_for_resale: true, is_for_internal_use: false }
    return { is_for_resale: true, is_for_internal_use: true }
  }

  // Build upsert payload
  const upsertData = skuRows.map(r => {
    let safeMaxStock = r.maxStock
    if (!safeMaxStock || safeMaxStock <= 0) safeMaxStock = Math.max((r.minStock || 0) + 1, 10)
    if (safeMaxStock <= (r.minStock || 0)) safeMaxStock = (r.minStock || 0) + 1

    let costPrice = r.custo || 0
    if (costPrice === 0) {
      const existing = existingCostMap.get(r.codigo.toUpperCase().trim())
      if (existing && existing > 0) costPrice = existing
    }

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

  console.log(`  📦 Upserting ${upsertData.length} products...`)

  const { data: upsertedProducts, error: upsertError } = await supabase
    .from('inventory_products')
    .upsert(upsertData, { onConflict: 'external_code', ignoreDuplicates: false })
    .select('id, external_code')

  if (upsertError) {
    console.error('❌ Upsert failed:', upsertError.message)
    return false
  }

  console.log(`  ✅ Upserted: ${upsertedProducts.length} products`)

  // Stock movements (ledger-aware)
  const productIds = upsertedProducts.map(p => p.id)
  const { data: positions } = await supabase
    .from('vw_inventory_position')
    .select('product_id, current_balance')
    .in('product_id', productIds)

  const positionMap = new Map()
  if (positions) positions.forEach(p => positionMap.set(p.product_id, p.current_balance))

  const movements = []
  let zeroCostCount = 0

  for (const row of skuRows) {
    const dbProduct = upsertedProducts.find(p => p.external_code === row.codigo)
    if (!dbProduct) continue

    // Track zero-cost items for the report
    const upsertRow = upsertData.find(u => u.external_code === row.codigo)
    if (upsertRow && upsertRow.cost_price === 0) zeroCostCount++

    const targetBalance = row.saldo
    const currentBalance = positionMap.get(dbProduct.id) || 0
    const diff = targetBalance - currentBalance

    if (diff !== 0 && !isNaN(diff) && isFinite(diff)) {
      movements.push({
        product_id: dbProduct.id,
        movement_type: diff > 0 ? (currentBalance === 0 ? 'initial_balance' : 'manual_adjustment_in') : 'manual_adjustment_out',
        movement_reason: 'Ajuste via Planilha/Importação',
        source_type: 'import_wizard',
        destination_type: 'inventory',
        quantity: diff,
        movement_date: new Date().toISOString(),
        notes: `Go-live sync. Target: ${targetBalance}`
      })
    }
  }

  if (movements.length > 0) {
    const { error: moveError } = await supabase
      .from('stock_movements')
      .insert(movements)

    if (moveError) {
      console.error('❌ Stock movements failed:', moveError.message)
      return false
    }
    console.log(`  ✅ Stock movements: ${movements.length}`)
  } else {
    console.log(`  ℹ️ No stock adjustments needed`)
  }

  // Audit
  await supabase.from('audit_logs').insert({
    action: 'IMPORT',
    entity_type: 'inventory_products',
    entity_id: 'go_live_import',
    after_data: { products: upsertedProducts.length, movements: movements.length, zeroCost: zeroCostCount },
    context: { source: 'system', status: 'success', observation: `Go-live import: ${upsertedProducts.length} produtos, ${movements.length} movimentos, ${zeroCostCount} sem custo.` }
  })

  if (zeroCostCount > 0) {
    console.log(`  ⚠️ ${zeroCostCount} products have cost_price = 0 (need manual review)`)
  }

  return true
}

// ═══════════════════════════════════════════════
// STEP 4: VERIFICATION SUMMARY
// ═══════════════════════════════════════════════
async function verificationSummary() {
  console.log('\n══════════════════════════════════════════')
  console.log('  STEP 4: Verification Summary')
  console.log('══════════════════════════════════════════')

  // Count products with valid Smart SKU
  const { data: allProducts } = await supabase
    .from('inventory_products')
    .select('id, external_code, name, cost_price, is_for_resale, is_for_internal_use')
    .is('deleted_at', null)

  const total = allProducts?.length || 0
  const withSKU = allProducts?.filter(p => p.external_code && isValidSmartSKU(p.external_code)).length || 0
  const withoutSKU = total - withSKU
  const zeroCost = allProducts?.filter(p => !p.cost_price || p.cost_price === 0).length || 0
  const resale = allProducts?.filter(p => p.is_for_resale).length || 0

  console.log(`  📦 Total products: ${total}`)
  console.log(`  ✅ With Smart SKU: ${withSKU}`)
  console.log(`  ⚠️ Without Smart SKU: ${withoutSKU}`)
  console.log(`  💰 Zero cost (need review): ${zeroCost}`)
  console.log(`  🛒 For resale (POS-visible): ${resale}`)

  // Payment methods
  const { data: methods } = await supabase.from('payment_methods').select('name').eq('is_active', true)
  console.log(`  💳 Payment methods: ${methods?.length || 0}`)
  methods?.forEach(m => console.log(`     • ${m.name}`))

  // Audit entries
  const { count: auditCount } = await supabase.from('audit_logs').select('id', { count: 'exact', head: true })
  console.log(`  📋 Audit log entries: ${auditCount || 0}`)

  // Inventory positions (stocked)
  const { data: stocked } = await supabase
    .from('vw_inventory_position')
    .select('product_id, current_balance')
    .gt('current_balance', 0)
  console.log(`  📦 Products with stock > 0: ${stocked?.length || 0}`)

  // Categories
  const { data: cats } = await supabase.from('inventory_categories').select('name').eq('is_active', true)
  console.log(`  🏷️ Active categories: ${cats?.length || 0}`)

  // Brands
  const { data: brands } = await supabase.from('product_brands').select('name').eq('is_active', true)
  console.log(`  🏷️ Active brands: ${brands?.length || 0}`)

  console.log('\n══════════════════════════════════════════')
  console.log('  GO-LIVE SCRIPT COMPLETE')
  console.log('══════════════════════════════════════════')
}

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════
async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  BARBER ZAC ERP — GO-LIVE EXECUTION')
  console.log('  ' + new Date().toLocaleString('pt-BR'))
  console.log('═══════════════════════════════════════════')

  const step1 = await backfillSmartSKUs()
  const step2 = await ensurePaymentMethods()
  const step3 = await importRevisedSpreadsheet()
  await verificationSummary()

  console.log('\n')
  if (step1 && step2 && step3) {
    console.log('✅ All steps completed successfully.')
    console.log('   Next: smoke test via browser (POS, venda, auditoria, export).')
  } else {
    console.log('⚠️ Some steps had issues. Review output above.')
  }
}

main().catch(err => {
  console.error('💥 Fatal error:', err)
  process.exit(1)
})
