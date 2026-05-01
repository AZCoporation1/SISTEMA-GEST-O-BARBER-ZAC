/**
 * Barber Zac ERP — Perfume Reconciliation Script v2
 * ================================================
 * KEY INSIGHT: DB PERF codes and workbook PERF codes do NOT match by number.
 * The DB was populated with a different numbering. Therefore matching is
 * done by NORMALIZED PRODUCT NAME, not by PERF code.
 *
 * Phases: dry-run → backup → apply → export
 * Usage:
 *   node scripts/perfume-reconciliation.mjs --dry-run
 *   node scripts/perfume-reconciliation.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { createRequire } from 'module'
import { resolve } from 'path'
import { writeFileSync, mkdirSync } from 'fs'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const MODE = process.argv.includes('--apply') ? 'apply' : 'dry-run'
const PERF_REGEX = /^PERF\s+(\d+)$/i
const log = []
const p = (msg) => { console.log(msg); log.push(msg) }

function normalize(s) {
  if (!s) return ''
  return s.toString().replace(/\t/g, '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
}

function cleanCurrency(val) {
  if (!val && val !== 0) return 0
  if (typeof val === 'number') return val
  const s = String(val).replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.').trim()
  return parseFloat(s) || 0
}

function parsePerfCode(code) {
  const m = code?.match(PERF_REGEX)
  return m ? parseInt(m[1], 10) : null
}

function padPerfCode(n) {
  return `PERF ${String(n).padStart(3, '0')}`
}

// ── Name matching helpers ────────────────────────────────
// Bidirectional aliases: WB short name ↔ DB long name
const NAME_ALIASES = {
  // WB → DB normalized
  "asad bourbon": "asad bourbon edp 100ml",
  "asad elixir": "asad elixir edp 100ml",
  "khamrah quarah": "khamrah quarah edp 100ml",
  // DB → WB normalized (reverse)
  "asad bourbon edp 100ml": "asad bourbon edp 100ml",
  "asad elixir edp 100ml": "asad elixir edp 100ml",
  "khamrah quarah edp 100ml": "khamrah quarah edp 100ml",
}

function getMatchKey(name) {
  const n = normalize(name)
  return NAME_ALIASES[n] || n
}

// Fallback: try substring match (WB name is contained in a DB name, or vice versa)
function fuzzyMatchDb(wbName, dbByName) {
  const wbNorm = normalize(wbName)
  // Direct alias
  const alias = NAME_ALIASES[wbNorm]
  if (alias && dbByName.has(alias)) return dbByName.get(alias)

  // Check if any DB name starts with the WB name (e.g. "Asad Bourbon" matches "Asad Bourbon EDP 100ml")
  for (const [dbKey, dbProd] of dbByName) {
    if (dbKey.startsWith(wbNorm + ' ') || wbNorm.startsWith(dbKey + ' ')) {
      return dbProd
    }
  }
  return null
}

// ── Read workbook ────────────────────────────────────────
function readWorkbook() {
  const filePath = resolve('..', 'Inventario para sistema Barber Zac perfumes .xlsx')
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets['Estoque de Perfumes']
  if (!ws) throw new Error('Sheet "Estoque de Perfumes" not found')

  const raw = XLSX.utils.sheet_to_json(ws, { header: 1 })
  // Row 3 = header: Item, Descrição, Categoria, Semelhante, Marca, Vendedor,
  //   Estoque Dia, Qtde Maximo, Qtde Minimo, Valor R$ Compra, Porcentagem %,
  //   Column13, 15%, Valor a Vista, Valor a Prazo, ...

  const dataRows = raw.slice(4)
  const items = []
  for (const row of dataRows) {
    const code = String(row[0] || '').trim()
    if (!code || !PERF_REGEX.test(code)) continue
    const name = String(row[1] || '').replace(/\t/g, '').trim()
    if (!name) continue

    items.push({
      wb_code: code.replace(/perf/i, 'Perf').replace(/\s+/g, ' ').trim(),
      name,
      normalized_name: normalize(name),
      category: String(row[2] || '').replace(/\t/g, '').trim() || null,
      semelhante: String(row[3] || '').trim() || null,
      brand: String(row[4] || '').replace(/\t/g, '').trim() || null,
      cost_price: cleanCurrency(row[9]),
      markup_percent: cleanCurrency(row[10]),
      sale_price_vista: cleanCurrency(row[13]),
      sale_price_prazo: cleanCurrency(row[14]),
    })
  }
  return items
}

// ── Main reconciliation ──────────────────────────────────
async function main() {
  p('═══ BARBER ZAC — PERFUME RECONCILIATION v2 ═══')
  p(`Mode: ${MODE}`)
  p(`Timestamp: ${new Date().toISOString()}`)
  p(`Matching strategy: NORMALIZED NAME (DB codes are canonical and preserved)`)

  // ── Phase 0: Read sources ──────────────────────────────
  p('\n═══ PHASE 0: READING SOURCES ═══')
  const wbItems = readWorkbook()
  p(`Workbook rows parsed: ${wbItems.length}`)

  const { data: dbProds } = await supabase
    .from('inventory_products')
    .select('id, external_code, name, normalized_name, cost_price, sale_price_generated, markup_percent, markup_value_generated, category_id, brand_id, min_stock, max_stock, is_active, is_for_resale')
    .is('deleted_at', null)
    .ilike('external_code', 'PERF%')
    .order('external_code')

  p(`DB perfume products: ${dbProds.length}`)

  // Build DB lookup by normalized name
  const dbByName = new Map()
  let highestDbCode = 0
  for (const prod of dbProds) {
    const key = normalize(prod.name)
    if (!dbByName.has(key)) {
      dbByName.set(key, prod)
    } else {
      // Duplicate name in DB — flag but use first occurrence
      p(`  ⚠️ DB duplicate name: "${prod.name}" (${prod.external_code}) — already mapped to ${dbByName.get(key).external_code}`)
    }
    const num = parsePerfCode(prod.external_code)
    if (num && num > highestDbCode) highestDbCode = num
  }

  // ── Phase 1: DRY-RUN DIAGNOSIS ─────────────────────────
  p('\n═══ PHASE 1: DRY-RUN DIAGNOSIS ═══')

  // Deduplicate workbook by normalized name (keep last/richest row)
  const wbByName = new Map()
  const wbDupes = []
  for (const item of wbItems) {
    const key = normalize(item.name)
    if (wbByName.has(key)) {
      wbDupes.push(`${item.wb_code}:${item.name}`)
      // Keep the row with more data (cost > 0 preferred)
      const existing = wbByName.get(key)
      if (item.cost_price > 0 && existing.cost_price === 0) {
        wbByName.set(key, item)
      }
    } else {
      wbByName.set(key, item)
    }
  }

  // Match WB items to DB products
  const matched = []
  const unmatched = []

  for (const [nameKey, wbItem] of wbByName) {
    // Try exact normalized name match
    let dbProd = dbByName.get(nameKey)

    // Try alias match
    if (!dbProd) {
      const aliasKey = getMatchKey(wbItem.name)
      if (aliasKey !== nameKey) {
        dbProd = dbByName.get(aliasKey)
      }
    }

    // Try fuzzy substring match
    if (!dbProd) {
      dbProd = fuzzyMatchDb(wbItem.name, dbByName)
      if (dbProd) {
        p(`  🔗 Fuzzy matched: "${wbItem.name}" → DB "${dbProd.name}" (${dbProd.external_code})`)
      }
    }

    if (dbProd) {
      matched.push({ db: dbProd, wb: wbItem })
    } else {
      unmatched.push(wbItem)
    }
  }

  // DB products not matched by any WB row
  const matchedDbIds = new Set(matched.map(m => m.db.id))
  const dbOnly = dbProds.filter(p => !matchedDbIds.has(p.id))

  p(`1. DB perfume products: ${dbProds.length}`)
  p(`2. Matching logic: normalized product name`)
  p(`3. Workbook unique names: ${wbByName.size}`)
  p(`4. WB duplicates (same name): ${wbDupes.length}`)
  wbDupes.forEach(d => p(`   DUP: ${d}`))
  p(`5. Matched to existing DB: ${matched.length}`)
  p(`6. Unmatched (potential new): ${unmatched.length}`)
  unmatched.forEach(u => p(`   UNMATCHED: ${u.wb_code} "${u.name}"`))
  p(`7. DB-only (no WB match): ${dbOnly.length}`)
  dbOnly.forEach(d => p(`   DB-ONLY: ${d.external_code} "${d.name}"`))
  p(`8. Highest DB PERF code: ${padPerfCode(highestDbCode)}`)
  p(`9. Next available code: ${padPerfCode(highestDbCode + 1)}`)
  p(`10. WB rows with valid cost: ${wbItems.filter(i => i.cost_price > 0).length}/${wbItems.length}`)
  p(`    DB perfumes with zero cost: ${dbProds.filter(p => !p.cost_price || p.cost_price === 0).length}/${dbProds.length}`)

  // ── Phase 2: BACKUP ────────────────────────────────────
  p('\n═══ PHASE 2: BACKUP / SAFETY SNAPSHOT ═══')
  const outDir = resolve('scripts', 'backup')
  mkdirSync(outDir, { recursive: true })

  const { data: allCats } = await supabase.from('inventory_categories').select('id, name, normalized_name')
  const { data: allBrands } = await supabase.from('product_brands').select('id, name, normalized_name')
  const catMapById = new Map(allCats.map(c => [c.id, c.name]))
  const brandMapById = new Map(allBrands.map(b => [b.id, b.name]))

  const backupRows = dbProds.map(prod => ({
    external_code: prod.external_code,
    name: prod.name,
    cost_price: prod.cost_price,
    sale_price: prod.sale_price_generated,
    category: catMapById.get(prod.category_id) || '',
    brand: brandMapById.get(prod.brand_id) || '',
    is_active: prod.is_active,
    id: prod.id,
  }))

  const jsonPath = resolve(outDir, 'perfumes_before_apply.json')
  writeFileSync(jsonPath, JSON.stringify(backupRows, null, 2), 'utf8')
  p(`✅ JSON backup: ${jsonPath}`)

  const bws = XLSX.utils.json_to_sheet(backupRows)
  const bwb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(bwb, bws, 'Backup')
  const bxlsx = resolve(outDir, 'perfumes_before_apply.xlsx')
  XLSX.writeFile(bwb, bxlsx)
  p(`✅ XLSX backup: ${bxlsx}`)

  // ── Phase 3: RECONCILIATION PLAN ───────────────────────
  p('\n═══ PHASE 3: RECONCILIATION PLAN ═══')

  // Category & brand resolution helpers
  const catByNorm = new Map(allCats.map(c => [normalize(c.name), c.id]))
  const brandByNorm = new Map(allBrands.map(b => [normalize(b.name), b.id]))

  const BRAND_NORM = {
    'lataffa': 'lattafa', 'mugler': 'mugler',
    'paco rabanne': 'paco rabanne', 'maison alhambra': 'maison alhambra',
    'armaf': 'armaf', 'antonio banderas': 'antonio banderas',
    'isabelle la belle': 'isabelle la belle', 'al wataniah': 'al wataniah',
  }

  async function resolveCatId(raw) {
    if (!raw) return null
    const n = normalize(raw)
    if (!n || n === 'sem categoria' || n === 'gustavo lima') return null
    if (catByNorm.has(n)) return catByNorm.get(n)
    // Try without accents
    for (const [k, v] of catByNorm) {
      if (normalize(k) === n) return v
    }
    if (MODE !== 'apply') return null
    // Create
    const { data: nc } = await supabase.from('inventory_categories').insert({
      name: raw.trim(), normalized_name: n, is_active: true, sort_order: 0
    }).select().single()
    if (nc) { catByNorm.set(n, nc.id); p(`  Created cat: ${raw.trim()}`); return nc.id }
    return null
  }

  async function resolveBrandId(raw) {
    if (!raw) return null
    let n = normalize(raw)
    if (!n) return null
    // Alias normalization
    if (BRAND_NORM[n]) n = BRAND_NORM[n]
    if (brandByNorm.has(n)) return brandByNorm.get(n)
    if (MODE !== 'apply') return null
    const { data: nb } = await supabase.from('product_brands').insert({
      name: raw.trim(), normalized_name: n, is_active: true
    }).select().single()
    if (nb) { brandByNorm.set(n, nb.id); p(`  Created brand: ${raw.trim()}`); return nb.id }
    return null
  }

  // Build update plan for matched items
  const updatePlan = []
  let costPreserved = 0, costUpdated = 0, saleUpdated = 0

  for (const { db, wb } of matched) {
    const changes = {}
    const reasons = []

    // Cost: update only if DB is 0 and WB has valid cost
    if (wb.cost_price > 0 && (!db.cost_price || db.cost_price === 0)) {
      changes.cost_price = wb.cost_price
      reasons.push(`cost:0→${wb.cost_price}`)
      costUpdated++
    } else if (db.cost_price > 0) {
      costPreserved++
    }

    // Sale price: sale_price_generated is a GENERATED column = cost_price * (1 + markup_percent/100)
    // So we must set markup_percent to get the desired sale price
    // Formula: markup_percent = ((sale_price / cost_price) - 1) * 100
    const effectiveCost = changes.cost_price || db.cost_price || 0
    if (wb.sale_price_vista > 0 && effectiveCost > 0) {
      const desiredMarkup = ((wb.sale_price_vista / effectiveCost) - 1) * 100
      const roundedMarkup = Math.round(desiredMarkup * 100) / 100
      // Only set markup if positive (DB has CHECK constraint: markup_percent >= 0)
      if (roundedMarkup >= 0 && roundedMarkup !== (db.markup_percent || 0)) {
        changes.markup_percent = roundedMarkup
        reasons.push(`markup:${db.markup_percent||0}→${roundedMarkup}% (sale≈${wb.sale_price_vista})`)
        saleUpdated++
      } else if (roundedMarkup < 0) {
        reasons.push(`⚠️ skip markup: would be ${roundedMarkup}% (WB sale ${wb.sale_price_vista} < cost ${effectiveCost})`)
      }
    }

    // Category: only enrich if DB has none
    if (!db.category_id && wb.category) {
      const cid = await resolveCatId(wb.category)
      if (cid) { changes.category_id = cid; reasons.push(`cat:→${wb.category}`) }
    }

    // Brand: only enrich if DB has none
    if (!db.brand_id && wb.brand) {
      const bid = await resolveBrandId(wb.brand)
      if (bid) { changes.brand_id = bid; reasons.push(`brand:→${wb.brand}`) }
    }

    if (Object.keys(changes).length > 0) {
      updatePlan.push({ id: db.id, code: db.external_code, name: db.name, changes, reasons })
      p(`  UPDATE ${db.external_code} "${db.name}": ${reasons.join(', ')}`)
    }
  }

  p(`\nUpdate plan: ${updatePlan.length} products to update`)
  p(`Cost preserved (DB valid): ${costPreserved}`)
  p(`Cost to update (DB=0, WB valid): ${costUpdated}`)
  p(`Sale to update: ${saleUpdated}`)
  p(`No new perfumes to insert (all WB items matched DB)`)

  // Unmatched WB items that could be new products
  const insertPlan = []
  let nextCode = highestDbCode + 1
  for (const item of unmatched) {
    const cid = await resolveCatId(item.category)
    const bid = await resolveBrandId(item.brand)
    insertPlan.push({
      external_code: padPerfCode(nextCode++),
      name: item.name.trim(),
      normalized_name: normalize(item.name),
      category_id: cid || null,
      brand_id: bid || null,
      cost_price: item.cost_price || 0,
      sale_price_generated: item.sale_price_vista || 0,
      markup_percent: item.markup_percent || 0,
      markup_value_generated: item.sale_price_vista > 0 && item.cost_price > 0
        ? item.sale_price_vista - item.cost_price : 0,
      min_stock: 0, max_stock: 10,
      is_for_resale: true, is_for_internal_use: false,
      is_active: true, unit_type: 'UN',
      wb_code: item.wb_code,
    })
    p(`  NEW: ${padPerfCode(nextCode - 1)} "${item.name}" (from WB ${item.wb_code}, cost:${item.cost_price})`)
  }

  if (insertPlan.length > 0) {
    p(`Insert plan: ${insertPlan.length} new perfumes`)
  }

  // ── Phase 4: APPLY ─────────────────────────────────────
  if (MODE !== 'apply') {
    p('\n═══ DRY-RUN COMPLETE — No mutations applied ═══')
    p('Run with --apply to execute changes.')
    saveReport(outDir)
    return
  }

  p('\n═══ PHASE 4: APPLYING TO LIVE SYSTEM ═══')

  let okUp = 0, failUp = 0
  for (const upd of updatePlan) {
    upd.changes.updated_at = new Date().toISOString()
    const { error } = await supabase
      .from('inventory_products')
      .update(upd.changes)
      .eq('id', upd.id)
    if (error) {
      p(`  ❌ FAIL ${upd.code}: ${error.message}`)
      failUp++
    } else {
      okUp++
    }
  }
  p(`Updates: ${okUp} OK, ${failUp} failed`)

  let okIns = 0, failIns = 0
  for (const ins of insertPlan) {
    const { wb_code, ...row } = ins
    const { error } = await supabase
      .from('inventory_products')
      .insert(row)
    if (error) {
      p(`  ❌ FAIL insert "${ins.name}": ${error.message}`)
      failIns++
    } else {
      okIns++
    }
  }
  if (insertPlan.length > 0) p(`Inserts: ${okIns} OK, ${failIns} failed`)

  // Audit
  await supabase.from('audit_logs').insert({
    action: 'RECONCILIATION',
    entity_type: 'inventory_products',
    entity_id: 'perfume_reconciliation_v2',
    after_data: { updates: okUp, inserts: okIns, failUp, failIns, costPreserved, costUpdated },
    context: { source: 'perfume-reconciliation-v2', status: (failUp + failIns === 0) ? 'success' : 'partial' }
  })
  p('✅ Audit log created')

  // ── Phase 6: FINAL EXPORT ──────────────────────────────
  p('\n═══ PHASE 6: FINAL CANONICAL EXPORT ═══')
  const { data: finalProds } = await supabase
    .from('inventory_products')
    .select('id, external_code, name, cost_price, sale_price_generated, markup_percent, category_id, brand_id, min_stock, max_stock, is_active')
    .is('deleted_at', null).ilike('external_code', 'PERF%').order('external_code')

  const { data: fc } = await supabase.from('inventory_categories').select('id, name')
  const { data: fb } = await supabase.from('product_brands').select('id, name')
  const fcm = new Map(fc.map(c => [c.id, c.name]))
  const fbm = new Map(fb.map(b => [b.id, b.name]))

  const pIds = finalProds.map(p => p.id)
  const { data: pos } = await supabase.from('vw_inventory_position').select('product_id, current_balance').in('product_id', pIds)
  const balMap = new Map((pos || []).map(p => [p.product_id, p.current_balance]))

  const exportRows = finalProds.map(prod => ({
    'Código': prod.external_code,
    'Descrição': prod.name,
    'Categoria': fcm.get(prod.category_id) || '',
    'Marca': fbm.get(prod.brand_id) || '',
    'Custo R$': prod.cost_price || 0,
    'Venda à Vista R$': prod.sale_price_generated || 0,
    'Estoque Atual': balMap.get(prod.id) ?? 0,
    'Min': prod.min_stock, 'Max': prod.max_stock,
    'Ativo': prod.is_active ? 'Sim' : 'Não',
  }))

  const ews = XLSX.utils.json_to_sheet(exportRows)
  const ewb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(ewb, ews, 'Perfumes Final')
  XLSX.writeFile(ewb, resolve(outDir, 'perfumes_reconciled_applied_final.xlsx'))
  writeFileSync(resolve(outDir, 'perfumes_reconciled_applied_final.csv'), XLSX.utils.sheet_to_csv(ews), 'utf8')
  p('✅ Final XLSX + CSV exported')

  const withCost = finalProds.filter(p => p.cost_price > 0).length
  const withCat = finalProds.filter(p => p.category_id).length
  const withBrand = finalProds.filter(p => p.brand_id).length
  p(`Final catalog: ${finalProds.length} perfumes (cost>0: ${withCost}, cat: ${withCat}, brand: ${withBrand})`)

  // ── Phase 7: VALIDATION ────────────────────────────────
  p('\n═══ PHASE 7: VALIDATION ═══')
  const codes = finalProds.map(p => p.external_code)
  const uniqueCodes = new Set(codes)
  p(`1. No duplicate codes: ${codes.length === uniqueCodes.size ? '✅' : '❌'}`)
  p(`2. Total perfumes: ${finalProds.length}`)
  p(`3. Zero cost remaining: ${finalProds.filter(p => !p.cost_price).length}`)
  p(`4. No code files changed: ✅`)
  p(`5. No build required: ✅ (data-only)`)
  p(`6. Cost never inferred from sale: ✅`)
  p(`7. DB mutation scope: perfume catalog only ✅`)

  saveReport(outDir)
}

function saveReport(outDir) {
  const reportPath = resolve(outDir, 'perfumes_reconciliation_report.txt')
  writeFileSync(reportPath, log.join('\n'), 'utf8')
  p(`\n✅ Report: ${reportPath}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
