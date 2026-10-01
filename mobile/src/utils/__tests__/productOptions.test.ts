import {
  defaultOptionValue,
  findColorOption,
  findMatchingVariant,
  findSizeOption,
  isCombinationAvailable,
} from '../productOptions';
import type { ProductOption, ProductVariant } from '../../types/shopify';

const variant = (id: string, color: string, size: string, availableForSale: boolean): ProductVariant => ({
  id,
  title: `${color} / ${size}`,
  availableForSale,
  price: { amount: '10.0', currencyCode: 'USD' },
  selectedOptions: [
    { name: 'Color', value: color },
    { name: 'Size', value: size },
  ],
});

const variants = [
  variant('1', 'Black', 'S', false),
  variant('2', 'Black', 'M', false),
  variant('3', 'Navy', 'S', true),
  variant('4', 'Navy', 'M', false),
];

describe('findColorOption / findSizeOption', () => {
  const options: ProductOption[] = [
    { name: 'Talla', values: ['S'] },
    { name: 'Colour', values: ['Negro'] },
  ];

  it('detects colour by name, including the British spelling', () => {
    expect(findColorOption(options)?.name).toBe('Colour');
  });

  it('detects size by name, including the Spanish "Talla"', () => {
    expect(findSizeOption(options)?.name).toBe('Talla');
  });

  it('returns undefined when no matching option exists', () => {
    expect(findColorOption([{ name: 'Estilo', values: ['A'] }])).toBeUndefined();
    expect(findSizeOption([])).toBeUndefined();
  });
});

describe('isCombinationAvailable', () => {
  it('is true when a matching variant is in stock', () => {
    expect(isCombinationAvailable(variants, [{ name: 'Color', value: 'Navy' }])).toBe(true);
  });

  it('is false when every matching variant is sold out', () => {
    expect(isCombinationAvailable(variants, [{ name: 'Color', value: 'Black' }])).toBe(false);
  });

  it('requires every constraint to match the same variant', () => {
    expect(
      isCombinationAvailable(variants, [
        { name: 'Color', value: 'Navy' },
        { name: 'Size', value: 'M' },
      ])
    ).toBe(false);
  });

  it('ignores options the constraints do not mention', () => {
    const base = variant('5', 'Navy', 'S', true);
    const withStyle = [{ ...base, selectedOptions: [...base.selectedOptions, { name: 'Estilo', value: 'X' }] }];
    expect(isCombinationAvailable(withStyle, [{ name: 'Color', value: 'Navy' }])).toBe(true);
  });
});

describe('findMatchingVariant', () => {
  it('returns the variant matching all constraints', () => {
    expect(
      findMatchingVariant(variants, [
        { name: 'Color', value: 'Navy' },
        { name: 'Size', value: 'M' },
      ])?.id
    ).toBe('4');
  });

  it('returns undefined with no constraints', () => {
    expect(findMatchingVariant(variants, [])).toBeUndefined();
  });

  it('returns undefined when nothing matches', () => {
    expect(findMatchingVariant(variants, [{ name: 'Color', value: 'Pink' }])).toBeUndefined();
  });
});

describe('defaultOptionValue', () => {
  it('picks the first value that has an in-stock variant', () => {
    expect(defaultOptionValue({ name: 'Color', values: ['Black', 'Navy'] }, variants)).toBe('Navy');
  });

  it('falls back to the first value when everything is sold out', () => {
    const soldOut = variants.map((v) => ({ ...v, availableForSale: false }));
    expect(defaultOptionValue({ name: 'Color', values: ['Black', 'Navy'] }, soldOut)).toBe('Black');
  });
});
