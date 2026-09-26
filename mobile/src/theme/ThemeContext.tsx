import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { STORES } from '../api/env';
import { useBrandTheme } from '../api/theme';
import { DEFAULT_THEME } from './defaultTheme';
import type { BrandTheme, StoreConfig, StoreId } from '../types/domain';

interface StoreThemeContextValue {
  storeId: StoreId;
  store: StoreConfig;
  theme: BrandTheme;
  isThemeLoading: boolean;
  /** True when the active store has no `demo_brand_theme` metaobject yet
   * (or it errored) and we're showing DEFAULT_THEME instead. Surfaced so
   * the UI can be honest about it rather than pretending it's branded. */
  isDefaultTheme: boolean;
  availableStores: StoreConfig[];
  setStoreId: (id: StoreId) => void;
  /** Increments every time the store actually changes. The transition
   * overlay watches this (not the theme colours) to trigger its animation,
   * since colours can also change on a background refetch. */
  transitionToken: number;
}

const StoreThemeContext = createContext<StoreThemeContextValue | null>(null);

export function StoreThemeProvider({ children }: { children: React.ReactNode }) {
  const [storeId, setStoreIdState] = useState<StoreId>('nomada');
  const [transitionToken, setTransitionToken] = useState(0);

  const store = STORES[storeId];
  const themeQuery = useBrandTheme(store);
  const theme = themeQuery.data ?? DEFAULT_THEME;

  const setStoreId = useCallback((id: StoreId) => {
    setStoreIdState((current) => {
      if (current === id) return current;
      setTransitionToken((t) => t + 1);
      return id;
    });
  }, []);

  const value = useMemo<StoreThemeContextValue>(
    () => ({
      storeId,
      store,
      theme,
      isThemeLoading: themeQuery.isLoading,
      isDefaultTheme: theme === DEFAULT_THEME,
      availableStores: Object.values(STORES),
      setStoreId,
      transitionToken,
    }),
    [storeId, store, theme, themeQuery.isLoading, setStoreId, transitionToken]
  );

  return <StoreThemeContext.Provider value={value}>{children}</StoreThemeContext.Provider>;
}

export function useStoreTheme(): StoreThemeContextValue {
  const ctx = useContext(StoreThemeContext);
  if (!ctx) {
    throw new Error('useStoreTheme must be used within a StoreThemeProvider');
  }
  return ctx;
}
