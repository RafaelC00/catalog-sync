/**
 * `descriptionHtml` comes back as real HTML. Rendering HTML properly needs
 * a dedicated renderer (e.g. react-native-render-html), which isn't in this
 * project's installed dependency set -- rather than add a new package for
 * one field, this does a minimal, honest tag-strip so the copy still reads
 * correctly as plain text. Documented as a known simplification in the
 * README, not hidden.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<\/(p|li|div|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
