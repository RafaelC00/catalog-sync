import type { ProductOption, ProductVariant } from '../types/shopify';
import { sortSizeValues } from './sizeOrder';

/**
 * Detects the colour/size options out of a product's `options` list by
 * *name*, not position -- verified live, the two stores don't agree on
 * naming (Loomwerk: "Size"/"Color"; Nómada's "Sin Drama" tee: "Talla"/
 * "Color"/"Estilo", the last a single-value style option this UI has no
 * use for). Colour swatches and size chips only render when the matching
 * option actually exists; a product with neither (Nómada's tote bags,
 * one-value "Color" aside) just skips both sections.
 */
export function findColorOption(options: ProductOption[]): ProductOption | undefined {
  return options.find((option) => /colou?r/i.test(option.name));
}

export function findSizeOption(options: ProductOption[]): ProductOption | undefined {
  return options.find((option) => /size|talla/i.test(option.name));
}

/** Size values in canonical (not alphabetical, not source) order. */
export function orderedSizeValues(sizeOption: ProductOption): string[] {
  return sortSizeValues(sizeOption.values);
}

/**
 * True when at least one variant matching every given `{name, value}`
 * constraint is `availableForSale`. Matching is a subset check against
 * `selectedOptions`, not an exact-length one, so a third option a product
 * happens to carry (Nómada's single-value "Estilo") never blocks a
 * colour/size availability lookup that doesn't care about it.
 */
export function isCombinationAvailable(
  variants: ProductVariant[],
  constraints: { name: string; value: string }[]
): boolean {
  return variants.some(
    (variant) =>
      variant.availableForSale &&
      constraints.every((constraint) =>
        variant.selectedOptions.some((selected) => selected.name === constraint.name && selected.value === constraint.value)
      )
  );
}

/** The single variant matching the given colour/size selection, if any --
 * used to show accurate stock status for exactly what's selected rather
 * than "is anything on this product in stock". */
export function findMatchingVariant(
  variants: ProductVariant[],
  constraints: { name: string; value: string }[]
): ProductVariant | undefined {
  if (constraints.length === 0) return undefined;
  return variants.find((variant) =>
    constraints.every((constraint) =>
      variant.selectedOptions.some((selected) => selected.name === constraint.name && selected.value === constraint.value)
    )
  );
}

/** First value of `option` that has at least one in-stock variant,
 * falling back to the option's first value if none are in stock at all
 * (a genuinely sold-out product should default-select *something*, not
 * silently pick nothing). */
export function defaultOptionValue(option: ProductOption, variants: ProductVariant[]): string {
  const inStock = option.values.find((value) => isCombinationAvailable(variants, [{ name: option.name, value }]));
  return inStock ?? option.values[0];
}
