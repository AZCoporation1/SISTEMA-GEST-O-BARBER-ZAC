/**
 * Product Code Formatting Helper
 * Renders the external_code (Smart SKU format like "PERF 001", "BEBI 002")
 * as a premium visual prefix for product names.
 *
 * This is a VISUAL-ONLY helper — it does not alter any data or backend logic.
 */

/**
 * Returns the formatted product code string
 * @example formatProductCode("PERF 001") → "PERF 001"
 * @example formatProductCode(null) → null
 */
export function formatProductCode(externalCode: string | null | undefined): string | null {
  if (!externalCode || externalCode.trim() === '') return null
  return externalCode.trim()
}

/**
 * Returns a full display string with code + product name
 * @example formatProductDisplay("PERF 001", "1 Million 200ml") → "PERF 001 • 1 Million 200ml"
 * @example formatProductDisplay(null, "Ativador de cachos") → "Ativador de cachos"
 */
export function formatProductDisplay(
  externalCode: string | null | undefined,
  productName: string
): string {
  const code = formatProductCode(externalCode)
  if (!code) return productName
  return `${code} • ${productName}`
}
