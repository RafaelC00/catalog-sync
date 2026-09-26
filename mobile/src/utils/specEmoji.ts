/**
 * Label -> emoji lookup for the spec grid, replacing the 13 inline `<svg>`
 * icons `descriptionHtml` ships (discarded per the design brief in favour
 * of emoji). Keyed by the label text itself so it works for every label
 * this parser actually extracts, on either store, not just the brief's
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
  return SPEC_EMOJI[label.trim().toLowerCase()] ?? FALLBACK_EMOJI;
}
