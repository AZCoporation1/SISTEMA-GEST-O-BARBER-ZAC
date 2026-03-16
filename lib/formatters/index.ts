/**
 * Format a number as BRL currency
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/**
 * Format a date in pt-BR locale
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(typeof date === 'string' ? new Date(date) : date)
}

/**
 * Format a datetime in pt-BR locale
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(typeof date === 'string' ? new Date(date) : date)
}

/**
 * Format a percentage value
 */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return '—'
  return `${value.toFixed(decimals)}%`
}

/**
 * Parse a BRL currency string to number
 */
export function parseBRLCurrency(value: string): number | null {
  if (!value || value.trim() === '' || value.trim() === 'R$ 0,00') return null
  const clean = value
    .replace('R$', '')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.')
  const parsed = parseFloat(clean)
  return isNaN(parsed) ? null : parsed
}

/**
 * Parse a percentage string to number
 */
export function parsePercent(value: string): number | null {
  if (!value) return null
  const parsed = parseFloat(value.replace('%', '').trim())
  return isNaN(parsed) ? null : parsed
}

/**
 * Compute markup value from purchase price and markup percent
 */
export function computeMarkupValue(purchasePrice: number, markupPercent: number): number {
  return Math.round(purchasePrice * (markupPercent / 100) * 100) / 100
}

/**
 * Compute sale price from purchase price and markup percent
 */
export function computeSalePrice(purchasePrice: number, markupPercent: number): number {
  const markup = computeMarkupValue(purchasePrice, markupPercent)
  return Math.round((purchasePrice + markup) * 100) / 100
}

/**
 * Get stock status based on qty values
 */
export function getStockStatus(
  qtyCurrent: number,
  qtyMin: number,
  qtyMax: number
): 'zerado' | 'critico' | 'normal' | 'excesso' {
  if (qtyCurrent <= 0) return 'zerado'
  if (qtyCurrent <= qtyMin) return 'critico'
  if (qtyMax > 0 && qtyCurrent > qtyMax) return 'excesso'
  return 'normal'
}

/**
 * Format stock status to display label
 */
export const stockStatusLabels = {
  zerado: 'Zerado',
  critico: 'Crítico',
  normal: 'Normal',
  excesso: 'Excesso',
} as const

/**
 * Get CSS class for stock status badge
 */
export const stockStatusColors = {
  zerado: 'text-red-400 bg-red-400/10 border-red-400/20',
  critico: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  normal: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  excesso: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
} as const

/**
 * Normalize category name from CSV
 */
export function normalizeCategoryName(raw: string): string {
  const map: Record<string, string> = {
    'finalizador capilar': 'Finalizador Capilar',
    'insumos': 'Insumos',
    'home care': 'Home Care',
    'lavatorio': 'Lavatório',
    'lavatorio ': 'Lavatório',
    'minoxiddil': 'Minoxidil',
    'minoxidil': 'Minoxidil',
    'produto de limpeza': 'Produto de Limpeza',
    'produto limpeza de pele': 'Produto Limpeza de Pele',
    'quimicas': 'Químicas',
    'químicas': 'Químicas',
  }
  return map[raw.toLowerCase().trim()] ?? raw.trim()
}

/**
 * Normalize brand name from CSV
 */
export function normalizeBrand(raw: string | undefined | null): string | null {
  if (!raw || raw.trim() === '') return null
  const map: Record<string, string> = {
    'fox': 'Fox For Men',
    'fox for men': 'Fox For Men',
    'aguá': 'Água',
    'agua': 'Água',
  }
  return map[raw.toLowerCase().trim()] ?? raw.trim()
}

/**
 * Get category code prefix from product code (e.g., "1_1" → "1")
 */
export function getCategoryPrefix(code: string): string {
  return code.split('_')[0] ?? ''
}

/**
 * Format a number with Brazilian thousands separator
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('pt-BR').format(value)
}

/**
 * Truncate text to max length
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * Get relative time (e.g. "há 2 horas")
 */
export function getRelativeTime(date: string | Date): string {
  const now = new Date()
  const then = typeof date === 'string' ? new Date(date) : date
  const diffSeconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (diffSeconds < 60) return 'Agora mesmo'
  if (diffSeconds < 3600) return `Há ${Math.floor(diffSeconds / 60)} min`
  if (diffSeconds < 86400) return `Há ${Math.floor(diffSeconds / 3600)} h`
  if (diffSeconds < 604800) return `Há ${Math.floor(diffSeconds / 86400)} dias`
  return formatDate(date)
}
