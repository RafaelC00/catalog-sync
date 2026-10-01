import { specEmoji } from '../specEmoji';

describe('specEmoji', () => {
  it('returns the mapped emoji for a known label', () => {
    expect(specEmoji('Weight')).toBe('⚖️');
    expect(specEmoji('Fabric')).toBe('🧵');
  });

  it('matches case-insensitively', () => {
    expect(specEmoji('LEAD TIME')).toBe(specEmoji('lead time'));
    expect(specEmoji('lead time')).toBe('⏱️');
  });

  it('ignores surrounding whitespace', () => {
    expect(specEmoji('  Fit  ')).toBe(specEmoji('fit'));
  });

  it('maps both spellings of minimum order to the same emoji', () => {
    expect(specEmoji('Min. order')).toBe(specEmoji('Minimum order'));
  });

  it('falls back to a generic emoji for an unmapped label', () => {
    expect(specEmoji('Customization')).toBe('🏷️');
  });

  it('falls back to the generic emoji for an empty label', () => {
    expect(specEmoji('')).toBe('🏷️');
    expect(specEmoji('   ')).toBe('🏷️');
  });

  // Known bug: SPEC_EMOJI is a plain object literal, so a label such as
  // "constructor" resolves to Object.prototype.constructor (a function)
  // instead of the fallback. Marked as failing until specEmoji.ts guards the
  // lookup with Object.hasOwn / a Map; remove `.failing` when fixed.
  it('does not treat object prototype keys as labels', () => {
    expect(specEmoji('constructor')).toBe('🏷️');
  });
});
