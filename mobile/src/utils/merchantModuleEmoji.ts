import type { PdpModuleType } from '../types/domain';

/**
 * Restrained module-type -> emoji lookup for the merchant screens, in the
 * same spirit as `specEmoji.ts`. A module's own `icon` field (when the
 * backend sends one) always wins -- this is only the fallback for a blank
 * `icon`, keyed by `module_type` since that set is fixed and small.
 */
const MODULE_TYPE_EMOJI: Record<PdpModuleType, string> = {
  care: '🧼',
  size_guide: '📏',
  bundle: '📦',
};

export function moduleTypeEmoji(moduleType: PdpModuleType): string {
  return MODULE_TYPE_EMOJI[moduleType];
}

export function moduleTypeLabel(moduleType: PdpModuleType): string {
  switch (moduleType) {
    case 'care':
      return 'Care';
    case 'size_guide':
      return 'Size guide';
    case 'bundle':
      return 'Bundle';
    default:
      return moduleType;
  }
}
