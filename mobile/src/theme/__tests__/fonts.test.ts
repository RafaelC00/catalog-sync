import { FONTS_TO_LOAD, resolveFontFamily } from '../fonts';
import { DEFAULT_THEME } from '../defaultTheme';

describe('resolveFontFamily', () => {
  it('maps a bundled font name and weight onto the loaded family name', () => {
    expect(resolveFontFamily('Cormorant', 'bold')).toBe('Cormorant_700Bold');
    expect(resolveFontFamily('Inter', 'regular')).toBe('Inter_400Regular');
  });

  it('returns undefined for the "System" font used by DEFAULT_THEME, so RN uses the platform font', () => {
    expect(resolveFontFamily(DEFAULT_THEME.headingFont, 'bold')).toBeUndefined();
    expect(resolveFontFamily(DEFAULT_THEME.bodyFont, 'regular')).toBeUndefined();
  });

  it('returns undefined for a font that was never bundled', () => {
    expect(resolveFontFamily('Comic Sans', 'semibold')).toBeUndefined();
  });

  it('returns undefined for a weight the family does not load (heading fonts skip regular)', () => {
    expect(resolveFontFamily('Cormorant', 'regular')).toBeUndefined();
    expect(resolveFontFamily('Archivo', 'regular')).toBeUndefined();
  });

  it('is case-sensitive: a differently cased name is treated as unbundled', () => {
    expect(resolveFontFamily('inter', 'bold')).toBeUndefined();
  });

  it('only ever returns families that are actually loaded', () => {
    const loaded = Object.keys(FONTS_TO_LOAD);
    for (const name of ['Cormorant', 'Archivo', 'Montserrat', 'Inter']) {
      for (const weight of ['regular', 'semibold', 'bold'] as const) {
        const family = resolveFontFamily(name, weight);
        if (family !== undefined) expect(loaded).toContain(family);
      }
    }
  });
});
