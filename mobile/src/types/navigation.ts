import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Typed route params. We pass `handle` (not the full product) into the
 * detail screen -- React Query's cache (keyed by [store, handle]) is the
 * source of truth, so navigation params stay small and serializable, and
 * the detail screen re-fetches/re-reads from cache rather than trusting a
 * possibly-stale object handed over the wire from the list screen.
 */
export type RootStackParamList = {
  ProductList: undefined;
  ProductDetail: { handle: string; title: string };
  StoreSwitcher: undefined;
};

export type ProductListScreenProps = NativeStackScreenProps<RootStackParamList, 'ProductList'>;
export type ProductDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;
export type StoreSwitcherScreenProps = NativeStackScreenProps<RootStackParamList, 'StoreSwitcher'>;
