import type { StoreConfig, StoreId } from '../types/domain';

/**
 * Expo inlines `EXPO_PUBLIC_*` vars from `mobile/.env` at bundle time, so
 * these reads are safe on-device -- nothing is fetched or proxied. We still
 * never log the token values themselves anywhere in this file or below.
 */
const API_VERSION = process.env.EXPO_PUBLIC_STOREFRONT_API_VERSION ?? '2026-01';

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    // Thrown (not logged) so it surfaces in the error boundary/UI state
    // instead of a silent empty catalog.
    throw new Error(`Missing required env var ${name}. Check mobile/.env.`);
  }
  return value;
}

export const STORES: Record<StoreId, StoreConfig> = {
  nomada: {
    id: 'nomada',
    label: 'Nómada',
    domain: requireEnv('EXPO_PUBLIC_NOMADA_DOMAIN', process.env.EXPO_PUBLIC_NOMADA_DOMAIN),
    token: requireEnv('EXPO_PUBLIC_NOMADA_STOREFRONT_TOKEN', process.env.EXPO_PUBLIC_NOMADA_STOREFRONT_TOKEN),
  },
  loomwerk: {
    id: 'loomwerk',
    label: 'Loomwerk',
    domain: requireEnv('EXPO_PUBLIC_LOOMWERK_DOMAIN', process.env.EXPO_PUBLIC_LOOMWERK_DOMAIN),
    token: requireEnv('EXPO_PUBLIC_LOOMWERK_STOREFRONT_TOKEN', process.env.EXPO_PUBLIC_LOOMWERK_STOREFRONT_TOKEN),
  },
};

export function storefrontUrl(store: StoreConfig): string {
  return `https://${store.domain}/api/${API_VERSION}/graphql.json`;
}
