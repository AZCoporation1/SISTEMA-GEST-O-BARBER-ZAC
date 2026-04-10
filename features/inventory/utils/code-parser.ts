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

export const SMART_SKU_PREFIXES = ['PERF', 'BEBI', 'INSU'] as const
export type SmartSKUPrefix = typeof SMART_SKU_PREFIXES[number]

export interface ParsedCode {
  prefix: SmartSKUPrefix | null;
  number: string | null;
  isValid: boolean;
  raw: string;
}

const SMART_SKU_REGEX = /^(PERF|BEBI|INSU)\s+(\d{1,3})$/i

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
