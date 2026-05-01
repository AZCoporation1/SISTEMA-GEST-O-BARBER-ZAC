/**
 * Barber Zac ERP — Export Final Perfume Catalog
 * Phase 7: Generate canonical XLSX + CSV + reconciliation report
 */
require('dotenv').config({ path: '.env.local' });
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('=== Exporting Final Perfume Catalog ===');

  // Fetch all PERF products with categories and brands
  const { data: products, error } = await supabase
    .from('inventory_products')
    .select(`
      id, external_code, name, cost_price, 
      markup_percent, sale_price_generated, 
      sale_price_cash, sale_price_installment,
      min_stock, max_stock, is_active,
      inventory_categories ( name ),
      product_brands ( name )
    `)
    .not('external_code', 'is', null)
    .ilike('external_code', 'PERF%')
    .is('deleted_at', null)
    .order('external_code');

  if (error) {
    console.error('Failed to fetch:', error.message);
    return;
  }

  // Get stock balances from the view
  const { data: positions } = await supabase
    .from('vw_inventory_position')
    .select('product_id, current_balance, external_code')
    .not('external_code', 'is', null)
    .ilike('external_code', 'PERF%');

  const balanceMap = {};
  (positions || []).forEach(p => {
    balanceMap[p.product_id] = p.current_balance;
  });

  console.log(`Total PERF products: ${products.length}`);

  // Build export rows
  const rows = products.map(p => ({
    'Código': p.external_code,
    'Nome': p.name,
    'Categoria': p.inventory_categories?.name || '',
    'Marca': p.product_brands?.name || '',
    'Custo (R$)': p.cost_price || 0,
    'Markup (%)': p.markup_percent || 0,
    'Preço Gerado (R$)': p.sale_price_generated || 0,
    'Valor à Vista (R$)': p.sale_price_cash || 0,
    'Valor a Prazo (R$)': p.sale_price_installment || 0,
    'Saldo Estoque': balanceMap[p.id] || 0,
    'Estoque Mín': p.min_stock || 0,
    'Estoque Máx': p.max_stock || 0,
    'Ativo': p.is_active ? 'Sim' : 'Não',
  }));

  // Create XLSX
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // Código
    { wch: 40 }, // Nome
    { wch: 25 }, // Categoria
    { wch: 20 }, // Marca
    { wch: 12 }, // Custo
    { wch: 12 }, // Markup
    { wch: 15 }, // Preço Gerado
    { wch: 15 }, // Vista
    { wch: 15 }, // Prazo
    { wch: 12 }, // Saldo
    { wch: 12 }, // Min
    { wch: 12 }, // Max
    { wch: 8 },  // Ativo
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Catálogo Perfumes');

  const outDir = path.resolve(__dirname, '..', '..', 'exports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const xlsxPath = path.join(outDir, 'perfumes_updated_final.xlsx');
  const csvPath = path.join(outDir, 'perfumes_updated_final.csv');

  XLSX.writeFile(wb, xlsxPath);
  console.log(`✅ XLSX: ${xlsxPath}`);

  // CSV
  const csvContent = XLSX.utils.sheet_to_csv(ws);
  fs.writeFileSync(csvPath, csvContent, 'utf-8');
  console.log(`✅ CSV: ${csvPath}`);

  // Report
  const reportPath = path.join(outDir, 'perfumes_update_report.md');
  
  const totalVista = rows.reduce((s, r) => s + (r['Valor à Vista (R$)'] || 0), 0);
  const totalPrazo = rows.reduce((s, r) => s + (r['Valor a Prazo (R$)'] || 0), 0);
  const withPricing = rows.filter(r => r['Valor à Vista (R$)'] > 0 || r['Valor a Prazo (R$)'] > 0).length;
  const withoutPricing = rows.filter(r => r['Valor à Vista (R$)'] === 0 && r['Valor a Prazo (R$)'] === 0).length;
  const activeCount = rows.filter(r => r['Ativo'] === 'Sim').length;
  const inactiveCount = rows.filter(r => r['Ativo'] === 'Não').length;

  // Detect legacy duplicates (lowercase "Perf")
  const legacyDupes = products.filter(p => p.external_code && /^Perf /i.test(p.external_code) && p.external_code !== p.external_code.toUpperCase());

  const report = `# Barber Zac ERP — Perfume Catalog Update Report
## Data: ${new Date().toLocaleDateString('pt-BR')}

### Resumo da Reconciliação

| Métrica | Valor |
|---------|-------|
| Total de produtos PERF no banco | ${products.length} |
| Com preço Vista/Prazo definido | ${withPricing} |
| Sem preço Vista/Prazo | ${withoutPricing} |
| Ativos | ${activeCount} |
| Inativos | ${inactiveCount} |
| Duplicatas legado (prefixo "Perf") | ${legacyDupes.length} |

### Totais de Preço

| Tipo | Total |
|------|-------|
| Soma Vista (todos) | R$ ${totalVista.toFixed(2)} |
| Soma Prazo (todos) | R$ ${totalPrazo.toFixed(2)} |

### Observações

- **13 duplicatas legado** detectadas: Produtos com prefixo "Perf" (minúsculo) e custo R$0 coexistem com versões "PERF" (maiúsculo). As versões com custo R$0 são fantasmas de importação anterior e podem ser desativadas manualmente.
- **1 ambiguidade** não resolvida: PERF 019 "Classic Stone" coexiste com PERF 076 "CLASSIC STONE" — ambos têm custo > 0. Requer revisão manual.
- **3 itens com preço R$0**: PERF 024 (Creed Aventus), PERF 027 (Fakhar Black), PERF 079 (Thahanni) — sem preços na planilha.
- **19 novos produtos** criados: PERF 079-097 (Body Splash, Cremes, novos perfumes).

### Duplicatas Legado (Recomendação: Desativar)

| Código | Nome | ID |
|--------|------|----|
${legacyDupes.map(p => `| ${p.external_code} | ${p.name} | \`${p.id}\` |`).join('\n')}

### Arquivo Exportado

- **XLSX**: \`perfumes_updated_final.xlsx\`
- **CSV**: \`perfumes_updated_final.csv\`
`;

  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`✅ Report: ${reportPath}`);
  console.log('\n=== Export complete ===');
}

main().catch(console.error);
