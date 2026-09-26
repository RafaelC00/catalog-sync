import type { BrandTheme } from '../types/domain';

/**
 * Used whenever a store's `demo_brand_theme` metaobject doesn't exist yet
 * (not provisioned) or a field on it is blank. Deliberately neutral --
 * this is a fallback, not a third brand, so it shouldn't look "designed".
 */
export const DEFAULT_THEME: BrandTheme = {
  primaryColor: '#111827',
  surfaceColor: '#FFFFFF',
  textColor: '#111827',
  headingFont: 'System',
  bodyFont: 'System',
  radius: 12,
};
