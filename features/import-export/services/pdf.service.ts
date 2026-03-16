// @ts-nocheck
import * as pdfjsLib from "pdfjs-dist"
import { ImportedProductRow } from "../types"
import { ImportParserService } from "./import.service"

/**
 * Handles extracting text from older static PDF reports Barber Zac might have
 * and converting them into normalized Structured JSON Data.
 */
export class PdfExtractionService {
  
  static async extractTextFromPdf(file: File): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        try {
          const typedArray = new Uint8Array(e.target?.result as ArrayBuffer)
          // We need setting the worker source to rely on the current version
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
          
          const loadingTask = pdfjsLib.getDocument({ data: typedArray })
          const pdf = await loadingTask.promise
          
          let fullText: string[] = []
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const textContent = await page.getTextContent()
            const pageText = textContent.items.map((item: any) => item.str).join(" ")
            fullText.push(pageText)
          }
           
          resolve(fullText)
        } catch (error) {
           reject(error)
        }
      }

      reader.onerror = (error) => reject(error)
      reader.readAsArrayBuffer(file)
    })
  }

  /**
   * VERY rudementary regex parser to try and locate "lines" of tabular data from a PDF block of text.
   * This assumes the PDF was a printed table where items follow: CODE NOME ... PRICE
   * Realistically, you would pass the `fullText` to an LLM for structured extraction.
   * For Phase 5 MVP, we'll implement a basic Regex Split and reuse the Spreadsheet rules.
   */
  static async parseProductPdf(file: File): Promise<{ valid: ImportedProductRow[], invalid: any[] }> {
    const pages = await this.extractTextFromPdf(file)
    const allText = pages.join("\n")

    // Fake structured finding: Split by expected line breaks or large spaces
    // Since PDFJS merges everything, we usually look for Product ID/Code patterns.
    // e.g., "123 Shampoo 15.00 30.00"
    const lines = allText.split(/[\n\r]+/) 
    
    // Instead of doing pure regex magic here causing errors, we will convert the text lines
    // roughly into "CSV" columns, assuming they are space-separated, and feed it to the
    // existing Spreadsheet parse method!
    const rawData = lines.map(line => {
      // Very naive splitting by 2 or more spaces
      const cols = line.split(/\s{2,}/)
      return {
        "CÓDIGO": cols[0] || "",
        "NOME": cols[1] || "",
        "PREÇO": cols[2] || "0",
      }
    }).filter(r => r["CÓDIGO"] && r["NOME"]) // Keep somewhat valid rows

    // Reuse Spreadsheet Normalizer
    const normalizedRows = ImportParserService.parseRawSpreadsheetData(rawData)
    // Validate
    const valid: ImportedProductRow[] = []
    const invalid: any[] = []

    normalizedRows.forEach((row, i) => {
      // Custom basic parse for PDF since it lacks all columns occasionally
      if (row.codigo && row.nome_produto) {
        valid.push({
           codigo: String(row.codigo),
           nome_produto: String(row.nome_produto),
           categoria: "Extraída PDF",
           custo: row.custo || 0,
           markup: row.markup || 0,
           preco_venda: row.preco_venda || 0,
           estoque_minimo: 0,
           estoque_maximo: 0,
           saldo_atual: 0,
           status: "Ativo"
        })
      } else {
        invalid.push({ row, errors: ["Faltando Código ou Nome legível"] })
      }
    })

    return { valid, invalid }
  }
}
