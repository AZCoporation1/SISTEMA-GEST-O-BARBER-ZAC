import { describe, it, expect } from 'vitest';
import { 
  calculateSalePrice, 
  calculateMarkupValue, 
  calculatePurchaseSuggestion, 
  calculateStockBalance,
  calculateCommission
} from '../lib/utils/formulas';

describe('Barber Zac - Financial & Stock Formulas', () => {
  it('calculates sale price correctly when cost and markup are provided', () => {
    expect(calculateSalePrice(10, 50)).toBe(15);
    expect(calculateSalePrice(100, 45)).toBe(145);
    expect(calculateSalePrice(22.50, 100)).toBe(45);
    expect(calculateSalePrice(0, 50)).toBe(0);
    expect(calculateSalePrice(-10, 50)).toBe(0);
  });

  it('calculates markup absolute value', () => {
    expect(calculateMarkupValue(100, 45)).toBe(45);
    expect(calculateMarkupValue(50, 10)).toBe(5);
  });

  it('calculates purchase suggestion precisely based on max stock gap', () => {
    expect(calculatePurchaseSuggestion(20, 5)).toBe(15);
    expect(calculatePurchaseSuggestion(10, 12)).toBe(0); // overstocked
    expect(calculatePurchaseSuggestion(10, 10)).toBe(0); // at max
    expect(calculatePurchaseSuggestion(0, 5)).toBe(0); // max 0 means no reorder
  });

  it('calculates raw stock balance', () => {
    expect(calculateStockBalance(10, 5, 2)).toBe(13);
    expect(calculateStockBalance(0, 100, 100)).toBe(0);
  });

  it('calculates commissions gracefully', () => {
    expect(calculateCommission(100, 10, 0)).toBe(10); // 10%
    expect(calculateCommission(100, 0, 15)).toBe(15); // $15 fixed
    expect(calculateCommission(50, 50, 10)).toBe(35); // 50% + 10 = 25+10
  });
});
