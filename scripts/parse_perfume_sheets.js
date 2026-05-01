const XLSX = require('xlsx');
const path = require('path');

const filePath = path.resolve(__dirname, '..', '..', 'Inventario para sistema Barber Zac perfumes  ATT.xlsx');
const wb = XLSX.readFile(filePath);

// Focus on perfume sheets
const perfumeSheets = ['SKUs Perfumesr', 'Estoque - Perfumes', 'Estoque de Perfumes'];

perfumeSheets.forEach(name => {
  const ws = wb.Sheets[name];
  if (!ws) {
    console.log(`\n=== Sheet "${name}" NOT FOUND ===`);
    return;
  }
  const ref = ws['!ref'] || 'A1';
  const range = XLSX.utils.decode_range(ref);
  console.log(`\n=== Sheet: ${name} ===`);
  console.log(`Range: ${ref} | Rows: ${range.e.r + 1} | Cols: ${range.e.c + 1}`);
  
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const maxRows = Math.min(200, data.length);
  for (let i = 0; i < maxRows; i++) {
    const row = data[i];
    const hasData = row.some(cell => cell !== '' && cell !== null && cell !== undefined);
    if (hasData) {
      console.log(`Row ${i}: ${JSON.stringify(row)}`);
    }
  }
  console.log('Total rows:', data.length);
});

// Also inspect main sheet for full perfume rows  
console.log('\n=== MAIN SHEET: Estoque - Barbearia ===');
const mainWs = wb.Sheets['Estoque - Barbearia'];
if (mainWs) {
  const data = XLSX.utils.sheet_to_json(mainWs, { header: 1, defval: '' });
  // Show first 5 rows (headers)
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    const hasData = row.some(cell => cell !== '' && cell !== null && cell !== undefined);
    if (hasData) {
      console.log(`Row ${i}: ${JSON.stringify(row)}`);
    }
  }
}

// Also show the LISTA DE ESTOQUE sheet
console.log('\n=== Sheet: LISTA DE ESTOQUE ===');
const listaWs = wb.Sheets['LISTA DE ESTOQUE'];
if (listaWs) {
  const data = XLSX.utils.sheet_to_json(listaWs, { header: 1, defval: '' });
  for (let i = 0; i < Math.min(50, data.length); i++) {
    const row = data[i];
    const hasData = row.some(cell => cell !== '' && cell !== null && cell !== undefined);
    if (hasData) {
      console.log(`Row ${i}: ${JSON.stringify(row)}`);
    }
  }
  console.log('Total rows:', data.length);
}
