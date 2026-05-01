const XLSX = require('xlsx');
const path = require('path');

const filePath = path.resolve(__dirname, '..', '..', 'Inventario para sistema Barber Zac perfumes  ATT.xlsx');
const wb = XLSX.readFile(filePath);

// Extract ALL perfume data from LISTA DE ESTOQUE sheet
const ws = wb.Sheets['LISTA DE ESTOQUE'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

console.log('=== FULL PERFUME LIST (LISTA DE ESTOQUE) ===');
console.log('Header row (row 3):', JSON.stringify(data[3]));
console.log('');

let perfumeCount = 0;
const perfumes = [];

for (let i = 4; i < data.length; i++) {
  const row = data[i];
  // Check if row has a PERF code in column B (index 1)
  const code = String(row[1] || '').trim();
  const desc = String(row[2] || '').trim();
  if (code.startsWith('PERF') && desc) {
    perfumeCount++;
    perfumes.push({
      rowIdx: i,
      code: code,
      name: desc,
      category: String(row[3] || '').trim(),
      brand: String(row[4] || '').trim(),
      stockDia: row[5],
      maxStock: row[6],
      minStock: row[7],
      stock: row[8],
      vistaPrice: row[9],
      prazoPrice: row[10]
    });
    console.log(`Row ${i}: Code=${code} | Name=${desc} | Cat=${String(row[3]||'').trim()} | Brand=${String(row[4]||'').trim()} | Stock=${row[8]} | Vista=R$${row[9]} | Prazo=R$${row[10]}`);
  }
}

console.log('\n=== SUMMARY ===');
console.log('Total perfume items:', perfumeCount);

// Extract highest PERF number
const perfNums = perfumes.map(p => {
  const m = p.code.match(/PERF\s*(\d+)/);
  return m ? parseInt(m[1]) : 0;
});
console.log('Highest PERF number:', Math.max(...perfNums));

// Check for duplicate names
const nameMap = {};
perfumes.forEach(p => {
  const normName = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (!nameMap[normName]) nameMap[normName] = [];
  nameMap[normName].push(p.code);
});
const dupes = Object.entries(nameMap).filter(([k, v]) => v.length > 1);
console.log('\nDuplicate names in workbook:', dupes.length);
dupes.forEach(([name, codes]) => console.log(`  "${name}" -> ${codes.join(', ')}`));

// Categories
const cats = [...new Set(perfumes.map(p => p.category))].sort();
console.log('\nCategories:', cats.length);
cats.forEach(c => console.log(`  - ${c}`));

// Brands
const brands = [...new Set(perfumes.map(p => p.brand))].sort();
console.log('\nBrands:', brands.length);
brands.forEach(b => console.log(`  - ${b}`));
