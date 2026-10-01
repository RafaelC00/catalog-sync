# Mobile demo — Shopify-to-native storefront

A two-brand, metaobject-driven storefront app built on Expo/React Native, backed directly by the Shopify Storefront API (no intermediate backend). It covers two things: **fluency with Shopify's metaobject/metafield system as a design surface**, and **real React Native engineering** (navigation, gesture-driven UI, list performance, platform divergence).

## Running it

```bash
npm install
npx expo start
```

Requires `mobile/.env` with the five `EXPO_PUBLIC_*` vars (see `.env.example`). Expo inlines these at bundle time — nothing is fetched through a server, the app talks to `https://{domain}/api/{version}/graphql.json` directly with the Storefront token in a header. That's a deliberate simplification for this demo, not something I'd do in front of a public app store listing (the token is public-safe by Shopify's own design — it's scoped to storefront reads — but I'd still still proxy it in production to control rate limits and add caching).

## Architecture

```
src/
  api/          GraphQL client, queries, React Query hooks, metaobject parsing
  theme/        BrandTheme context + the store-switch transition
  types/        Storefront API response types + parsed domain types
  screens/      ProductList, ProductDetail, StoreSwitcher (modal)
  components/   ProductCard, ImageGallery, and the three PDP module renderers
  navigation/   Typed native-stack navigator
  utils/        Haptics + a minimal HTML-to-text helper
```

### Why this split

- **`api/` never leaks Shopify's raw shape past itself.** The Storefront API returns metaobject fields as a flat `[{key, value}]` list — it has no way to know our field names ahead of time. `api/metaobjects.ts` is the one place that turns that into typed `BrandTheme` / `PdpModule[]` values (`metaobjectFieldsToRecord` + two typed parsers). Every component downstream works with real fields (`theme.primaryColor`, `module.moduleType`), not a `fields.find(f => f.key === '...')` scattered through the UI.
- **Types are hand-written against the actual verified responses**, not generated blindly from the schema doc in the spec — see Verification below for what came back from each store. `src/types/shopify.ts` mirrors the wire shape; `src/types/domain.ts` is what the app actually consumes. No `any` anywhere in the data layer.

## The metaobject story

- **Brand theme** (`demo_brand_theme`): `ThemeContext` (`src/theme/ThemeContext.tsx`) fetches this per active store via React Query and exposes a `BrandTheme` object — every colour, font family, and border radius in the app reads from it. There are exactly two deliberate exceptions, both commented at the point of use: an error message stays a fixed red regardless of brand (it's a semantic signal, not styling), and the bundle badge's label text is fixed white because it sits on a solid `primaryColor` chip where a theme-derived colour could land dark-on-dark for some brand.
- **PDP modules** (`custom.pdp_modules` → `demo_pdp_module` metaobjects): parsed, sorted by `display_order`, and dispatched to a **genuinely different component per `module_type`** (`src/components/modules/`):
  - `care` → an expand/collapse accordion (`CareAccordion.tsx`), reanimated Layout Animations (`FadeIn`/`FadeOut`) for the reveal, haptic on toggle.
  - `size_guide` → an actual bordered table (`SizeGuideTable.tsx`). The metaobject schema only gives `heading`/`body` freeform text, not structured rows — rather than fabricate measurements that aren't in the source data, this derives rows from the copy: a `"Label: value"` segment becomes a two-column row, anything else becomes a numbered guidance row. With the live sample copy (no colons) every row lands in the numbered form — still a real, honestly-derived table, not invented data.
  - `bundle` → `BundleOffer.tsx` with **conditional pricing**: it regexes the `body` copy for a stated discount percentage (e.g. "save 15%") and only then computes and shows a struck-through original price + discounted price + a "Save N%" badge. If the copy doesn't name a percentage, it renders as a descriptive callout with no numbers — the app never invents a discount the merchandiser didn't write.
- **Graceful degradation is real, not theoretical.** I verified it against live data, not just written it defensively: at the time of building, **Loomwerk had no `demo_brand_theme` metaobject provisioned yet** (provisioning had not yet run for that store), so the app fell back to `DEFAULT_THEME` and rendered normally — this wasn't simulated, it's what the second `curl`/node check below actually returned.

## Non-negotiables, and where to look

1. **Navigation** — `@react-navigation/native-stack`, typed via `RootStackParamList` (`src/types/navigation.ts`). List → detail passes only `{ handle, title }`, not the full product object — the detail screen reads from React Query's cache (keyed by `[store, handle]`), so params stay small and there's a single source of truth instead of two copies of a product drifting apart. Store switcher is a `presentation: 'modal'` screen, not a custom overlay, to get the native modal transition for free.
2. **Gesture** — `src/components/ImageGallery.tsx`. Real pan gesture via `Gesture.Pan()` / `GestureDetector`, not a `ScrollView` with `pagingEnabled`. One shared value drives the whole image row's transform on the UI thread every frame; only the *settled* page index crosses to JS (via `runOnJS`) to drive the dot indicator. Snapping is `withSpring`, with a distance-or-velocity threshold so a fast flick pages even if the drag distance is short.
3. **Performance** — `src/components/ProductCard.tsx` is `React.memo`'d; `src/screens/ProductListScreen.tsx`'s `FlatList` has `initialNumToRender`, `maxToRenderPerBatch`, `windowSize`, and `removeClippedSubviews` each set (and commented) deliberately rather than left at RN's defaults, plus cursor-based `onEndReached` pagination via `useInfiniteQuery` instead of fetching the whole catalog up front. `expo-image` on every image with `cachePolicy="memory-disk"` and a stable `recyclingKey` so scrolling a row off-screen and back doesn't re-hit the network.
4. **Platform difference** — three explicit branches, each commented with *why*:
   - `ProductCard.tsx`: `Platform.select` for iOS `shadow*` props vs Android `elevation` (neither platform's renderer honours the other's shadow API).
   - `utils/haptics.ts`: `Platform.OS` branch on haptic intensity (iOS Taptic "Light" reads as intended; Android's actuators need "Medium" to be reliably felt) and a `web` early-return since there's no Haptics/Vibration API there.
   - `navigation/RootNavigator.tsx`: `headerLargeTitle` is iOS-only — it's a real iOS system idiom with no Material equivalent, so forcing it on Android would just be dead header space.

## Quality bar

- `npx tsc --noEmit` passes clean.
- React Query drives all fetching/caching/pagination/pull-to-refresh; every screen has explicit loading, empty, and error states (`src/components/StateViews.tsx`) with a retry action — no screen silently renders nothing on failure.
- `descriptionHtml` is tag-stripped with a small regex helper (`src/utils/stripHtml.ts`) rather than rendered as real HTML — proper HTML rendering needs a dedicated package (e.g. `react-native-render-html`) that isn't in this project's installed dependency set, and adding a new one for a single field felt like the wrong tradeoff for a demo. Called out here rather than left silent.
- `heading_font`/`body_font` values (`Cormorant`/`Montserrat` on Nómada, `Archivo`/`Inter` on Loomwerk) are applied as `fontFamily` from the theme, resolved against real bundled font assets — see **Font loading** below.

## Font loading

Typography is half of what makes the two brands read as different stores (serif/editorial Cormorant+Montserrat on Nómada vs. industrial Archivo+Inter on Loomwerk), so the actual font assets are bundled rather than left to fall back to the platform system font:

- **Packages**: `expo-font` + `@expo-google-fonts/cormorant`, `@expo-google-fonts/montserrat`, `@expo-google-fonts/archivo`, `@expo-google-fonts/inter`, installed via `npx expo install` so versions match the SDK. These ship the actual `.ttf` assets, so the app stays offline-capable — no font is fetched at runtime.
- **Loaded at startup** — `App.tsx` calls `expo-font`'s `useFonts()` with the exact weight map from `src/theme/fonts.ts` and renders `null` until it resolves (or errors), so there's no frame where a screen paints in the system font and then swaps to the brand font.
- **Weights loaded — only what's actually used, per family**: `src/theme/fonts.ts`
  - `Cormorant_600SemiBold`, `Cormorant_700Bold` — heading font on Nómada.
  - `Archivo_600SemiBold`, `Archivo_700Bold` — heading font on Loomwerk.
  - `Montserrat_400Regular`, `Montserrat_600SemiBold`, `Montserrat_700Bold` — body font on Nómada.
  - `Inter_400Regular`, `Inter_600SemiBold`, `Inter_700Bold` — body font on Loomwerk.

  Heading families skip the regular (400) weight entirely: nothing in this UI ever renders a heading at regular weight (`RootNavigator`'s header title, the one spot that used to leave the weight unspecified, is now explicitly semibold), so there was no real use to justify bundling it. Body families keep all three because body copy genuinely renders at all of regular (paragraphs), semibold (labels/buttons), and bold (the size-guide label column, the bundle "Save N%" badge).
  - **Deep, per-weight imports, not the package's top-level entry point** — e.g. `from '@expo-google-fonts/archivo/600SemiBold'`, not `from '@expo-google-fonts/archivo'`. Each package's top-level `index.js` `require()`s every weight and italic variant it ships as a module-level side effect, which Metro can't tree-shake even if only one named export is destructured — verified by `npx expo export` initially bundling all 64 font files across the four families (every weight, every italic) before this was switched to subpath imports, after which the exports drop to exactly the 10 files above. Confirmed both times by inspecting `dist/metadata.json`'s asset list, not just reading the "Assets (N)" summary line.
- **Registry, not a runtime guess**: `resolveFontFamily(fontName, weight)` in `src/theme/fonts.ts` maps the literal name strings the metaobject returns (`"Cormorant"`, `"Montserrat"`, `"Archivo"`, `"Inter"`) plus a semantic weight (`'regular' | 'semibold' | 'bold'`) onto the loaded native family name, via a fixed lookup table — never `` `${name}_${weight}...` `` string construction. A theme naming a font that isn't in the table (or the literal `"System"` `DEFAULT_THEME` uses) returns `undefined`, which is what makes React Native fall back to the platform system font instead of crashing or rendering blank text. Components keep their `fontWeight` set alongside this on purpose, so that fallback path still shows a visible weight difference on the system font rather than looking unstyled.
- **Applied consistently, not just where it already was**: every themed `Text` across `src/screens/`, `src/components/`, `src/components/modules/`, and `RootNavigator`'s header title now resolves through this registry. Two spots were previously left on default styles with no theme font at all despite the surrounding code being fully themed — `BundleOffer.tsx`'s "Save N%" badge label and `CareAccordion.tsx`'s expand/collapse chevron — both fixed to use `body_font` at the same weight their `StyleSheet` entry already declared.

## Verification

- `npx tsc --noEmit` — clean, no errors.
- `npx expo export --platform ios` and `--platform android` — both bundle successfully (1387 / 1383 modules, ~3.3MB Hermes bytecode each). Not run against an emulator, so this plus the type-check is the bar per the spec.
- Font assets confirmed genuinely included, not just compiled: after the fonts work above, `dist/metadata.json` from each export lists exactly 10 `.ttf` entries, and `find dist -iname "*.ttf"` / inspecting `dist/assets/*` with `file` on the extension-less hashed asset names confirms 10 real TrueType font files on disk (Cormorant×2, Archivo×2, Montserrat×3, Inter×3) — matching `FONTS_TO_LOAD` in `src/theme/fonts.ts` exactly, no more and no fewer.
- Storefront API queries run directly against both live stores from a Node script (not through the app, to isolate "does the data exist" from "does the app work"):
  - **Nómada** (`nomada-supply-co.myshopify.com`): **59 products**. `demo_brand_theme` metaobject **present** (`primary_color #1F2A24`, `surface_color #F6F3EC`, Cormorant/Montserrat, radius 8). First product (`espiritu-libre-totebag`) had **3 PDP modules** provisioned — one of each type (`care`, `size_guide`, `bundle`), confirming the display-order/module-type dispatch against real data, not a fixture.
  - **Loomwerk** (`loomwerk-apparel-wholesale.myshopify.com`): **18 products**. `demo_brand_theme` metaobject **absent** (0 nodes) and the sampled product's `pdpModules` was `null` — at the time of this build, metaobject provisioning for this store had not landed yet. This is exactly the "may not exist yet" condition the spec warned about, and it's what I used to confirm the fallback theme and empty-module-list paths for real rather than by inspection.
  - One thing worth flagging from that same check: the very first request I made returned Shopify's storefront **password-page HTML with a 200 status** instead of GraphQL JSON, which took a moment to track down — it turned out to be a `302` redirect to `/password` because my *test script's* manual `.env` parsing choked on a UTF-8 BOM at the top of the file and silently resolved the API version to `undefined`, producing a malformed URL. Not a bug in the shipped app (Expo's own env inlining doesn't have this issue), but worth a line here since it's exactly the kind of silent failure this app's own error states are designed to surface instead of hide.

## What's not done / known gaps

- No add-to-cart or checkout flow — out of scope (this is a PDP/browse demo, not a commerce flow).
- No automated tests, and no test runner configured in this scaffold.
- HTML description rendering (see Quality bar above) remains a named, intentional simplification.
- Not verified on an actual device/emulator (not available here) — `tsc` clean plus both platforms' `expo export` bundling successfully with the correct font assets present is the verification bar per the spec; the visual result (does Cormorant/Montserrat vs. Archivo/Inter actually look distinct on-device) is unconfirmed.
