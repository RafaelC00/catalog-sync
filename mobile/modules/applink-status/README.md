# applink-status

Reports whether Android actually verified this app's App Links.

## Why this exists

`plugins/withDeepLinks.ts` registers an intent filter with `autoVerify="true"`,
which asks Android to fetch `/.well-known/assetlinks.json` from each claimed
host at install time.

That check can fail silently. A missing file, a wrong SHA-256 fingerprint, a
redirect, or a CDN serving the wrong content type all leave the app installed
and working, while every deep link quietly opens the browser instead. For a
commerce app that is lost sessions and broken attribution, with no error
anywhere to notice.

Nothing in JavaScript can observe this, because the decision lives in the
package manager rather than in the app. `DomainVerificationManager` (API 31+)
is the only way to read it, which is why this is a native module rather than
another config plugin.

## API

```ts
import { getDomainStates, isHostVerified, openLinkSettings } from '../../modules/applink-status/src';

const status = await getDomainStates();
// { supported: true, linkHandlingAllowed: true,
//   domains: { 'shop.example.com': 'verified' } }

if (!(await isHostVerified('shop.example.com'))) {
  await openLinkSettings(); // system "Open by default" screen
}
```

`supported` is false on iOS, on web, and on Android below API 31. Treat the
`domains` map as meaningless in that case rather than as "nothing is verified".

## Platform behaviour

| | |
|---|---|
| Android 12+ (API 31) | Real per-host state from `DomainVerificationManager` |
| Android < 31 | `supported: false`. The older verification mechanism is not readable. |
| iOS | `supported: false`. Universal Links are verified by Apple's CDN and the result is not exposed by any public API. Reporting `verified` because nothing contradicted it would be worse than reporting nothing. |

## Structure

`src/status.ts` holds the interpretation of what Android reported and is pure,
so it is unit tested directly. `src/index.ts` is the thin bridge that calls
`requireNativeModule`. Splitting them keeps the policy under test, since a
module that calls `requireNativeModule` at import time cannot load in a test
environment with no native module present.

## Building

Native code needs a development build; it cannot run in Expo Go.

```bash
npx eas build --platform android --profile development
```

Install the resulting APK, then `npx expo start --dev-client`.
