/**
 * Typed shapes for the Shopify Storefront API responses this app consumes.
 * Keeping these explicit (no `any`) means a schema drift shows up as a
 * TypeScript error at the call site instead of a runtime `undefined.map()`.
 */

export interface Money {
  amount: string;
  currencyCode: string;
}

export interface StorefrontImage {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
}

export interface PriceRange {
  minVariantPrice: Money;
}

/** Shape returned by the `products(first: N)` list query. */
export interface ProductListNode {
  id: string;
  title: string;
  handle: string;
  featuredImage: StorefrontImage | null;
  priceRange: PriceRange;
}

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface ProductsConnection {
  nodes: ProductListNode[];
  pageInfo: PageInfo;
}

/** One selected option on a variant, e.g. `{ name: "Color", value: "Navy" }`. */
export interface SelectedOption {
  name: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  title: string;
  availableForSale: boolean;
  price: Money;
  selectedOptions: SelectedOption[];
}

/** One product option (e.g. `Size`, `Color`, or a store-specific name like
 * `Talla`/`Estilo`) with the full set of values it can take across variants. */
export interface ProductOption {
  name: string;
  values: string[];
}

/**
 * A metaobject's fields always come back from the Storefront API as a flat
 * `[{ key, value }]` list rather than a typed object -- the API has no way
 * to know our schema's field names ahead of time. `metaobjectFieldsToRecord`
 * (src/api/metaobjects.ts) turns this into a lookup we can type-narrow from.
 */
export interface MetaobjectField {
  key: string;
  value: string;
}

export interface MetaobjectNode {
  id: string;
  type: string;
  fields: MetaobjectField[];
}

export interface MetaobjectReferenceConnection {
  references: {
    nodes: MetaobjectNode[];
  } | null;
}

/** Shape returned by the single-product detail query. */
export interface ProductDetail {
  id: string;
  title: string;
  descriptionHtml: string;
  images: { nodes: StorefrontImage[] };
  priceRange: PriceRange;
  options: ProductOption[];
  variants: { nodes: ProductVariant[] };
  /**
   * Nullable by design: the `custom.pdp_modules` metafield, and the
   * metaobject definitions it references, are provisioned separately.
   * Until that lands (or if a given product simply has
   * no modules assigned), this is `null` and the PDP must still render.
   */
  pdpModules: MetaobjectReferenceConnection | null;
}

export interface MetaobjectsConnection {
  nodes: MetaobjectNode[];
}
