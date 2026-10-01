import { requireNativeModule } from 'expo-modules-core';

import type { AppLinkStatus, DomainVerificationState } from './ApplinkStatus.types';
import { hostIsVerified, unverifiedHosts } from './status';

export type { AppLinkStatus, DomainVerificationState };
export { hostIsVerified, unverifiedHosts };

interface ApplinkStatusNativeModule {
  isSupported(): boolean;
  getDomainStates(): Promise<AppLinkStatus>;
  openLinkSettings(): Promise<void>;
}

const native = requireNativeModule<ApplinkStatusNativeModule>('ApplinkStatus');

/** Whether this platform can report App Link verification at all. */
export function isSupported(): boolean {
  return native.isSupported();
}

/** Reads Android's verification state for every host this app claims. */
export function getDomainStates(): Promise<AppLinkStatus> {
  return native.getDomainStates();
}

/** Opens the system "Open by default" screen, the only route back from `none`. */
export function openLinkSettings(): Promise<void> {
  return native.openLinkSettings();
}

/**
 * Convenience check for a single host.
 *
 * Returns false when unsupported, which is deliberate: an unverifiable
 * platform should not be reported as working. Callers that need to tell
 * "unverified" from "cannot tell" should use getDomainStates directly.
 */
export async function isHostVerified(host: string): Promise<boolean> {
  return hostIsVerified(await getDomainStates(), host);
}
