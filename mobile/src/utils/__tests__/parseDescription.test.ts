import { parseDescription } from '../parseDescription';

const card = (label: string, value: string) =>
  `<div style="font-size:11px;text-transform:uppercase;letter-spacing:1px"><svg><path d="M0"/></svg><span>${label}</span></div>` +
  `<div style="font-weight:700">${value}</div>`;

describe('parseDescription', () => {
  describe('empty input', () => {
    it.each([[''], ['   \n '], [null], [undefined]])('returns an empty result for %p', (input) => {
      expect(parseDescription(input)).toEqual({ paragraphs: [], specPairs: [], sections: [] });
    });
  });

  describe('paragraphs', () => {
    it('extracts prose paragraphs in source order', () => {
      const result = parseDescription('<p>First.</p><p>Second.</p>');
      expect(result.paragraphs).toEqual(['First.', 'Second.']);
    });

    it('skips empty paragraphs', () => {
      expect(parseDescription('<p>  </p><p>Real</p>').paragraphs).toEqual(['Real']);
    });

    it('decodes common HTML entities', () => {
      const result = parseDescription('<p>Tom &amp; Jerry&nbsp;say &quot;hi&quot; &#39;ok&#39; &rsquo;x&#x41;&#66;</p>');
      expect(result.paragraphs).toEqual(['Tom & Jerry say "hi" \'ok\' ’xAB']);
    });

    it('separates adjacent inline elements instead of gluing them together', () => {
      expect(parseDescription('<p>12 oz<span>407 GSM</span></p>').paragraphs).toEqual(['12 oz 407 GSM']);
    });
  });

  describe('spec grid', () => {
    it('extracts label/value pairs and drops inline svg icons', () => {
      const result = parseDescription(`<p>Intro</p>${card('Weight', '180 GSM')}${card('Fabric', 'Cotton')}`);
      expect(result.specPairs).toEqual([
        { label: 'Weight', value: '180 GSM' },
        { label: 'Fabric', value: 'Cotton' },
      ]);
    });

    it('ignores a card whose value is empty', () => {
      const result = parseDescription(`<p>Intro</p>${card('Weight', '')}${card('Fit', 'Boxy')}`);
      expect(result.specPairs).toEqual([{ label: 'Fit', value: 'Boxy' }]);
    });

    it('produces no spec pairs for a description without a spec grid', () => {
      expect(parseDescription('<p>Just a tote.</p>').specPairs).toEqual([]);
    });
  });

  describe('h3 sections', () => {
    it('keeps h3 sections that contain label/value pairs, with their title', () => {
      const html = `<p>Intro</p><h3>Specifications</h3>${card('Material', 'Wool')}${card('Care', 'Dry clean')}`;
      expect(parseDescription(html).sections).toEqual([
        {
          title: 'Specifications',
          pairs: [
            { label: 'Material', value: 'Wool' },
            { label: 'Care', value: 'Dry clean' },
          ],
        },
      ]);
    });

    it('drops h3 sections that have no label/value pairs', () => {
      const html = `<p>Intro</p><h3>Available sizes</h3><span>S</span><span>M</span><h3>Wholesale terms</h3>${card('Lead time', '3 weeks')}`;
      const { sections } = parseDescription(html);
      expect(sections.map((s) => s.title)).toEqual(['Wholesale terms']);
    });

    it('does not count pairs inside an h3 section as top-level spec pairs', () => {
      const html = `<p>Intro</p>${card('Weight', '180 GSM')}<h3>Wholesale terms</h3>${card('Lead time', '3 weeks')}`;
      const result = parseDescription(html);
      expect(result.specPairs).toEqual([{ label: 'Weight', value: '180 GSM' }]);
      expect(result.sections[0].pairs).toEqual([{ label: 'Lead time', value: '3 weeks' }]);
    });
  });

  describe('fallback', () => {
    it('degrades to flat paragraphs when no known markup shape is found', () => {
      const result = parseDescription('<ul><li>One</li><li>Two</li></ul>');
      expect(result.paragraphs).toEqual(['One', 'Two']);
      expect(result.specPairs).toEqual([]);
      expect(result.sections).toEqual([]);
    });

    it('degrades to plain text for markup-free input', () => {
      expect(parseDescription('Plain copy only').paragraphs).toEqual(['Plain copy only']);
    });
  });
});
