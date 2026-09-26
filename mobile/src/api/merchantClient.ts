import type { StoreConfig } from '../types/domain';
import { merchantApiBaseUrl, merchantApiToken } from './merchantEnv';

/**
 * Thrown when the request never got a response at all -- backend not
 * running, wrong host/port, DNS failure, timeout. This is the state the
 * brief calls out explicitly ("the backend may not be running"), so it's
 * its own error type rather than folded into a generic message: the UI
 * shows a calm "can't reach the merchant API" screen instead of a raw
 * fetch/network error string.
 */
export class MerchantApiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MerchantApiUnavailableError';
  }
}

/** Thrown on 401/403 -- missing/invalid `X-Merchant-Token`. Its own type
 * so the UI can point at the actual fix (`.env`) instead of a generic
 * retry. */
export class MerchantApiAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MerchantApiAuthError';
  }
}

/** Any other non-2xx response (404, 422, 500, ...). */
export class MerchantApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'MerchantApiError';
    this.status = status;
  }
}

async function merchantRequest<T>(store: StoreConfig, path: string, init?: RequestInit): Promise<T> {
  // Store slug in the URL path matches the same `StoreId` ('nomada' /
  // 'loomwerk') already used as the React Query cache namespace
  // throughout `src/api/` -- assumed to be what the backend expects too,
  // since it's the one store identifier this app has anywhere.
  const url = `${merchantApiBaseUrl()}/api/merchant/${store.id}${path}`;
  const token = merchantApiToken();

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { 'X-Merchant-Token': token } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    // Network-level failure never reaches an HTTP status at all -- this is
    // the "backend may not be running" case.
    throw new MerchantApiUnavailableError(
      `Can't reach the merchant API at ${merchantApiBaseUrl()}. Is the backend running?`
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new MerchantApiAuthError(
      `Merchant API rejected the request (${res.status}). Check EXPO_PUBLIC_MERCHANT_API_TOKEN in mobile/.env.`
    );
  }

  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      // Best-effort only -- fall through with the bare status.
    }
    throw new MerchantApiError(
      `Merchant API request failed (${res.status})${detail ? `: ${detail}` : '.'}`,
      res.status
    );
  }

  return (await res.json()) as T;
}

export function merchantGet<T>(store: StoreConfig, path: string): Promise<T> {
  return merchantRequest<T>(store, path, { method: 'GET' });
}

export function merchantPatch<T>(store: StoreConfig, path: string, body: unknown): Promise<T> {
  return merchantRequest<T>(store, path, { method: 'PATCH', body: JSON.stringify(body) });
}

export function merchantPut<T>(store: StoreConfig, path: string, body: unknown): Promise<T> {
  return merchantRequest<T>(store, path, { method: 'PUT', body: JSON.stringify(body) });
}
