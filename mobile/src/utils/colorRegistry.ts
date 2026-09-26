/**
 * Name -> hex lookup for the swatch colours that are actually verified live
 * on the two stores (the hexes embedded in Loomwerk's `descriptionHtml`
 * swatch markup -- see mobile/README.md). Deliberately a fixed table, not
 * a runtime guess: a value this app has never seen (Nómada's "Negro" /
 * "Marfil" -- Spanish names, a different registry we don't have hexes
 * for) simply isn't a key here, and callers fall back to a neutral
 * text chip instead of rendering a wrong colour.
 */
const COLOR_HEX_REGISTRY: Record<string, string> = {
  // Verified from Loomwerk's own swatch markup.
  black: '#1a1a1a',
  white: '#ffffff',
  'heather grey': '#9a9a9a',
  'heather gray': '#9a9a9a',
  navy: '#14213d',
  'army green': '#4b5320',
  maroon: '#800000',

  // Nómada names its colours in Spanish. These are unambiguous colour words,
  // not guesses at a brand's bespoke shade, and without them a Spanish-language
  // store falls back to text chips while an English one gets real swatches --
  // which would make the demo look worse on the very store it opens with.
  negro: '#1a1a1a',
  blanco: '#ffffff',
  marfil: '#f3ece0',
  crema: '#f3ece0',
  gris: '#9a9a9a',
  'azul marino': '#14213d',
  'verde militar': '#4b5320',
  vino: '#800000',
  granate: '#800000',
  arena: '#d9c9a8',
  camel: '#c19a6b',
};

/** Case/whitespace-insensitive lookup. Returns `undefined` for anything
 * not in the registry -- callers must treat that as "unknown", never
 * substitute a guessed colour. */
export function resolveSwatchHex(name: string): string | undefined {
  return COLOR_HEX_REGISTRY[name.trim().toLowerCase()];
}

/** Relative luminance (ITU-R BT.601 luma) of a `#rrggbb` string, 0..1. */
export function swatchLuma(hex: string): number {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return 0;
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Whether a swatch needs a visible outline to be seen at all.
 *
 * The first version of this asked only "is the swatch light?", which quietly
 * assumed a light background. On Loomwerk's near-black surface the opposite
 * happens: a black garment swatch disappears completely into the page.
 *
 * So the question is not a property of the swatch, it is the *contrast between
 * the swatch and whatever surface the active brand theme puts behind it*. Any
 * swatch close in luminance to its background gets an outline, light or dark.
 */
export function needsSwatchBorder(hex: string, surfaceHex: string): boolean {
  return Math.abs(swatchLuma(hex) - swatchLuma(surfaceHex)) < 0.18;
}

/**
 * The outline colour to use: darken against a light swatch, lighten against a
 * dark one, so the ring reads in both directions.
 */
export function swatchBorderColor(hex: string): string {
  return swatchLuma(hex) > 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.28)';
}
