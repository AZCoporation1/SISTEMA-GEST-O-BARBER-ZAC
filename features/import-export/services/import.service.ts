// @ts-nocheck
import * as XLSX from "xlsx"
import Papa from "papaparse"
import { z } from "zod"
import { ImportedProductRow, productImportSchema } from "../types"

export class ImportParserService {
  /**
   * Translates the raw rows from Barber Zac legacy Excel/CSV.
   * Cleans numeric data (R$, strings, percentages) and aliases keys.
   */
  static parseRawSpreadsheetData(data: any[]): any[] {
    return data.map((rawRow, index) => {
      const cleanCurrency = (val: any) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        const s = String(val).replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.').trim()
        return parseFloat(s) || 0
      }
      
      const cleanPercent = (val: any) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        const s = String(val).replace('%', '').trim()
        return parseFloat(s) || 0
      }

      // Keys might be upper, lower, with spaces. Best effort map to the Zod Schema:
      return {
        _raw_row_index: index + 2, // Excel typically starts at 2 (1 is header)
        codigo: String(rawRow["CÓDIGO"] || rawRow["Codigo"] || rawRow["codigo"] || ""),
        nome_produto: String(rawRow["PRODUTOS"] || rawRow["NOME"] || rawRow["Produto"] || rawRow["nome_produto"] || ""),
        categoria: String(rawRow["CATEGORIA"] || rawRow["Categoria"] || rawRow["categoria"] || "Sem Categoria"),
        marca: String(rawRow["MARCA"] || rawRow["Marca"] || rawRow["marca"] || ""),
        custo: cleanCurrency(rawRow["CUSTO"] || rawRow["Custo"] || rawRow["custo"]),
        markup: cleanPercent(rawRow["%"] || rawRow["MARKUP"] || rawRow["Margem"] || rawRow["markup"]),
        preco_venda: cleanCurrency(rawRow["VALOR VENDA"] || rawRow["Preço"] || rawRow["Venda"] || rawRow["preco_venda"]),
        estoque_minimo: parseInt(rawRow["MINIMO"] || rawRow["Mínimo"] || rawRow["estoque_minimo"] || "0", 10),
        estoque_maximo: parseInt(rawRow["SUG. DE COMPRA"] || rawRow["Maximo"] || rawRow["estoque_maximo"] || "0", 10), // often Barber Zac uses Sug de Compra as a proxy or max
        saldo_atual: parseInt(rawRow["SALDO\nATUAL"] || rawRow["SALDO"] || rawRow["Saldo"] || rawRow["saldo_atual"] || "0", 10),
        status: String(rawRow["STATUS"] || rawRow["Status"] || rawRow["status"] || "Ativo").trim()
      }
    })
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
          // If it's a CSV, papaparse could handle it directly, 
          // but XLSX library reads CSVs fine as well. Let's use XLSX for both as unified entry
          const workbook = XLSX.read(data, { type: 'binary' })
          const firstSheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[firstSheetName]
          rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" })
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
