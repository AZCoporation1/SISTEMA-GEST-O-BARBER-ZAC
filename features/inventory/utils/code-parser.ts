/**
 * Barber Zac ERP - Smart SKU Code Parser
 * Official Format: [PREFIX] [3-DIGIT NUMBER]
 * Examples: "PERF 001", "BEBI 002", "INSU 015"
 *
 * Prefix families:
 *   PERF = Perfumaria
 *   BEBI = Bebidas e Conveniência
 *   INSU = Insumos / Home Care / Barbearia
 */

export const SMART_SKU_PREFIXES = ['PERF', 'BEBI', 'INSU', 'RELO'] as const
export type SmartSKUPrefix = typeof SMART_SKU_PREFIXES[number]

export interface ParsedCode {
  prefix: SmartSKUPrefix | null;
  number: string | null;
  isValid: boolean;
  raw: string;
}

const SMART_SKU_REGEX = /^(PERF|BEBI|INSU|RELO)\s+(\d{1,3})$/i

/**
 * Parse a Smart SKU external code.
 * Supports the canonical format "PREFIX NNN" (e.g. "PERF 001").
 * Returns a graceful fallback for legacy or malformed codes.
 */
export function parseExternalCode(code: string | null | undefined): ParsedCode {
  if (!code) {
    return { prefix: null, number: null, isValid: false, raw: "" };
  }

  const raw = code.trim();
  const match = raw.match(SMART_SKU_REGEX);

  if (match) {
    return {
      prefix: match[1].toUpperCase() as SmartSKUPrefix,
      number: match[2].padStart(3, '0'),
      isValid: true,
      raw
    };
  }

  // Graceful fallback for legacy or malformed codes — do not crash
  return {
    prefix: null,
    number: null,
    isValid: false,
    raw
  };
}

/**
 * Generate a Smart SKU code from prefix and sequential number.
 * @example formatSmartSKU("PERF", 1)  → "PERF 001"
 * @example formatSmartSKU("BEBI", 12) → "BEBI 012"
 */
export function formatSmartSKU(prefix: SmartSKUPrefix, num: number): string {
  return `${prefix} ${String(num).padStart(3, '0')}`
}

/**
 * Check if a given code is already a valid Smart SKU.
 */
export function isValidSmartSKU(code: string | null | undefined): boolean {
  if (!code) return false
  return SMART_SKU_REGEX.test(code.trim())
}

/**
 * Resolves the Smart SKU prefix based on category name.
 */
export function getPrefixByCategoryName(categoryName: string | null | undefined): SmartSKUPrefix {
  if (!categoryName) return 'INSU'
  const name = categoryName.toLowerCase().trim()
  if (name.includes('perfum') || name.includes('fragranc') || name.includes('amadeirad')
    || name.includes('oriental') || name.includes('floral') || name.includes('aromátic')
    || name.includes('fougère') || name.includes('bergamot') || name.includes('baunilha')
    || name.includes('especiad') || name.includes('bolso') || name.includes('cabelo')
    || name.includes('frutado') || name.includes('gourmet')) {
    return 'PERF'
  }
  if (name.includes('bebid') || name.includes('refrigerant') || name.includes('energétic')
    || name.includes('água') || name.includes('cervej') || name.includes('conveniênc')
    || name.includes('coca') || name.includes('suco') || name === 'agua') {
    return 'BEBI'
  }
  if (name === 'relo' || name.includes('relóg') || name.includes('smartwatch') || name.includes('acessório')) {
    return 'RELO'
  }
  return 'INSU'
}
