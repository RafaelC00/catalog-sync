import { formatAmount, formatPrice } from '../formatPrice';

describe('formatPrice', () => {
  it('pads Shopify unpadded decimal strings to two places', () => {
    expect(formatPrice({ amount: '32.0', currencyCode: 'USD' })).toBe('USD 32.00');
  });

  it('keeps already padded amounts unchanged', () => {
    expect(formatPrice({ amount: '19.99', currencyCode: 'EUR' })).toBe('EUR 19.99');
  });

  it('falls back to the raw string rather than printing NaN', () => {
    expect(formatPrice({ amount: 'abc', currencyCode: 'USD' })).toBe('USD abc');
  });
});

describe('formatAmount', () => {
  it('formats a number with the currency code', () => {
    expect(formatAmount(5, 'USD')).toBe('USD 5.00');
  });
});
