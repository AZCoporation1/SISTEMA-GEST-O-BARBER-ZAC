import fs from 'fs';
import readline from 'readline';
import { createClient } from '@supabase/supabase-js';

const PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!PROJECT_URL || !SERVICE_KEY) {
  console.log("Missing Supabase Environmental variables.");
  process.exit(1);
}
const supabase = createClient(PROJECT_URL, SERVICE_KEY);

const CSV_FILE = 'C:\\Users\\granc\\Desktop\\Sistema de gestão Barber Zac\\Inventario para sistema Barber Zac - Estoque.csv';

// Normalizers
function normalizeString(str) {
  if (!str) return null;
  return str.trim().replace(/\s{2,}/g, ' ');
}

function normalizeCategoryName(cat) {
  if (!cat) return 'Sem Categoria';
  let clean = normalizeString(cat).toLowerCase();
  
  // Aliases for inconsistent data
  if (clean === 'lavatorio' || clean === 'lavatório ') return 'Lavatório';
  if (clean === 'quimicas') return 'Químicas';
  if (clean === 'insumos') return 'Insumos';
  if (clean === 'produto limpeza de pele' || clean.includes('limpeza')) return 'Produtos de Limpeza';
  
  // Title case
  return clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function parseCurrency(val) {
  if (!val) return null;
  const clean = val.replace(/R\$\s*/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

function parsePercent(val) {
  if (!val) return 45; 
  const clean = val.replace(/%/g, '').replace(/,/g, '.').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 45 : num;
}

function parseIntSafe(val) {
  if (!val) return 0;
  const num = parseInt(val.trim(), 10);
  return isNaN(num) ? 0 : num;
}

// parsing CSV lines with quotes
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

async function run() {
  console.log("🌱 Iniciando Seed Oficial do Barber Zac...");

  const rawRows = [];
  const fileStream = fs.createReadStream(CSV_FILE, 'utf-8');
  const rl = readline.createInterface({ input: fileStream });

  let rowCount = 0;
  for await (const line of rl) {
    rowCount++;
    if (rowCount <= 4) continue; // skip header empty space
    if (!line.trim() || line.replace(/,/g, '').trim() === '') continue;

    const cols = parseCSVLine(line);
    const code = normalizeString(cols[1]); // Col B
    if (!code) continue;

    rawRows.push({
      code,
      name: normalizeString(cols[2]), // Col C
      category: normalizeCategoryName(cols[3]), // Col D
      brand: normalizeString(cols[4]), // Col E
      qty_max: parseIntSafe(cols[5]), // Col F
      qty_min: parseIntSafe(cols[6]), // Col G
      cost: parseCurrency(cols[7]), // Col H
      markup: parsePercent(cols[8]), // Col I
    });
  }

  console.log(`Lidos ${rawRows.length} produtos da planilha legada.`);

  // 1. Sync Categories
  const categoryNames = [...new Set(rawRows.map(r => r.category))];
  const catMap = {};
  for (const cName of categoryNames) {
    const { data: existing } = await supabase.from('inventory_categories').select('id').ilike('name', cName).single();
    if (existing) {
      catMap[cName] = existing.id;
    } else {
      const normalized_name = cName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const { data: inserted, error: e1 } = await supabase.from('inventory_categories').insert({ name: cName, normalized_name, is_active: true, code_prefix: cName.substring(0,3).toUpperCase() }).select('id').single();
      if (inserted) catMap[cName] = inserted.id;
      if (e1) console.log("Category insert err:", e1)
    }
  }

  // 2. Sync Brands
  const brandNames = [...new Set(rawRows.map(r => r.brand).filter(b => b))];
  const brandMap = {};
  for (const bName of brandNames) {
    const { data: existing } = await supabase.from('product_brands').select('id').ilike('name', bName).single();
    if (existing) {
      brandMap[bName] = existing.id;
    } else {
      const { data: inserted, error: e2 } = await supabase.from('product_brands').insert({ name: bName }).select('id').single();
      if (inserted) brandMap[bName] = inserted.id;
      // if (e2) console.log("Brand insert err:", e2) // brands might not have direct table if using just varchar?
      // Wait, let's look at the database schema. If `brands` table doesn't exist, this will crash.
    }
  }

  // Check if brands table exists
  let useBrandsTable = true;
  const { error: brandCheckError } = await supabase.from('product_brands').select('id').limit(1);
  if (brandCheckError) {
      console.log("Brands table might not exist, using varchar in products directly.");
      useBrandsTable = false;
  }

  // 3. Process products
  const products = [];
  const missingCostProducts = [];

  for (const raw of rawRows) {
    const cost = raw.cost;
    const markup = raw.markup || 45;
    if (cost === null || cost === 0) missingCostProducts.push(raw.code);

    let productPayload = {
      external_code: raw.code,
      name: raw.name,
      normalized_name: raw.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(),
      category_id: catMap[raw.category] || null,
      min_stock: raw.qty_min || 0,
      max_stock: raw.qty_max || 0,
      cost_price: cost || 0,
      markup_percent: markup,
      is_for_resale: true,
      is_for_internal_use: true,
      unit_type: 'UN',
      is_active: true
    };
    
    // Add brand logic depending on DB schema
    if (useBrandsTable) {
        productPayload.brand_id = raw.brand ? brandMap[raw.brand] : null;
    } else {
        productPayload.brand = raw.brand;
    }

    products.push(productPayload);
  }

  // Deduplication check
  const codeSet = new Set();
  const uniqueProducts = [];
  for (const p of products) {
      if (codeSet.has(p.external_code)) {
          console.log(`Duplicata ignorada no banco: [Cód ${p.external_code}] ${p.name}`);
      } else {
          codeSet.add(p.external_code);
          uniqueProducts.push(p);
      }
  }

  // 4. Batch Upsert Data
  let insertedCount = 0;
  for (let i = 0; i < uniqueProducts.length; i += 50) {
    const batch = uniqueProducts.slice(i, i + 50);
    const { data, error } = await supabase.from('inventory_products').upsert(batch, { onConflict: 'external_code', ignoreDuplicates: false }).select('id');
    if (error) {
      console.error("Erro no batch:", error);
    } else {
      insertedCount += data.length;
    }
  }

  console.log(`✅ Foram inseridos/atualizados ${insertedCount} produtos com sucesso.`);
  console.log(`⚠️ ATENÇÃO: ${missingCostProducts.length} itens detectados sem Custo de Compra (marcados para revisão na view do Operator AI).`);
}

run();
