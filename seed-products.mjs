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

function parseCSVLine(text) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
        inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(s => s.trim());
}

async function run() {
  const { data: categories } = await supabase.from('categories').select('*');
  const catMap = {};
  for (const c of categories) {
    catMap[c.code_prefix] = c.id;
  }

  const fileStream = fs.createReadStream(CSV_FILE, 'utf-8');
  const rl = readline.createInterface({ input: fileStream });

  const products = [];
  let rowCount = 0;

  for await (const line of rl) {
    rowCount++;
    if (rowCount <= 4) continue;
    
    if (!line.trim() || line.replace(/,/g, '').trim() === '') continue;

    const cols = parseCSVLine(line);
    
    let code = cols[1];
    let description = cols[2];
    
    if (!code || !description) continue;
    
    let categoryId = null;
    if (code.includes('_')) {
        const prefix = code.split('_')[0];
        categoryId = catMap[prefix];
    }
    
    // Add prefix if missing e.g. code is just "1" but already 1 exists, wait.
    // Let's just create a unique code if it's strange
    
    products.push({
      code: code.trim(),
      description: description.trim(),
      brand: cols[4] || null,
      category_id: categoryId || null,
      qty_min: parseIntSafe(cols[6]),
      qty_max: parseIntSafe(cols[5]),
      purchase_price: parseCurrency(cols[7]),
      markup_percent: parsePercent(cols[8]),
      qty_current: 0,
      is_active: true
    });
  }

  console.log(`Parsed ${products.length} products to insert.`);
  
  // check for duplicate codes
  const codeSet = new Set();
  const uniqueProducts = [];
  for (const p of products) {
      if (codeSet.has(p.code)) {
          console.log(`Duplicate code ignored: ${p.code} (${p.description})`);
      } else {
          codeSet.add(p.code);
          uniqueProducts.push(p);
      }
  }
  
  console.log(`Unique products: ${uniqueProducts.length}`);

  let inserted = 0;
  for (let i = 0; i < uniqueProducts.length; i += 50) {
    const batch = uniqueProducts.slice(i, i + 50);
    const { data, error } = await supabase.from('products').upsert(batch, { onConflict: 'code' }).select('id');
    if (error) {
      console.error('Batch error:', error.message, batch);
    } else {
      inserted += data?.length || 0;
    }
  }
  console.log(`Inserted ${inserted} products.`);
}
run();
