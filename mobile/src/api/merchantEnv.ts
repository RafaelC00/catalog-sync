/**
 * Merchant backend connection settings. Deliberately *not* run through
 * `requireEnv` (see `src/api/env.ts`) -- the brief calls out that this
 * backend "may not be running or may 401 while you work" as a first-class
 * state, so a missing token has to fail as a normal, catchable HTTP 401
 * from `merchantClient.ts` (surfaced in the UI) rather than a thrown error
 * at import time that would take the whole app down before it even
 * mounts. The shopper persona must keep working with no merchant env set
 * at all.
 */

export function merchantApiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_MERCHANT_API_URL ?? 'http://localhost:8000';
}

/** `undefined` when unset -- callers omit the header entirely rather than
 * sending the literal string `"undefined"`. */
export function merchantApiToken(): string | undefined {
  return process.env.EXPO_PUBLIC_MERCHANT_API_TOKEN || undefined;
}
