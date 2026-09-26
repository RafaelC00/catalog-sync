import { useInfiniteQuery } from '@tanstack/react-query';
import { shopifyFetch } from './client';
import { PRODUCTS_QUERY } from './queries';
import type { ProductsConnection } from '../types/shopify';
import type { StoreConfig } from '../types/domain';

const PAGE_SIZE = 20;

interface ProductsQueryData {
  products: ProductsConnection;
}

/**
 * Cursor-paginated product list. FlatList's `onEndReached` drives
 * `fetchNextPage`; pull-to-refresh drives `refetch`. Query key includes the
 * store id so switching stores never shows a flash of the other store's
 * cached page -- React Query treats it as an entirely separate cache entry.
 */
export function useProducts(store: StoreConfig) {
  return useInfiniteQuery({
    queryKey: ['products', store.id],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const data = await shopifyFetch<ProductsQueryData>(store, PRODUCTS_QUERY, {
        first: PAGE_SIZE,
        after: pageParam,
      });
      return data.products;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined),
  });
}
