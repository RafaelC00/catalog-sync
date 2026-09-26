import type { StoreConfig } from '../types/domain';
import { storefrontUrl } from './env';

/** Distinguishes "Shopify answered with GraphQL errors" from a network/parse
 * failure, so screens can show a more useful error state than "Error". */
export class ShopifyGraphQLError extends Error {
  constructor(messages: string[]) {
    super(messages.join('; '));
    this.name = 'ShopifyGraphQLError';
  }
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

/**
 * Generic Storefront API POST. `T` is the shape of `data` for the specific
 * query being run -- callers supply it, so every call site is fully typed
 * end to end with no `any` in between.
 */
export async function shopifyFetch<T>(
  store: StoreConfig,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(storefrontUrl(store), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Shopify-Storefront-Access-Token': store.token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Storefront API request failed (${res.status}) for ${store.label}.`);
  }

  const json = (await res.json()) as GraphQLResponse<T>;

  if (json.errors && json.errors.length > 0) {
    throw new ShopifyGraphQLError(json.errors.map((e) => e.message));
  }

  if (!json.data) {
    throw new Error(`Storefront API returned no data for ${store.label}.`);
  }

  return json.data;
}
