import type { Money } from '../types/shopify';

/**
 * Shopify returns MoneyV2 amounts as decimal *strings*, and it does not pad
 * them: a 32 dollar product comes back as "32.0", not "32.00". Rendering that
 * string straight to the screen prints "USD 32.0", which reads as a bug to
 * anyone looking at a storefront.
 *
 * Every price in the app goes through here so the formatting is decided in one
 * place rather than per component.
 */
export function formatPrice(price: Money): string {
  const amount = Number.parseFloat(price.amount);

  // Fall back to the raw string rather than printing "NaN" if Shopify ever
  // sends something unparseable.
  if (Number.isNaN(amount)) {
    return `${price.currencyCode} ${price.amount}`;
  }

  return `${price.currencyCode} ${amount.toFixed(2)}`;
}

/** The same formatting for an amount already parsed to a number. */
export function formatAmount(amount: number, currencyCode: string): string {
  return `${currencyCode} ${amount.toFixed(2)}`;
}
