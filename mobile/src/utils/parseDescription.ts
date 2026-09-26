import { stripHtml } from './stripHtml';

/**
 * `descriptionHtml` on these two stores follows one known, styled shape
 * (verified live against both Nómada and Loomwerk -- see mobile/README.md):
 *
 *   - 1-3 real prose `<p>` paragraphs
 *   - an ungrouped flex grid of "spec cards", each an uppercase label
 *     (icon + `<span>`) immediately followed by a bold value `<div>`
 *   - zero or more `<h3>`-titled sections, some of which repeat the same
 *     label/value card shape (Specifications, Wholesale terms) and some of
 *     which don't (a swatch-circle "Colorways" list, a plain-chip "Available
 *     sizes" list -- both redundant with the structured `options` data this
 *     screen already renders as real swatches/chips, so they're simply not
 *     extracted here)
 *   - 13 inline `<svg>` icons, discarded in favour of emoji in the UI
 *
 * This parser targets that *shape*, not specific label text -- a section
 * is only kept if it actually contains label/value pairs, so an unfamiliar
 * `<h3>` block (or a product with no spec grid at all, like Nómada's tote
 * bags) simply produces an empty list rather than a wrong one. If nothing
 * recognizable is found at all, it degrades to the same flat-paragraph
 * fallback `stripHtml` produces, so the screen never renders nothing.
 */

export interface DescriptionSpecPair {
  label: string;
  value: string;
}

export interface DescriptionSection {
  title: string;
  pairs: DescriptionSpecPair[];
}

export interface ParsedDescription {
  /** Real prose, in source order. */
  paragraphs: string[];
  /** The ungrouped spec grid that appears before any `<h3>` (Weight,
   * Fabric, Fit, Sizes, Colorways, Min. order on Loomwerk's shape). */
  specPairs: DescriptionSpecPair[];
  /** `<h3>`-titled sections whose body is itself label/value pairs
   * (Specifications, Wholesale terms). */
  sections: DescriptionSection[];
}

const EMPTY_RESULT: ParsedDescription = { paragraphs: [], specPairs: [], sections: [] };

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)));
}

/** Tags stripped to spaces (not removed outright) so two adjacent inline
 * elements like `12 oz/yd²<span>· 407 GSM</span>` don't get glued together
 * into one word once the tags are gone. */
function innerText(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function stripSvgs(html: string): string {
  return html.replace(/<svg[\s\S]*?<\/svg>/gi, '');
}

function extractParagraphs(html: string): string[] {
  const paragraphs: string[] = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const text = innerText(match[1]);
    if (text) paragraphs.push(text);
  }
  return paragraphs;
}

/**
 * Finds `<div style="…text-transform:uppercase…">LABEL</div><div>VALUE</div>`
 * pairs. This one shape covers all three places the markup uses it (the
 * top spec grid, Specifications' grid rows, Wholesale terms' cards) --
 * label div content is icon+`<span>` or plain text, value div content is
 * plain text optionally with an inline `<span>` sub-value. Neither div
 * nests a further `<div>`, so the non-greedy `[\s\S]*?` bodies each stop at
 * their own closing tag rather than swallowing the next pair.
 */
function extractLabelValuePairs(html: string): DescriptionSpecPair[] {
  const pairs: DescriptionSpecPair[] = [];
  const re = /<div[^>]*text-transform:\s*uppercase[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const label = innerText(match[1]);
    const value = innerText(match[2]);
    if (label && value) pairs.push({ label, value });
  }
  return pairs;
}

/** Splits the document on `<h3>` boundaries and keeps only the sections
 * that actually resolve to label/value pairs -- see the module doc for why
 * that's the right filter instead of matching on title text. */
function extractSections(html: string): { sections: DescriptionSection[]; firstH3Index: number } {
  const sections: DescriptionSection[] = [];
  const h3Re = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const marks: { title: string; start: number; bodyStart: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = h3Re.exec(html))) {
    marks.push({ title: innerText(match[1]), start: match.index, bodyStart: match.index + match[0].length });
  }

  for (let i = 0; i < marks.length; i++) {
    const bodyEnd = i + 1 < marks.length ? marks[i + 1].start : html.length;
    const body = html.slice(marks[i].bodyStart, bodyEnd);
    const pairs = extractLabelValuePairs(body);
    if (pairs.length > 0) {
      sections.push({ title: marks[i].title, pairs });
    }
  }

  return { sections, firstH3Index: marks.length > 0 ? marks[0].start : -1 };
}

/** Plain-paragraph fallback for anything that isn't this known shape --
 * reuses `stripHtml` rather than a second ad hoc stripper. */
function fallbackToPlainParagraphs(html: string): ParsedDescription {
  const text = stripHtml(html);
  const paragraphs = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return { paragraphs, specPairs: [], sections: [] };
}

export function parseDescription(html: string | null | undefined): ParsedDescription {
  if (!html || !html.trim()) {
    return EMPTY_RESULT;
  }

  try {
    const cleaned = stripSvgs(html);
    const paragraphs = extractParagraphs(cleaned);
    const { sections, firstH3Index } = extractSections(cleaned);
    const introHtml = firstH3Index === -1 ? cleaned : cleaned.slice(0, firstH3Index);
    const specPairs = extractLabelValuePairs(introHtml);

    if (paragraphs.length === 0 && specPairs.length === 0 && sections.length === 0) {
      // Nothing in the known shape matched at all -- an unfamiliar markup
      // shape, not an empty description. Degrade rather than show nothing.
      return fallbackToPlainParagraphs(html);
    }

    return { paragraphs, specPairs, sections };
  } catch {
    return fallbackToPlainParagraphs(html);
  }
}
