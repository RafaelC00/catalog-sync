import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { merchantGet, merchantPatch, merchantPut } from './merchantClient';
import type { StoreConfig } from '../types/domain';
import type {
  MerchantModule,
  MerchantModulePatch,
  MerchantOverview,
  MerchantProductFilter,
  MerchantProductListItem,
  MerchantProductModulesUpdate,
} from '../types/merchant';

function hasModulesParam(filter: MerchantProductFilter): 'all' | 'true' | 'false' {
  if (filter === 'has') return 'true';
  if (filter === 'missing') return 'false';
  return 'all';
}

export function useMerchantOverview(store: StoreConfig) {
  return useQuery({
    queryKey: ['merchant', store.id, 'overview'],
    queryFn: () => merchantGet<MerchantOverview>(store, '/overview'),
    retry: 1,
    staleTime: 30 * 1000,
  });
}

export function useMerchantModules(store: StoreConfig) {
  return useQuery({
    queryKey: ['merchant', store.id, 'modules'],
    queryFn: () => merchantGet<MerchantModule[]>(store, '/modules'),
    retry: 1,
    staleTime: 30 * 1000,
  });
}

export function useMerchantProducts(store: StoreConfig, filter: MerchantProductFilter) {
  return useQuery({
    queryKey: ['merchant', store.id, 'products', filter],
    queryFn: () => merchantGet<MerchantProductListItem[]>(store, `/products?has_modules=${hasModulesParam(filter)}`),
    retry: 1,
    staleTime: 30 * 1000,
  });
}

/**
 * Invalidates every cache a successful merchant write can affect.
 *
 * `['merchant', store.id]` covers the merchant-side views themselves
 * (overview counts, the modules list's `used_on_product_count`, every
 * `products` filter variant) via React Query's default prefix matching.
 *
 * `['product', store.id]` is the *shopper*-side cache key from
 * `src/api/product.ts` -- it has no `filter`/`handle` suffix here on
 * purpose, so this invalidates every product detail query for this store
 * regardless of which handle. That's the piece that makes "merchant edits
 * copy -> switch to shopper -> pull-to-refresh -> new copy is live" true
 * even if the shopper had already viewed (and cached) that exact PDP
 * before the edit -- without it, a background refetch could still decide
 * the cached data was within `staleTime` and skip re-fetching.
 */
function invalidateAfterMerchantWrite(queryClient: QueryClient, storeId: string): void {
  queryClient.invalidateQueries({ queryKey: ['merchant', storeId] });
  queryClient.invalidateQueries({ queryKey: ['product', storeId] });
}

export function useUpdateMerchantModule(store: StoreConfig) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ handle, patch }: { handle: string; patch: MerchantModulePatch }) =>
      merchantPatch<MerchantModule>(store, `/modules/${handle}`, patch),
    onSuccess: () => invalidateAfterMerchantWrite(queryClient, store.id),
  });
}

export function useUpdateProductModules(store: StoreConfig) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ handle, moduleHandles }: { handle: string; moduleHandles: string[] }) =>
      merchantPut<MerchantProductModulesUpdate>(store, `/products/${handle}/modules`, { handles: moduleHandles }),
    onSuccess: () => invalidateAfterMerchantWrite(queryClient, store.id),
  });
}
