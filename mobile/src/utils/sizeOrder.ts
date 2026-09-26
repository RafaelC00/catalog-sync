/**
 * Canonical apparel size order. Shopify's `options[].values` come back in
 * whatever order a merchant typed them in (verified live: Loomwerk's own
 * `Size` option lists `["S","M","L","XL","2XL","3XL","XS"]` -- XS last),
 * so rendering them as-is or alphabetically ("2XL" would sort before "L")
 * both look broken. This is a fixed lookup table, not a parsed one, since
 * size names aren't a pattern -- "M" isn't alphabetically or numerically
 * between "S" and "L" by any rule shorter than just listing them.
 */
const CANONICAL_SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL'];

/**
 * Sorts size values into canonical order. Anything not in the table
 * (a store-specific size name we haven't seen) is left in its original
 * relative order at the end, rather than dropped -- an unknown size is
 * still a real, selectable size.
 */
export function sortSizeValues(values: string[]): string[] {
  return [...values].sort((a, b) => {
    const indexA = CANONICAL_SIZE_ORDER.indexOf(a.toUpperCase());
    const indexB = CANONICAL_SIZE_ORDER.indexOf(b.toUpperCase());
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
}
