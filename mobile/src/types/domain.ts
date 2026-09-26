/**
 * Domain types parsed out of raw Storefront metaobject field lists.
 * These are what the rest of the app (components, screens) actually consumes
 * -- the raw `{key,value}[]` shape from Shopify never leaks past src/api.
 */

export type StoreId = 'nomada' | 'loomwerk';

export interface StoreConfig {
  id: StoreId;
  label: string;
  domain: string;
  token: string;
}

/** Flows through ThemeContext into every themed component. No component
 * should hardcode a colour, font family or radius -- it all comes from here. */
export interface BrandTheme {
  primaryColor: string;
  surfaceColor: string;
  textColor: string;
  headingFont: string;
  bodyFont: string;
  radius: number;
}

export type PdpModuleType = 'care' | 'size_guide' | 'bundle';

export interface PdpModule {
  id: string;
  moduleType: PdpModuleType;
  heading: string;
  body: string;
  displayOrder: number;
  icon: string;
}
