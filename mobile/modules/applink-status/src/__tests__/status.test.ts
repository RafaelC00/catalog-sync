import { hostIsVerified, unverifiedHosts } from '../status';
import type { AppLinkStatus } from '../ApplinkStatus.types';

const HOST = 'shop.example.com';
const base = (over: Partial<AppLinkStatus> = {}): AppLinkStatus => ({
  supported: true,
  linkHandlingAllowed: true,
  domains: {},
  ...over,
});

describe('hostIsVerified', () => {
  it('is true only when Android verified the host', () => {
    expect(hostIsVerified(base({ domains: { [HOST]: 'verified' } }), HOST)).toBe(true);
  });

  it('is false when the user added the app by hand instead of Android verifying it', () => {
    expect(hostIsVerified(base({ domains: { [HOST]: 'userSelected' } }), HOST)).toBe(false);
  });

  it('is false on a platform that cannot report verification', () => {
    // iOS, web, and Android below API 31. Claiming true here would report
    // working deep links on a platform that never confirmed them.
    expect(hostIsVerified(base({ supported: false, domains: { [HOST]: 'verified' } }), HOST)).toBe(false);
  });

  it('is false when link handling is off for the whole app', () => {
    expect(hostIsVerified(base({ linkHandlingAllowed: false, domains: { [HOST]: 'verified' } }), HOST)).toBe(false);
  });

  it('is false for a host the app does not claim', () => {
    expect(hostIsVerified(base({ domains: { 'other.example.com': 'verified' } }), HOST)).toBe(false);
  });

  it('is false for state none', () => {
    expect(hostIsVerified(base({ domains: { [HOST]: 'none' } }), HOST)).toBe(false);
  });
});

describe('unverifiedHosts', () => {
  it('lists every claimed host Android did not verify', () => {
    const status = base({
      domains: { 'a.example.com': 'verified', 'b.example.com': 'none', 'c.example.com': 'userSelected' },
    });
    expect(unverifiedHosts(status).sort()).toEqual(['b.example.com', 'c.example.com']);
  });

  it('is empty when nothing can be reported, rather than listing every host as broken', () => {
    expect(unverifiedHosts(base({ supported: false, domains: { 'a.example.com': 'none' } }))).toEqual([]);
  });
});
