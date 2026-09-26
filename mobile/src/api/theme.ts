import { useQuery } from '@tanstack/react-query';
import { shopifyFetch } from './client';
import { THEME_QUERY } from './queries';
import { parseBrandTheme } from './metaobjects';
import type { MetaobjectsConnection } from '../types/shopify';
import type { StoreConfig, BrandTheme } from '../types/domain';
import { DEFAULT_THEME } from '../theme/defaultTheme';

interface ThemeQueryData {
  metaobjects: MetaobjectsConnection;
}

/**
 * Fetches the store's `demo_brand_theme` metaobject. Never throws to the
 * caller on a missing/errored theme -- a brand skin failing to load should
 * never block the product catalog from rendering, so we swallow the error
 * here and fall back to DEFAULT_THEME (see `select`/`placeholderData` below
 * would not cover the error path, hence the explicit catch).
 */
export function useBrandTheme(store: StoreConfig) {
  return useQuery({
    queryKey: ['theme', store.id],
    queryFn: async (): Promise<BrandTheme> => {
      try {
        const data = await shopifyFetch<ThemeQueryData>(store, THEME_QUERY);
        return parseBrandTheme(data.metaobjects.nodes);
      } catch {
        return DEFAULT_THEME;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}
