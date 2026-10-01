import type { AppLinkStatus } from './ApplinkStatus.types';

/**
 * Pure interpretation of what Android reported. Kept out of index.ts, which
 * calls requireNativeModule at import time and so cannot be loaded in a test
 * environment where no native module exists.
 *
 * Separating the two also makes the policy the part under test: the bridge is
 * three passthrough calls, the decisions are here.
 */
export function hostIsVerified(status: AppLinkStatus, host: string): boolean {
  // An unverifiable platform is not a verified one. Returning true because
  // nothing contradicted us would claim working deep links on iOS, where the
  // result is simply not knowable.
  if (!status.supported) return false;
  // The user can switch link handling off for the whole app, which makes
  // per-domain state moot however it was obtained.
  if (!status.linkHandlingAllowed) return false;
  // 'userSelected' means the user added the app by hand; Android never
  // confirmed assetlinks.json, so the host is not verified.
  return status.domains[host] === 'verified';
}

/** Hosts the app claims that Android did not verify. The actionable list. */
export function unverifiedHosts(status: AppLinkStatus): string[] {
  if (!status.supported) return [];
  return Object.entries(status.domains)
    .filter(([, state]) => state !== 'verified')
    .map(([host]) => host);
}
