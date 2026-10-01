import { needsSwatchBorder, resolveSwatchHex, swatchBorderColor, swatchLuma } from '../colorRegistry';

describe('resolveSwatchHex', () => {
  it('resolves a known colour name', () => {
    expect(resolveSwatchHex('Navy')).toBe('#14213d');
  });

  it('is case and whitespace insensitive', () => {
    expect(resolveSwatchHex('  HEATHER GREY ')).toBe('#9a9a9a');
  });

  it('resolves Spanish colour names', () => {
    expect(resolveSwatchHex('Negro')).toBe('#1a1a1a');
  });

  it('returns undefined for an unknown colour rather than guessing', () => {
    expect(resolveSwatchHex('Chartreuse')).toBeUndefined();
  });
});

describe('swatchLuma', () => {
  it('is 0 for black and 1 for white', () => {
    expect(swatchLuma('#000000')).toBe(0);
    expect(swatchLuma('#ffffff')).toBeCloseTo(1, 5);
  });

  it('returns 0 for a malformed hex', () => {
    expect(swatchLuma('#fff')).toBe(0);
  });
});

describe('needsSwatchBorder', () => {
  it('needs a border for a white swatch on a white surface', () => {
    expect(needsSwatchBorder('#ffffff', '#ffffff')).toBe(true);
  });

  it('needs a border for a black swatch on a near-black surface', () => {
    expect(needsSwatchBorder('#1a1a1a', '#0a0a0a')).toBe(true);
  });

  it('needs no border when swatch and surface contrast strongly', () => {
    expect(needsSwatchBorder('#1a1a1a', '#ffffff')).toBe(false);
  });
});

describe('swatchBorderColor', () => {
  it('darkens against a light swatch and lightens against a dark one', () => {
    expect(swatchBorderColor('#ffffff')).toBe('rgba(0,0,0,0.22)');
    expect(swatchBorderColor('#000000')).toBe('rgba(255,255,255,0.28)');
  });
});
