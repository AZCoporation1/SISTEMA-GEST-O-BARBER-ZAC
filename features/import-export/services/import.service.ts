// @ts-nocheck
import * as XLSX from "xlsx"
import Papa from "papaparse"
import { z } from "zod"
import { ImportedProductRow, productImportSchema } from "../types"

export class ImportParserService {
  /**
   * Translates the raw rows from Barber Zac legacy Excel/CSV.
   * Cleans numeric data (R$, strings, percentages) and aliases keys.
   *
   * Revised for the Smart SKU spreadsheet format:
   * - Barbearia sheet: has Valor R$ Compra (real cost), Porcentagem %, Valor Venda
   * - Bebidas sheet: has Valor R$ Compra (real cost), Porcentagem %, Valor Venda
   * - Perfumes sheet: has Valor a Vista / Valor a Prazo (sale prices, NOT cost)
   *
   * CRITICAL: Never infer cost_price from sale price columns.
   */
  static parseRawSpreadsheetData(data: any[]): any[] {
    const parsedData = data.map((rawRow, index) => {
      const cleanCurrency = (val: any) => {
        if (!val && val !== 0) return 0;
        if (typeof val === 'number') return val;
        const s = String(val).replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.').trim()
        return parseFloat(s) || 0
      }

      const cleanPercent = (val: any) => {
        if (!val && val !== 0) return 0;
        if (typeof val === 'number') return val;
        const s = String(val).replace('%', '').trim().replace(',', '.')
        return parseFloat(s) || 0
      }

      const cleanStock = (val: any) => {
        if (!val && val !== 0) return 0;
        if (typeof val === 'number') return Math.max(0, Math.ceil(val));
        const s = String(val).replace(',', '.').trim();
        return Math.max(0, Math.ceil(parseFloat(s) || 0));
      }

      // Smart SKU code from Item column
      const codigo = String(rawRow["Item"] || rawRow["CÓDIGO"] || rawRow["Codigo"] || rawRow["codigo"] || "").trim();

      // Product name — widened aliases
      const nome_produto = String(
        rawRow["Descrição"] || rawRow["PRODUTOS"] || rawRow["NOME"] || rawRow["Produto"] || rawRow["nome_produto"] || ""
      ).trim();

      // Category
      const categoria = String(
        rawRow["Categoria"] || rawRow["CATEGORIA"] || rawRow["categoria"] || "Sem Categoria"
      ).trim();

      // Brand
      const marca = String(rawRow["Marca"] || rawRow["MARCA"] || rawRow["marca"] || "").trim();

      // COST PRICE — ONLY from explicit cost columns
      // "Valor R$ Compra" or "CUSTO" — these are real purchase costs
      // NEVER from "Valor a Vista" or "Valor a Prazo" (those are sale prices)
      const custo = cleanCurrency(
        rawRow["Valor R$ Compra"] || rawRow["CUSTO"] || rawRow["Custo"] || rawRow["custo"]
      );

      // Markup percentage
      const markup = cleanPercent(
        rawRow["Porcentagem %"] || rawRow["%"] || rawRow["MARKUP"] || rawRow["Margem"] || rawRow["markup"]
      );

      // SELLING PRICE — can come from explicit sale columns or Valor a Vista
      const preco_venda = cleanCurrency(
        rawRow["Valor Venda"] || rawRow["VALOR VENDA"] || rawRow["Preço"] ||
        rawRow["Valor a Vista"] || rawRow["Venda"] || rawRow["preco_venda"]
      );

      // Stock quantity — widened aliases for Estoque column
      const saldo_atual = cleanStock(
        rawRow["Estoque"] || rawRow["Qtde Estoque"] || rawRow["SALDO\nATUAL"] ||
        rawRow["SALDO"] || rawRow["Saldo"] || rawRow["saldo_atual"] ||
        rawRow["Saldo Estoque"] || rawRow["Estoque dia"] || rawRow["Estoque Dia"]
      );

      // Min / Max stock
      const estoque_minimo = cleanStock(
        rawRow["Qtde Minimo"] || rawRow["MINIMO"] || rawRow["Mínimo"] || rawRow["estoque_minimo"]
      );
      const estoque_maximo = cleanStock(
        rawRow["Qtde Maximo"] || rawRow["SUG. DE COMPRA"] || rawRow["Maximo"] || rawRow["estoque_maximo"]
      );

      const status = String(rawRow["STATUS"] || rawRow["Status"] || rawRow["status"] || "Ativo").trim();

      return {
        _raw_row_index: index + 2,
        codigo,
        nome_produto,
        categoria,
        marca,
        custo,
        markup,
        preco_venda,
        estoque_minimo,
        estoque_maximo,
        saldo_atual,
        status
      }
    })

    return parsedData.filter(row => row.codigo && row.codigo !== "");
  }

  static async parseFile(file: File): Promise<{ valid: ImportedProductRow[], invalid: any[] }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        const data = e.target?.result
        if (!data) {
          return reject("Could not read file data.")
        }

        let rawRows: any[] = []

        try {
          const workbook = XLSX.read(data, { type: 'binary' })

          // Filter out hidden sheets — only process visible ones
          const visibleSheetNames = workbook.SheetNames.filter((name, idx) => {
            const hidden = workbook.Workbook?.Sheets?.[idx]?.Hidden
            return !hidden || hidden === 0
          })

          // Merge data from all visible sheets
          for (const sheetName of visibleSheetNames) {
            const worksheet = workbook.Sheets[sheetName]
            if (!worksheet || !worksheet['!ref']) continue
            
            // Auto-detect header row: scan raw rows for the one starting with "Item"
            const rawArrayRows = XLSX.utils.sheet_to_json(worksheet, { defval: "", header: 1 }) as any[][]
            const headerRowIdx = rawArrayRows.findIndex(r => 
              String(r[0] || '').trim() === 'Item' || 
              String(r[0] || '').trim() === 'CÓDIGO' ||
              String(r[0] || '').trim() === 'Codigo'
            )
            
            let sheetRows: any[]
            if (headerRowIdx >= 0) {
              // Parse using the detected header row as column names
              sheetRows = XLSX.utils.sheet_to_json(worksheet, { defval: "", range: headerRowIdx })
            } else {
              // Fallback: use default (row 0 as header)
              sheetRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" })
            }
            
            rawRows.push(...sheetRows)
          }
        } catch (err: any) {
          return reject("Failed to parse spreadsheet: " + err.message)
        }

        const normalizedRows = this.parseRawSpreadsheetData(rawRows)
        const valid: ImportedProductRow[] = []
        const invalid: any[] = []

        normalizedRows.forEach((row) => {
          const parsed = productImportSchema.safeParse(row)
          if (parsed.success) {
            valid.push(parsed.data as ImportedProductRow)
          } else {
            invalid.push({ row, errors: parsed.error.errors.map(e => e.message) })
          }
        })

        resolve({ valid, invalid })
      }

      reader.onerror = (error) => reject(error)

      reader.readAsBinaryString(file)
    })
  }
}
