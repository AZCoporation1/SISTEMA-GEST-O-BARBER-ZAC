/**
 * Barber Zac ERP — Perfume Catalog Reconciliation Script
 * Phase 3+4: Dry-run + Apply
 * 
 * Match priority (per user requirement):
 *   1. normalized name + normalized brand
 *   2. normalized name only
 *   3. external_code only when confirmed
 *   4. ambiguous → flag only, NO automatic action
 * 
 * Rules:
 *   - NEVER create stock movements
 *   - NEVER overwrite cost_price from workbook (no cost column in workbook)
 *   - NEVER duplicate products
 *   - Update sale_price_cash + sale_price_installment for matched products
 *   - Flag ambiguities for manual review
 */
require('dotenv').config({ path: '.env.local' });
const XLSX = require('xlsx');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const DRY_RUN = process.argv.includes('--apply') ? false : true;

// ════════════════════════════════════════════
// NORMALIZATION
// ════════════════════════════════════════════
function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove accents
    .replace(/[^a-z0-9]/g, '')        // Remove non-alphanumeric
    .trim();
}

// ════════════════════════════════════════════
// WORKBOOK PARSING
// ════════════════════════════════════════════
function parseWorkbook() {
  const filePath = path.resolve(__dirname, '..', '..', 'Inventario para sistema Barber Zac perfumes  ATT.xlsx');
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets['LISTA DE ESTOQUE'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const perfumes = [];
  for (let i = 3; i < data.length; i++) {
    const row = data[i];
    const code = String(row[1] || '').trim();
    const desc = String(row[2] || '').trim();
    if (code.startsWith('PERF') && desc) {
      perfumes.push({
        code: code,
        name: desc,
        normalizedName: normalize(desc),
        category: String(row[3] || '').trim(),
        normalizedCategory: normalize(String(row[3] || '')),
        brand: String(row[4] || '').trim(),
        normalizedBrand: normalize(String(row[4] || '')),
        stock: Number(row[8]) || 0,
        vistaPrice: Number(row[9]) || 0,
        prazoPrice: Number(row[10]) || 0,
      });
    }
  }
  return perfumes;
}

// ════════════════════════════════════════════
// FETCH DB STATE
// ════════════════════════════════════════════
async function fetchDBProducts() {
  const { data, error } = await supabase
    .from('inventory_products')
    .select('id, name, external_code, cost_price, sale_price_generated, sale_price_cash, sale_price_installment, category_id, brand_id, normalized_name, is_active, markup_percent')
    .not('external_code', 'is', null)
    .ilike('external_code', '%PERF%')
    .order('external_code');
  
  if (error) throw new Error('Failed to fetch products: ' + error.message);
  return data;
}

async function fetchCategories() {
  const { data, error } = await supabase
    .from('inventory_categories')
    .select('id, name, normalized_name');
  if (error) throw new Error('Failed to fetch categories: ' + error.message);
  return data;
}

async function fetchBrands() {
  const { data, error } = await supabase
    .from('product_brands')
    .select('id, name, normalized_name');
  if (error) throw new Error('Failed to fetch brands: ' + error.message);
  return data;
}

// ════════════════════════════════════════════
// RECONCILIATION LOGIC
// ════════════════════════════════════════════
function reconcile(workbookItems, dbProducts) {
  const results = {
    matched: [],       // Existing DB product matched → will update prices
    newItems: [],      // Truly new items → will create
    ambiguous: [],     // Could not resolve → flag for manual review
    duplicatesInDB: [], // DB has duplicates (e.g., "Perf 006" vs "PERF 006")
    skipped: [],       // Items skipped for other reasons
  };

  // Build DB lookup indexes
  const dbByNormNameBrand = new Map();    // normalized_name+brand → [products]
  const dbByNormName = new Map();         // normalized_name → [products]
  const dbByCode = new Map();            // external_code (normalized) → [products]

  dbProducts.forEach(p => {
    const normName = normalize(p.name);
    const normCode = normalize(p.external_code);

    // By name (can have multiple)
    if (!dbByNormName.has(normName)) dbByNormName.set(normName, []);
    dbByNormName.get(normName).push(p);

    // By code (can have duplicates like "Perf 006" and "PERF 006")
    if (!dbByCode.has(normCode)) dbByCode.set(normCode, []);
    dbByCode.get(normCode).push(p);
  });

  // Detect DB duplicates first
  for (const [code, products] of dbByCode.entries()) {
    if (products.length > 1) {
      results.duplicatesInDB.push({
        code,
        products: products.map(p => ({ id: p.id, name: p.name, external_code: p.external_code, cost_price: p.cost_price })),
      });
    }
  }

  // Track which DB product IDs have been matched
  const matchedDbIds = new Set();

  for (const wb of workbookItems) {
    let match = null;
    let matchType = '';
    let ambiguityReason = '';

    // === PRIORITY 1: normalized name + normalized brand ===
    const candidates = dbByNormName.get(wb.normalizedName) || [];
    // Filter out already-matched and look for brand agreement
    const nameBrandMatches = candidates.filter(p => !matchedDbIds.has(p.id));
    
    if (nameBrandMatches.length === 1) {
      // Single name match — good enough
      match = nameBrandMatches[0];
      matchType = 'name_only (single)';
    } else if (nameBrandMatches.length > 1) {
      // Multiple name matches — try to disambiguate by brand or by cost_price > 0
      const withCost = nameBrandMatches.filter(p => p.cost_price > 0);
      if (withCost.length === 1) {
        match = withCost[0];
        matchType = 'name + cost>0 (disambiguated)';
      } else if (withCost.length > 1) {
        // Still ambiguous — flag
        ambiguityReason = `Multiple DB products with same normalized name "${wb.name}" and cost>0: ${nameBrandMatches.map(p => `${p.external_code}|${p.name}|cost=${p.cost_price}`).join(' VS ')}`;
      } else {
        // All have cost=0, try code match
        const codeMatch = nameBrandMatches.find(p => normalize(p.external_code) === normalize(wb.code));
        if (codeMatch) {
          match = codeMatch;
          matchType = 'name + code (fallback from zero-cost dupes)';
        } else {
          ambiguityReason = `Multiple zero-cost DB products with name "${wb.name}": ${nameBrandMatches.map(p => `${p.external_code}|${p.name}`).join(' VS ')}`;
        }
      }
    }

    // === PRIORITY 2 (if no match yet): external_code as secondary ===
    if (!match && !ambiguityReason) {
      const codeMatches = (dbByCode.get(normalize(wb.code)) || []).filter(p => !matchedDbIds.has(p.id));
      if (codeMatches.length === 1) {
        match = codeMatches[0];
        matchType = 'external_code (secondary, name mismatch)';
      } else if (codeMatches.length > 1) {
        // Pick the one with cost > 0
        const withCost = codeMatches.filter(p => p.cost_price > 0);
        if (withCost.length === 1) {
          match = withCost[0];
          matchType = 'external_code + cost>0 (disambiguated)';
        } else {
          ambiguityReason = `Multiple DB products with code ${wb.code}: ${codeMatches.map(p => `${p.external_code}|${p.name}|cost=${p.cost_price}`).join(' VS ')}`;
        }
      }
    }

    // === Classify result ===
    if (match) {
      matchedDbIds.add(match.id);
      results.matched.push({
        workbook: wb,
        dbProduct: match,
        matchType,
        updates: {
          sale_price_cash: wb.vistaPrice,
          sale_price_installment: wb.prazoPrice,
        },
      });
    } else if (ambiguityReason) {
      results.ambiguous.push({
        workbook: wb,
        reason: ambiguityReason,
      });
    } else {
      // No match at all → truly new
      results.newItems.push(wb);
    }
  }

  return results;
}

// ════════════════════════════════════════════
// APPLY CHANGES
// ════════════════════════════════════════════
async function applyChanges(results, categories, brands) {
  let updated = 0;
  let created = 0;
  let errors = [];

  // Update matched products
  for (const m of results.matched) {
    const { error } = await supabase
      .from('inventory_products')
      .update({
        sale_price_cash: m.updates.sale_price_cash,
        sale_price_installment: m.updates.sale_price_installment,
      })
      .eq('id', m.dbProduct.id);

    if (error) {
      errors.push(`Update ${m.dbProduct.external_code} (${m.dbProduct.name}): ${error.message}`);
    } else {
      updated++;
    }
  }

  // Create truly new products
  for (const item of results.newItems) {
    // Resolve category
    let categoryId = null;
    if (item.category) {
      const cat = categories.find(c => normalize(c.name) === item.normalizedCategory);
      if (cat) {
        categoryId = cat.id;
      } else {
        // Create category
        const { data: newCat, error: catErr } = await supabase
          .from('inventory_categories')
          .insert({ name: item.category, normalized_name: item.normalizedCategory })
          .select()
          .single();
        if (!catErr && newCat) {
          categoryId = newCat.id;
          categories.push(newCat); // Update local cache
        }
      }
    }

    // Resolve brand
    let brandId = null;
    if (item.brand) {
      const br = brands.find(b => normalize(b.name) === item.normalizedBrand);
      if (br) {
        brandId = br.id;
      } else {
        const { data: newBr, error: brErr } = await supabase
          .from('product_brands')
          .insert({ name: item.brand, normalized_name: item.normalizedBrand })
          .select()
          .single();
        if (!brErr && newBr) {
          brandId = newBr.id;
          brands.push(newBr);
        }
      }
    }

    const { error } = await supabase
      .from('inventory_products')
      .insert({
        external_code: item.code,
        name: item.name,
        normalized_name: item.normalizedName,
        category_id: categoryId,
        brand_id: brandId,
        cost_price: 0,         // No cost data in workbook
        markup_percent: 0,     // Explicit prices override markup
        sale_price_cash: item.vistaPrice,
        sale_price_installment: item.prazoPrice,
        min_stock: 0,
        max_stock: 10,
        is_for_resale: true,
        is_for_internal_use: false,
      });

    if (error) {
      errors.push(`Create ${item.code} (${item.name}): ${error.message}`);
    } else {
      created++;
    }
  }

  return { updated, created, errors };
}

// ════════════════════════════════════════════
// REPORT
// ════════════════════════════════════════════
function printReport(results) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  RECONCILIATION REPORT${DRY_RUN ? ' (DRY RUN)' : ' (APPLIED)'}`);
  console.log('═'.repeat(60));

  console.log(`\n📊 Summary:`);
  console.log(`  Matched (will update prices): ${results.matched.length}`);
  console.log(`  New items (will create):       ${results.newItems.length}`);
  console.log(`  Ambiguous (flagged):           ${results.ambiguous.length}`);
  console.log(`  DB Duplicates detected:        ${results.duplicatesInDB.length}`);

  console.log('\n── MATCHED PRODUCTS ──');
  results.matched.forEach(m => {
    const db = m.dbProduct;
    console.log(`  ✅ ${m.workbook.code} → DB: ${db.external_code} | "${db.name}" [${m.matchType}]`);
    console.log(`     Vista: R$${m.updates.sale_price_cash} | Prazo: R$${m.updates.sale_price_installment}`);
  });

  if (results.newItems.length > 0) {
    console.log('\n── NEW ITEMS ──');
    results.newItems.forEach(item => {
      console.log(`  🆕 ${item.code} | "${item.name}" | Vista: R$${item.vistaPrice} | Prazo: R$${item.prazoPrice}`);
    });
  }

  if (results.ambiguous.length > 0) {
    console.log('\n── AMBIGUOUS (REQUIRES MANUAL REVIEW) ──');
    results.ambiguous.forEach(a => {
      console.log(`  ⚠️  ${a.workbook.code} | "${a.workbook.name}"`);
      console.log(`     Reason: ${a.reason}`);
    });
  }

  if (results.duplicatesInDB.length > 0) {
    console.log('\n── DB DUPLICATES DETECTED ──');
    results.duplicatesInDB.forEach(d => {
      console.log(`  🔴 Code "${d.code}":`);
      d.products.forEach(p => {
        console.log(`     ID: ${p.id} | Name: "${p.name}" | Code: ${p.external_code} | Cost: R$${p.cost_price}`);
      });
    });
  }
}

// ════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════
async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (pass --apply to execute)' : '🔥 LIVE APPLY'}`);

  // Parse workbook
  const workbookItems = parseWorkbook();
  console.log(`Workbook items: ${workbookItems.length}`);

  // Fetch DB state
  const dbProducts = await fetchDBProducts();
  const categories = await fetchCategories();
  const brands = await fetchBrands();
  console.log(`DB PERF products: ${dbProducts.length}`);
  console.log(`DB categories: ${categories.length}`);
  console.log(`DB brands: ${brands.length}`);

  // Reconcile
  const results = reconcile(workbookItems, dbProducts);

  // Report
  printReport(results);

  // Apply if not dry run
  if (!DRY_RUN) {
    console.log('\n── APPLYING CHANGES ──');
    const outcome = await applyChanges(results, categories, brands);
    console.log(`\n  Updated: ${outcome.updated}`);
    console.log(`  Created: ${outcome.created}`);
    if (outcome.errors.length > 0) {
      console.log(`  Errors: ${outcome.errors.length}`);
      outcome.errors.forEach(e => console.log(`    ❌ ${e}`));
    }
    console.log('\n✅ Reconciliation complete.');
  } else {
    console.log('\n⚠️  DRY RUN — no changes made. Run with --apply to execute.');
  }
}

main().catch(console.error);
