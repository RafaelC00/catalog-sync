/** Per-host verification state as Android reports it. */
export type DomainVerificationState =
  /** Android fetched assetlinks.json and it matched. Links open the app. */
  | 'verified'
  /** Not verified, but the user added this app manually in system settings. */
  | 'userSelected'
  /** Neither verified nor user-selected. Links open the browser. */
  | 'none'
  /** Android returned a state this module does not recognise. */
  | 'unknown';

export interface AppLinkStatus {
  /**
   * False on iOS, on web, and on Android below API 31, where the verification
   * result is not readable. Treat the `domains` map as meaningless when false
   * rather than as "nothing is verified".
   */
  supported: boolean;
  /**
   * False when the user has switched link handling off for the whole app, in
   * which case per-domain state does not matter.
   */
  linkHandlingAllowed: boolean;
  /** Host to state, e.g. `{ "shop.example.com": "verified" }`. */
  domains: Record<string, DomainVerificationState>;
}
