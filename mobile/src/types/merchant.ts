/**
 * Typed shapes for the merchant backend contract (built in parallel --
 * see mobile/README.md for the endpoint list). Field names are kept in
 * the API's own snake_case rather than remapped to camelCase: unlike
 * `src/types/shopify.ts` (a wire shape nothing else should ever see),
 * this data is rendered close to verbatim as "brand identity as data" on
 * the Overview screen, so there's no real domain transform happening --
 * a remap here would just be busywork with a chance to typo a key.
 */

import type { PdpModuleType } from './domain';

export interface MerchantStoreInfo {
  slug: string;
  name: string;
  domain: string;
}

export interface MerchantThemeInfo {
  primary_color: string;
  surface_color: string;
  text_color: string;
  heading_font: string;
  body_font: string;
  radius: number;
}

export interface MerchantOverview {
  store: MerchantStoreInfo;
  theme: MerchantThemeInfo;
  product_count: number;
  products_with_modules: number;
  module_count: number;
}

export interface MerchantModule {
  handle: string;
  gid: string;
  module_type: PdpModuleType;
  heading: string;
  body: string;
  display_order: number;
  icon: string;
  used_on_product_count: number;
}

/** Body of `PATCH /modules/{handle}` -- every field optional, only what
 * actually changed gets sent. */
export interface MerchantModulePatch {
  heading?: string;
  body?: string;
  display_order?: number;
}

export interface MerchantProductListItem {
  handle: string;
  gid: string;
  title: string;
  featured_image_url: string | null;
  module_handles: string[];
}

export interface MerchantProductModulesUpdate {
  handle: string;
  module_handles: string[];
}

/** UI-facing filter for the Products screen. Mapped to the API's literal
 * `has_modules=true|false|all` query values in `src/api/merchant.ts`. */
export type MerchantProductFilter = 'all' | 'has' | 'missing';
