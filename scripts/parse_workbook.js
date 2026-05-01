const XLSX = require('xlsx');
const path = require('path');

const filePath = path.resolve(__dirname, '..', '..', 'Inventario para sistema Barber Zac perfumes  ATT.xlsx');
const wb = XLSX.readFile(filePath);

console.log('=== SHEET NAMES ===');
console.log(wb.SheetNames);

wb.SheetNames.forEach(name => {
  const ws = wb.Sheets[name];
  const ref = ws['!ref'] || 'A1';
  const range = XLSX.utils.decode_range(ref);
  console.log('\n=== Sheet:', name, '===');
  console.log('Range:', ref, '| Rows:', range.e.r + 1, '| Cols:', range.e.c + 1);

  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  // Print all rows (up to 200)
  const maxRows = Math.min(200, data.length);
  for (let i = 0; i < maxRows; i++) {
    const row = data[i];
    // Skip fully empty rows
    const hasData = row.some(cell => cell !== '' && cell !== null && cell !== undefined);
    if (hasData) {
      console.log('Row ' + i + ':', JSON.stringify(row));
    }
  }
  console.log('Total rows in sheet:', data.length);
});
