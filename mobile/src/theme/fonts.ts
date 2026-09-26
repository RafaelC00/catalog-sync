// Deep, per-weight imports are deliberate, not stylistic -- each
// `@expo-google-fonts/*` package's top-level entry point (`from
// '@expo-google-fonts/archivo'`) `require()`s *every* weight and italic
// variant it ships (18 files for Archivo/Inter, 10 for Cormorant, 18 for
// Montserrat) as module-level side effects, and Metro can't tree-shake
// those out even if only one named export is destructured -- confirmed by
// `expo export` initially bundling all 64 font files until this was
// switched to subpath imports. Importing `<package>/<weight>` instead
// pulls in a tiny per-weight module that requires only that one `.ttf`, so
// only the fonts actually loaded below end up in the bundle.
import { Archivo_600SemiBold } from '@expo-google-fonts/archivo/600SemiBold';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { Cormorant_600SemiBold } from '@expo-google-fonts/cormorant/600SemiBold';
import { Cormorant_700Bold } from '@expo-google-fonts/cormorant/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Montserrat_400Regular } from '@expo-google-fonts/montserrat/400Regular';
import { Montserrat_600SemiBold } from '@expo-google-fonts/montserrat/600SemiBold';
import { Montserrat_700Bold } from '@expo-google-fonts/montserrat/700Bold';

/**
 * Every font asset the app bundles, keyed by the exact family name
 * expo-font registers each one under at load time. Passed straight into
 * `useFonts()` in App.tsx.
 *
 * Only the weights actually used somewhere in `src/` are loaded (see the
 * per-weight comments below and `FONT_REGISTRY`) -- this is a deliberate
 * bundle-size call per the brief, not an oversight:
 *  - Cormorant/Archivo are only ever assigned to `heading_font`, and no
 *    heading in this UI renders at regular weight, so they skip
 *    `..._400Regular` entirely (two fewer font files).
 *  - Montserrat/Inter are only ever assigned to `body_font`, which
 *    genuinely renders at all three weights used here (regular paragraph
 *    copy, semibold labels/buttons, bold emphasis), so all three are kept.
 */
export const FONTS_TO_LOAD = {
  Cormorant_600SemiBold,
  Cormorant_700Bold,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Montserrat_400Regular,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} as const;

export type FontWeight = 'regular' | 'semibold' | 'bold';

interface FontFamilySet {
  regular?: string;
  semibold: string;
  bold: string;
}

/**
 * Explicit registry mapping the font *name* strings that come back from a
 * store's `demo_brand_theme` metaobject (`heading_font` / `body_font`,
 * e.g. `"Cormorant"`) onto the actual loaded native font family names from
 * `FONTS_TO_LOAD`. Deliberately a fixed table, not a runtime guess (e.g.
 * `` `${name}_${weight}...` ``) -- a metaobject naming a font we never
 * bundled simply isn't a key here, and `resolveFontFamily` treats that as
 * "fall back to the system font" rather than constructing a family name
 * that doesn't exist.
 */
const FONT_REGISTRY: Record<string, FontFamilySet> = {
  Cormorant: { semibold: 'Cormorant_600SemiBold', bold: 'Cormorant_700Bold' },
  Archivo: { semibold: 'Archivo_600SemiBold', bold: 'Archivo_700Bold' },
  Montserrat: {
    regular: 'Montserrat_400Regular',
    semibold: 'Montserrat_600SemiBold',
    bold: 'Montserrat_700Bold',
  },
  Inter: {
    regular: 'Inter_400Regular',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
};

/**
 * Resolves a theme font-name string (from `BrandTheme.headingFont` /
 * `BrandTheme.bodyFont`) plus the weight a given piece of UI needs into
 * the loaded native font family to put in `fontFamily`.
 *
 * Returns `undefined` -- never throws, never returns a made-up string --
 * when the family isn't in the registry (an unbundled font, or the literal
 * `"System"` used by `DEFAULT_THEME`) or when that family doesn't have the
 * requested weight loaded. `fontFamily: undefined` makes React Native fall
 * back to the platform system font, so callers should keep their
 * `fontWeight` set alongside this -- that's what keeps the no-theme
 * fallback looking like a normal system-font UI instead of unstyled text.
 */
export function resolveFontFamily(fontName: string, weight: FontWeight): string | undefined {
  const family = FONT_REGISTRY[fontName];
  if (!family) return undefined;
  return family[weight];
}
