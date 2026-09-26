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
  // Merchant persona -- same stack as the shopper routes above (not a
  // separate navigator) specifically so "Preview" can jump straight into
  // the real `ProductDetail` screen instead of maintaining a second copy
  // of it, and so switching persona is a `navigation.reset` to a
  // different home route rather than mounting a whole new tree.
  MerchantOverview: undefined;
  MerchantModules: undefined;
  MerchantModuleEditor: { handle: string };
  MerchantProducts: undefined;
  MerchantProductModules: { handle: string; title: string };
};

export type ProductListScreenProps = NativeStackScreenProps<RootStackParamList, 'ProductList'>;
export type ProductDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;
export type StoreSwitcherScreenProps = NativeStackScreenProps<RootStackParamList, 'StoreSwitcher'>;
export type MerchantOverviewScreenProps = NativeStackScreenProps<RootStackParamList, 'MerchantOverview'>;
export type MerchantModulesScreenProps = NativeStackScreenProps<RootStackParamList, 'MerchantModules'>;
export type MerchantModuleEditorScreenProps = NativeStackScreenProps<RootStackParamList, 'MerchantModuleEditor'>;
export type MerchantProductsScreenProps = NativeStackScreenProps<RootStackParamList, 'MerchantProducts'>;
export type MerchantProductModulesScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'MerchantProductModules'
>;
