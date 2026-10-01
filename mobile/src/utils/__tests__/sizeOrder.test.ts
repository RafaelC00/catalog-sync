import { sortSizeValues } from '../sizeOrder';

describe('sortSizeValues', () => {
  it('sorts apparel sizes into canonical order, not alphabetical', () => {
    expect(sortSizeValues(['S', 'M', 'L', 'XL', '2XL', '3XL', 'XS'])).toEqual(['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']);
  });

  it('is case-insensitive', () => {
    expect(sortSizeValues(['l', 'xs', 'M'])).toEqual(['xs', 'M', 'l']);
  });

  it('puts unknown sizes after known ones, in their original relative order', () => {
    expect(sortSizeValues(['One Size', 'L', 'Custom', 'S'])).toEqual(['S', 'L', 'One Size', 'Custom']);
  });

  it('does not mutate its input', () => {
    const input = ['L', 'S'];
    sortSizeValues(input);
    expect(input).toEqual(['L', 'S']);
  });

  it('returns an empty list for empty input', () => {
    expect(sortSizeValues([])).toEqual([]);
  });
});
