import { useQuery } from '@tanstack/react-query';
import { shopifyFetch } from './client';
import { PRODUCT_QUERY } from './queries';
import { parsePdpModules } from './metaobjects';
import type { ProductDetail } from '../types/shopify';
import type { StoreConfig, PdpModule } from '../types/domain';

interface ProductQueryData {
  product: ProductDetail | null;
}

export interface ProductDetailViewModel {
  product: ProductDetail;
  modules: PdpModule[];
}

export function useProduct(store: StoreConfig, handle: string) {
  return useQuery({
    queryKey: ['product', store.id, handle],
    queryFn: async (): Promise<ProductDetailViewModel> => {
      const data = await shopifyFetch<ProductQueryData>(store, PRODUCT_QUERY, { handle });

      if (!data.product) {
        throw new Error(`Product "${handle}" was not found on ${store.label}.`);
      }

      // Graceful degradation: pdpModules / its references can be null when
      // the metafield isn't provisioned yet, or the field exists but this
      // product has no modules assigned. Both collapse to an empty array.
      const referenceNodes = data.product.pdpModules?.references?.nodes ?? [];

      return {
        product: data.product,
        modules: parsePdpModules(referenceNodes),
      };
    },
  });
}
