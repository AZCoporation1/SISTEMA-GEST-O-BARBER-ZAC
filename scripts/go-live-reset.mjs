/**
 * Barber Zac ERP — Go-Live Reset + Base Import
 * ==============================================
 * Run: node --env-file=.env.local scripts/go-live-reset.mjs
 * 
 * This script:
 * 1. Backs up transactional data to scripts/backup/
 * 2. Surgically resets test/transactional data
 * 3. Seeds payment methods
 * 4. Parses the CSV inventory file
 * 5. Upserts categories, brands, and products
 * 6. Generates initial stock movements
 * 7. Logs the operation to audit_logs
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { createClient } from '@supabase/supabase-js';

// ── Config ───────────────────────────────────────────────
const PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!PROJECT_URL || !SERVICE_KEY) {
  console.error("❌ Missing Supabase env vars. Run with: node --env-file=.env.local scripts/go-live-reset.mjs");
  process.exit(1);
}

const supabase = createClient(PROJECT_URL, SERVICE_KEY);

// Workspace root
const WORKSPACE = path.resolve('.');
const CSV_FILE = path.resolve(WORKSPACE, '..', 'Inventario para sistema Barber Zac - Fechamento Geral ori.csv');
const BACKUP_DIR = path.resolve(WORKSPACE, 'scripts', 'backup');

// ── Official Category Map ─────────────────────────────────
const OFFICIAL_CATEGORIES = {
  '1':  'Finalizador Capilar',
  '2':  'Insumos',
  '3':  'Home Care',
  '4':  'Lavatório',
  '5':  'Minoxidil',
  '6':  'Produto de Limpeza',
  '7':  'Produto Limpeza de Pele',
  '8':  'Químicas',
  '9':  'Refrigerante',
  '10': 'Energético',
  '11': 'Água',
  '12': 'Cerveja com Álcool',
  '13': 'Cerveja sem Álcool',
  '14': 'Oriental Especiado',
  '15': 'Amadeirado Especiado',
  '16': 'Oriental Baunilha',
  '17': 'Oriental Amadeirado',
  '18': 'Floral Frutado Gourmet',
  '19': 'Amadeirado Aromático',
  '20': 'Aromático Fougère',
  '21': 'Oriental Floral',
  '22': 'Floral',
  '23': 'Floral Frutado',
  '24': 'Amadeirado',
  '25': 'Perfume de Bolso',
  '26': 'Perfume para Cabelo',
};

// Categories that are for internal use only (not for resale via PDV)
const INTERNAL_USE_CATEGORIES = new Set([
  '2',  // Insumos
  '4',  // Lavatório
  '6',  // Produto de Limpeza
  '8',  // Químicas
]);

// ── CSV Parsing ──────────────────────────────────────────
function parseCSVLine(text) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else current += char;
  }
  result.push(current);
  return result.map(s => s.trim().replace(/^"|"$/g, ''));
}

function parseCurrency(val) {
  if (!val) return 0;
  const clean = String(val).replace(/R\$\s*/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function parsePercent(val) {
  if (!val) return 0;
  const clean = String(val).replace(/%/g, '').replace(/,/g, '.').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function parseIntSafe(val) {
  if (!val && val !== 0) return 0;
  const s = String(val).replace(/,/g, '.').trim();
  const num = parseFloat(s);
  return isNaN(num) ? 0 : Math.ceil(num);
}

function normalizeStr(s) {
  if (!s) return '';
  return s.trim().replace(/\s{2,}/g, ' ');
}

// ── Backup ───────────────────────────────────────────────
async function backupTable(tableName) {
  const { data, error } = await supabase.from(tableName).select('*');
  if (error) {
    console.log(`  ⚠️ Could not backup ${tableName}: ${error.message}`);
    return [];
  }
  const rows = data || [];
  fs.writeFileSync(
    path.join(BACKUP_DIR, `${tableName}_backup.json`),
    JSON.stringify(rows, null, 2),
    'utf-8'
  );
  console.log(`  📦 ${tableName}: ${rows.length} rows backed up`);
  return rows;
}

// ── Reset ────────────────────────────────────────────────
async function resetTable(tableName) {
  // Delete all rows — using a catch-all filter
  const { error, count } = await supabase
    .from(tableName)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Matches all real UUIDs
  
  if (error) {
    console.log(`  ⚠️ Failed to reset ${tableName}: ${error.message}`);
    return 0;
  }
  console.log(`  🗑️ ${tableName}: cleared`);
  return count || 0;
}

// ── Main ─────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  BARBER ZAC ERP — GO-LIVE RESET + BASE IMPORT             ║');
  console.log('║  ' + new Date().toISOString() + '                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // ──────────────────────────────────────────────────────
  // PHASE 0: BACKUP
  // ──────────────────────────────────────────────────────
  console.log('━━━ PHASE 0: BACKUP ━━━');
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const tablesToBackup = [
    'sales', 'sale_items', 'cash_sessions', 'cash_entries',
    'financial_movements', 'stock_movements', 'commission_entries', 'audit_logs'
  ];

  for (const table of tablesToBackup) {
    await backupTable(table);
  }
  console.log('✅ Backup complete.\n');

  // ──────────────────────────────────────────────────────
  // PHASE 1: SURGICAL RESET
  // ──────────────────────────────────────────────────────
  console.log('━━━ PHASE 1: SURGICAL RESET ━━━');
  console.log('  Preserving: products, categories, brands, customers, collaborators, settings, payment_methods');

  // FK-safe deletion order
  const resetOrder = [
    'commission_entries',
    'sale_items',
    'cash_entries',
    'sales',
    'cash_sessions',
    'financial_movements',
    'stock_movements',
    'audit_logs',
  ];

  for (const table of resetOrder) {
    await resetTable(table);
  }
  console.log('✅ Test data reset complete.\n');

  // ──────────────────────────────────────────────────────
  // PHASE 2: SEED PAYMENT METHODS
  // ──────────────────────────────────────────────────────
  console.log('━━━ PHASE 2: SEED PAYMENT METHODS ━━━');
  const paymentMethods = ['Dinheiro', 'Pix', 'Cartão de Débito', 'Cartão de Crédito'];

  const { data: existingPM } = await supabase.from('payment_methods').select('id, name');
  const existingPMNames = new Set((existingPM || []).map(p => p.name.toLowerCase().trim()));

  for (const pm of paymentMethods) {
    if (!existingPMNames.has(pm.toLowerCase().trim())) {
      const { error } = await supabase.from('payment_methods').insert({ name: pm, is_active: true });
      if (error) {
        console.log(`  ⚠️ Failed to seed ${pm}: ${error.message}`);
      } else {
        console.log(`  ✅ Created payment method: ${pm}`);
      }
    } else {
      console.log(`  ✓ Payment method already exists: ${pm}`);
    }
  }
  console.log('');

  // ──────────────────────────────────────────────────────
  // PHASE 3: PARSE CSV
  // ──────────────────────────────────────────────────────
  console.log('━━━ PHASE 3: PARSE CSV ━━━');

  if (!fs.existsSync(CSV_FILE)) {
    console.error(`❌ CSV file not found: ${CSV_FILE}`);
    process.exit(1);
  }

  const rawRows = [];
  const fileStream = fs.createReadStream(CSV_FILE, 'utf-8');
  const rl = readline.createInterface({ input: fileStream });

  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    if (lineNum <= 4) continue; // Skip header rows
    if (!line.trim() || line.replace(/,/g, '').replace(/"/g, '').replace(/R\$ 0,00/g, '').replace(/0/g, '').trim() === '') continue;

    const cols = parseCSVLine(line);
    const code = normalizeStr(cols[1]);
    if (!code || !code.includes('_')) continue; // Must have category_item pattern

    const name = normalizeStr(cols[2]);
    if (!name) continue;

    rawRows.push({
      code: code,
      name: name,
      category_raw: normalizeStr(cols[3]),
      brand_raw: normalizeStr(cols[4]),
      max_stock: parseIntSafe(cols[5]),
      min_stock: parseIntSafe(cols[6]),
      cost_price: parseCurrency(cols[7]),
      markup_percent: parsePercent(cols[8]),
      sale_price: parseCurrency(cols[10]),
      _line: lineNum,
    });
  }

  console.log(`  📄 Parsed ${rawRows.length} valid product rows from CSV`);

  // Resolve duplicate codes
  const codeCount = {};
  const warnings = [];
  
  for (const row of rawRows) {
    if (codeCount[row.code]) {
      const prefix = row.code.split('_')[0];
      // Find next available number in this category
      let maxNum = 0;
      for (const r of rawRows) {
        const parts = r.code.split('_');
        if (parts[0] === prefix) {
          const num = parseInt(parts[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      const newCode = `${prefix}_${maxNum + 1}`;
      warnings.push(`⚠️ Duplicate code ${row.code} (${row.name}) → renumbered to ${newCode}`);
      row.code = newCode;
    }
    codeCount[row.code] = (codeCount[row.code] || 0) + 1;
  }

  if (warnings.length > 0) {
    console.log('  Duplicate resolutions:');
    warnings.forEach(w => console.log(`    ${w}`));
  }
  console.log('');

  // ──────────────────────────────────────────────────────
  // PHASE 4: UPSERT CATEGORIES
  // ──────────────────────────────────────────────────────
  console.log('━━━ PHASE 4: UPSERT CATEGORIES ━━━');

  // Get existing categories
  const { data: existingCats } = await supabase.from('inventory_categories').select('id, name, code_prefix');
  const catByPrefix = new Map();
  const catByName = new Map();
  
  if (existingCats) {
    for (const c of existingCats) {
      if (c.code_prefix) catByPrefix.set(c.code_prefix, c);
      catByName.set(c.name.toLowerCase().trim(), c);
    }
  }

  // Ensure all 26 official categories exist
  let catsCreated = 0;
  let catsExisting = 0;

  for (const [prefix, name] of Object.entries(OFFICIAL_CATEGORIES)) {
    if (catByPrefix.has(prefix)) {
      catsExisting++;
      continue;
    }
    
    // Check by name (case-insensitive)
    const nameKey = name.toLowerCase().trim();
    if (catByName.has(nameKey)) {
      // Update code_prefix if missing
      const existing = catByName.get(nameKey);
      if (!existing.code_prefix || existing.code_prefix !== prefix) {
        await supabase.from('inventory_categories')
          .update({ code_prefix: prefix })
          .eq('id', existing.id);
        console.log(`  🔄 Updated prefix for "${name}": ${prefix}`);
      }
      catByPrefix.set(prefix, existing);
      catsExisting++;
      continue;
    }

    // Create new category
    const normalized = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const { data: newCat, error } = await supabase.from('inventory_categories').insert({
      name: name,
      normalized_name: normalized,
      code_prefix: prefix,
      is_active: true,
      sort_order: parseInt(prefix, 10),
    }).select().single();

    if (error) {
      console.error(`  ❌ Failed to create category "${name}": ${error.message}`);
    } else {
      catByPrefix.set(prefix, newCat);
      catByName.set(name.toLowerCase().trim(), newCat);
      catsCreated++;
      console.log(`  ✅ Created category: ${name} (prefix: ${prefix})`);
    }
  }

  console.log(`  Summary: ${catsCreated} created, ${catsExisting} already existed`);

  // Refresh category map for product assignment
  const { data: allCats } = await supabase.from('inventory_categories').select('id, name, code_prefix');
  const categoryIdByPrefix = new Map();
  if (allCats) {
    for (const c of allCats) {
      if (c.code_prefix) categoryIdByPrefix.set(c.code_prefix, c.id);
    }
  }
  console.log('');

  // ──────────────────────────────────────────────────────
  // PHASE 5: UPSERT BRANDS
  // ──────────────────────────────────────────────────────
  console.log('━━━ PHASE 5: UPSERT BRANDS ━━━');

  // Normalize brand name aliases
  const brandAliases = {
    'lataffa': 'Lattafa',
    'coca': 'Coca-Cola',
    'ambev': 'Ambev',
    'fox': 'Fox for Men',
    'produção': 'Produção Própria',
    'aguá': 'Água',
  };

  function normalizeBrand(raw) {
    if (!raw || raw.trim() === '') return null;
    const clean = raw.trim();
    const lower = clean.toLowerCase();
    if (brandAliases[lower]) return brandAliases[lower];
    return clean;
  }

  const uniqueBrands = [...new Set(rawRows.map(r => normalizeBrand(r.brand_raw)).filter(Boolean))];
  
  const { data: existingBrands } = await supabase.from('product_brands').select('id, name');
  const brandMap = new Map();
  if (existingBrands) {
    for (const b of existingBrands) brandMap.set(b.name.toLowerCase().trim(), b.id);
  }

  let brandsCreated = 0;
  for (const brandName of uniqueBrands) {
    const key = brandName.toLowerCase().trim();
    if (!brandMap.has(key)) {
      const { data: newBrand, error } = await supabase.from('product_brands').insert({
        name: brandName,
        normalized_name: brandName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(),
        is_active: true,
      }).select().single();

      if (error) {
        console.error(`  ❌ Failed to create brand "${brandName}": ${error.message}`);
      } else {
        brandMap.set(key, newBrand.id);
        brandsCreated++;
      }
    }
  }

  console.log(`  Summary: ${brandsCreated} created, ${uniqueBrands.length - brandsCreated} already existed`);
  console.log('');

  // ──────────────────────────────────────────────────────
  // PHASE 6: UPSERT PRODUCTS
  // ──────────────────────────────────────────────────────
  console.log('━━━ PHASE 6: UPSERT PRODUCTS ━━━');

  const productPayloads = [];

  for (const row of rawRows) {
    const prefix = row.code.split('_')[0];
    const categoryId = categoryIdByPrefix.get(prefix) || null;
    const brand = normalizeBrand(row.brand_raw);
    const brandId = brand ? (brandMap.get(brand.toLowerCase().trim()) || null) : null;

    // Determine resale / internal use based on category
    const isInternalOnly = INTERNAL_USE_CATEGORIES.has(prefix);
    // Category 7 (Produto Limpeza de Pele) is used for clients → for resale
    const isForResale = !isInternalOnly;
    const isForInternalUse = isInternalOnly || ['4', '7'].includes(prefix); // Lavatório and skin products also used internally

    if (!categoryId) {
      console.log(`  ⚠️ No category found for prefix ${prefix} (product: ${row.name})`);
    }

    productPayloads.push({
      external_code: row.code,
      name: row.name,
      normalized_name: row.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(),
      category_id: categoryId,
      brand_id: brandId,
      cost_price: row.cost_price,
      markup_percent: row.markup_percent || 45,
      min_stock: row.min_stock,
      max_stock: row.max_stock || (row.min_stock > 0 ? row.min_stock * 2 : 1),
      is_for_resale: isForResale,
      is_for_internal_use: isForInternalUse,
      is_active: true,
      unit_type: 'UN',
    });
  }

  // Batch upsert in groups of 50
  let upsertedCount = 0;
  const upsertedProducts = [];

  for (let i = 0; i < productPayloads.length; i += 50) {
    const batch = productPayloads.slice(i, i + 50);
    const { data, error } = await supabase
      .from('inventory_products')
      .upsert(batch, { onConflict: 'external_code', ignoreDuplicates: false })
      .select('id, external_code, name, cost_price, sale_price_generated');

    if (error) {
      console.error(`  ❌ Batch upsert error at offset ${i}: ${error.message}`);
    } else {
      upsertedCount += data.length;
      upsertedProducts.push(...data);
    }
  }

  console.log(`  ✅ ${upsertedCount} products upserted`);
  console.log('');

  // ──────────────────────────────────────────────────────
  // PHASE 7: INITIAL STOCK MOVEMENTS
  // ──────────────────────────────────────────────────────
  console.log('━━━ PHASE 7: INITIAL STOCK MOVEMENTS ━━━');

  // Stock movements were already reset in Phase 1,
  // so current_balance is 0 for all products.
  // We generate initial_balance movements from CSV data.
  // Since the CSV doesn't have a "saldo_atual" column, we use min_stock as initial stock
  // for resale items, and 0 for internal-only items.

  const stockMovements = [];
  
  for (const row of rawRows) {
    const prefix = row.code.split('_')[0];
    const dbProduct = upsertedProducts.find(p => p.external_code === row.code);
    if (!dbProduct) continue;

    // Use min_stock as initial stock for items that need to be sellable
    const isInternalOnly = INTERNAL_USE_CATEGORIES.has(prefix);
    const initialQty = row.min_stock > 0 ? row.min_stock : 0;

    if (initialQty > 0) {
      stockMovements.push({
        product_id: dbProduct.id,
        movement_type: 'initial_balance',
        movement_reason: 'Saldo Inicial — Go-Live Import',
        source_type: 'system',
        destination_type: 'inventory',
        quantity: initialQty,
        unit_cost_snapshot: dbProduct.cost_price || 0,
        unit_sale_snapshot: dbProduct.sale_price_generated || 0,
        total_cost_snapshot: (dbProduct.cost_price || 0) * initialQty,
        total_sale_snapshot: (dbProduct.sale_price_generated || 0) * initialQty,
        movement_date: new Date().toISOString(),
        notes: `Go-Live: saldo inicial baseado no estoque mínimo (${initialQty} unidades)`,
      });
    }
  }

  if (stockMovements.length > 0) {
    for (let i = 0; i < stockMovements.length; i += 50) {
      const batch = stockMovements.slice(i, i + 50);
      const { error } = await supabase.from('stock_movements').insert(batch);
      if (error) {
        console.error(`  ❌ Stock movement batch error: ${error.message}`);
      }
    }
  }

  console.log(`  ✅ ${stockMovements.length} initial stock movements created`);
  console.log('');

  // ──────────────────────────────────────────────────────
  // PHASE 8: AUDIT LOG
  // ──────────────────────────────────────────────────────
  console.log('━━━ PHASE 8: AUDIT LOG ━━━');

  await supabase.from('audit_logs').insert({
    action: 'IMPORT',
    entity_type: 'system',
    entity_id: 'go-live-reset',
    after_data: {
      categories_created: catsCreated,
      brands_created: brandsCreated,  
      products_upserted: upsertedCount,
      stock_movements_created: stockMovements.length,
      csv_rows_parsed: rawRows.length,
      duplicate_codes_resolved: warnings.length,
      timestamp: new Date().toISOString(),
    },
    context: {
      source: 'system',
      status: 'success',
      observation: 'Go-Live Reset + Base Import executado com sucesso.',
    },
  });
  console.log('  ✅ Audit log created');
  console.log('');

  // ──────────────────────────────────────────────────────
  // FINAL SUMMARY
  // ──────────────────────────────────────────────────────
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  📊 GO-LIVE SUMMARY                                        ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  CSV Rows Parsed:        ${String(rawRows.length).padStart(5)}                            ║`);
  console.log(`║  Categories Created:     ${String(catsCreated).padStart(5)}                            ║`);
  console.log(`║  Brands Created:         ${String(brandsCreated).padStart(5)}                            ║`);
  console.log(`║  Products Upserted:      ${String(upsertedCount).padStart(5)}                            ║`);
  console.log(`║  Stock Movements:        ${String(stockMovements.length).padStart(5)}                            ║`);
  console.log(`║  Duplicate Codes Fixed:  ${String(warnings.length).padStart(5)}                            ║`);
  console.log(`║  Payment Methods Seeded: ${String(paymentMethods.length).padStart(5)}                            ║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  ✅ Go-Live Reset + Import COMPLETE                        ║');
  console.log('║  📁 Backups saved to: scripts/backup/                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  if (warnings.length > 0) {
    console.log('⚠️ WARNINGS:');
    warnings.forEach(w => console.log(`  ${w}`));
    console.log('');
  }

  // List products with their final codes for verification
  console.log('📋 Product Codes (final):');
  for (const row of rawRows) {
    const dbProduct = upsertedProducts.find(p => p.external_code === row.code);
    const stockMov = stockMovements.find(m => m.product_id === dbProduct?.id);
    const qty = stockMov ? stockMov.quantity : 0;
    console.log(`  ${row.code.padEnd(8)} ${row.name.substring(0, 45).padEnd(47)} Stk: ${qty}`);
  }
}

main().catch(err => {
  console.error('❌ FATAL ERROR:', err);
  process.exit(1);
});
