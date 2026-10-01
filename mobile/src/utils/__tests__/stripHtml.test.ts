import { stripHtml } from '../stripHtml';

describe('stripHtml', () => {
  it('removes tags and keeps the text', () => {
    expect(stripHtml('<b>Bold</b> text')).toBe('Bold text');
  });

  it('turns closing block tags and br into line breaks', () => {
    expect(stripHtml('<p>One</p><p>Two</p>')).toBe('One\nTwo');
    expect(stripHtml('a<br>b<br/>c')).toBe('a\nb\nc');
  });

  it('collapses runs of three or more newlines to a single blank line', () => {
    expect(stripHtml('<p>a</p><p></p><p></p><p>b</p>')).toBe('a\n\nb');
  });

  it('decodes ampersand and non-breaking space entities', () => {
    expect(stripHtml('A&amp;B&nbsp;C')).toBe('A&B C');
  });

  it('returns an empty string for empty input', () => {
    expect(stripHtml('')).toBe('');
  });
});
