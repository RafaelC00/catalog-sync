/**
 * Label -> emoji lookup for the spec grid, replacing the 13 inline `<svg>`
 * icons `descriptionHtml` ships (discarded per the design spec in favour
 * of emoji). Keyed by the label text itself so it works for every label
 * this parser actually extracts, on either store, not just the spec's
 * suggested set -- an unmapped label (Loomwerk's "Customization" card,
 * which the source copy carries but isn't in the suggested mapping) still
 * gets a restrained, consistent-size fallback rather than no icon at all.
 */
const SPEC_EMOJI: Record<string, string> = {
  weight: '⚖️',
  fabric: '🧵',
  fit: '📐',
  sizes: '📏',
  colorways: '🎨',
  'min. order': '📦',
  'minimum order': '📦',
  'lead time': '⏱️',
  care: '🧼',
  material: '🧶',
  construction: '🪡',
  certifications: '✅',
};

const FALLBACK_EMOJI = '🏷️';

export function specEmoji(label: string): string {
  const key = label.trim().toLowerCase();
  // hasOwn, not a bare lookup: SPEC_EMOJI is an object literal, so a label of
  // "constructor" or "toString" would otherwise resolve against
  // Object.prototype and return a function, which `??` happily passes through
  // as if it were an emoji.
  return Object.prototype.hasOwnProperty.call(SPEC_EMOJI, key)
    ? SPEC_EMOJI[key]
    : FALLBACK_EMOJI;
}
