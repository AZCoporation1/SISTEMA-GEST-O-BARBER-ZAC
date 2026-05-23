/**
 * Barber Zac ERP — Subscription Discount Utilities
 *
 * Pure functions for subscriber discount logic.
 * These are NOT server actions — they can be used in both client and server code.
 */

/**
 * Check if a service is eligible for subscriber discount.
 * NOT eligible: plans, R$0 services.
 */
export function isServiceEligibleForDiscount(service: {
  price: number
  name: string
}): boolean {
  if (service.price <= 0) return false
  // Plans themselves don't get extra discount
  if (/^plano\s/i.test(service.name)) return false
  return true
}

/**
 * Calculate discounted price. Backend source of truth.
 */
export function applySubscriberDiscount(
  originalPrice: number,
  discountPercent: number
): { finalPrice: number; discountAmount: number } {
  const discountAmount = Math.round(originalPrice * (discountPercent / 100) * 100) / 100
  const finalPrice = Math.round((originalPrice - discountAmount) * 100) / 100
  return { finalPrice, discountAmount }
}
