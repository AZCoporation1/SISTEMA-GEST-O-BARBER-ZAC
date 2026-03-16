/**
 * Core Barber Zac Financial & Inventory Formulas
 */

export function calculateSalePrice(cost: number, markupPercent: number): number {
  if (cost < 0 || markupPercent < 0) return 0;
  return Number((cost + (cost * (markupPercent / 100))).toFixed(2));
}

export function calculateMarkupValue(cost: number, markupPercent: number): number {
  if (cost < 0 || markupPercent < 0) return 0;
  return Number((cost * (markupPercent / 100)).toFixed(2));
}

export function calculatePurchaseSuggestion(maxStock: number, currentBalance: number): number {
  if (maxStock <= 0) return 0;
  const needed = maxStock - currentBalance;
  return needed > 0 ? needed : 0;
}

export function calculateStockBalance(initial: number, entries: number, exits: number): number {
  return initial + entries - exits;
}

export function calculateCommission(baseAmount: number, rulePercent?: number, ruleFixed?: number): number {
  let total = 0;
  if(rulePercent && rulePercent > 0) {
      total += baseAmount * (rulePercent / 100);
  }
  if(ruleFixed && ruleFixed > 0) {
      total += ruleFixed;
  }
  return Number(total.toFixed(2));
}
