import { moduleTypeEmoji, moduleTypeLabel } from '../merchantModuleEmoji';
import type { PdpModuleType } from '../../types/domain';

const TYPES: PdpModuleType[] = ['care', 'size_guide', 'bundle'];

describe('merchantModuleEmoji', () => {
  it.each(TYPES)('has an emoji and a label for %s', (type) => {
    expect(moduleTypeEmoji(type)).toBeTruthy();
    expect(moduleTypeLabel(type)).toBeTruthy();
  });

  it('gives each module type a distinct emoji', () => {
    expect(new Set(TYPES.map(moduleTypeEmoji)).size).toBe(TYPES.length);
  });

  it('labels module types in human-readable form', () => {
    expect(moduleTypeLabel('size_guide')).toBe('Size guide');
  });

  it('returns the raw value for an unknown module type', () => {
    expect(moduleTypeLabel('mystery' as PdpModuleType)).toBe('mystery');
  });
});
