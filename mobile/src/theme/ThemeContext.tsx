import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  /** False until the previously chosen store has been read back from
   * storage. Render gating on this avoids a visible flash of the default
   * brand before the remembered one loads, which on two brands as different
   * as these would look like a bug rather than a load. */
  isStoreHydrated: boolean;
  /** Increments every time the store actually changes. The transition
   * overlay watches this (not the theme colours) to trigger its animation,
   * since colours can also change on a background refetch. */
  transitionToken: number;
}

const StoreThemeContext = createContext<StoreThemeContextValue | null>(null);

const STORE_STORAGE_KEY = 'demo.activeStoreId';

function isKnownStore(value: string | null): value is StoreId {
  return value !== null && Object.prototype.hasOwnProperty.call(STORES, value);
}

export function StoreThemeProvider({ children }: { children: React.ReactNode }) {
  const [storeId, setStoreIdState] = useState<StoreId>('nomada');
  const [transitionToken, setTransitionToken] = useState(0);
  const [isStoreHydrated, setIsStoreHydrated] = useState(false);

  // Read the remembered store once on mount. A stored value that is no longer
  // a configured store (renamed, removed) is ignored rather than trusted, so a
  // stale key cannot put the app into a state with no matching config.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORE_STORAGE_KEY)
      .then((saved) => {
        if (cancelled) return;
        // Set state directly instead of going through setStoreId: restoring a
        // previous choice is not a switch, and firing the brand transition
        // animation on every cold start would be wrong.
        if (isKnownStore(saved)) setStoreIdState(saved);
      })
      .catch(() => {
        // Storage being unavailable is not worth blocking the app for; the
        // default store is a perfectly good fallback.
      })
      .finally(() => {
        if (!cancelled) setIsStoreHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const store = STORES[storeId];
  const themeQuery = useBrandTheme(store);
  const theme = themeQuery.data ?? DEFAULT_THEME;

  const setStoreId = useCallback((id: StoreId) => {
    setStoreIdState((current) => {
      if (current === id) return current;
      setTransitionToken((t) => t + 1);
      // Persist the choice, but never let a storage failure break the switch
      // itself: the user asked for a different brand and should get it whether
      // or not it can be remembered for next time.
      AsyncStorage.setItem(STORE_STORAGE_KEY, id).catch(() => {});
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
      isStoreHydrated,
      transitionToken,
    }),
    [storeId, store, theme, themeQuery.isLoading, setStoreId, isStoreHydrated, transitionToken]
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
