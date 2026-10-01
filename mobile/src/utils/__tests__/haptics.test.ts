import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { triggerSelectionHaptic } from '../haptics';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));

const impactAsync = Haptics.impactAsync as jest.Mock;
const originalOS = Platform.OS;

function setOS(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

beforeEach(() => impactAsync.mockReset().mockResolvedValue(undefined));
afterAll(() => setOS(originalOS));

describe('triggerSelectionHaptic', () => {
  it('uses a Light impact on iOS', () => {
    setOS('ios');
    triggerSelectionHaptic();
    expect(impactAsync).toHaveBeenCalledWith('light');
  });

  it('uses a Medium impact on Android', () => {
    setOS('android');
    triggerSelectionHaptic();
    expect(impactAsync).toHaveBeenCalledWith('medium');
  });

  it('does nothing on web', () => {
    setOS('web');
    triggerSelectionHaptic();
    expect(impactAsync).not.toHaveBeenCalled();
  });

  it('swallows a rejected haptic call instead of throwing', async () => {
    setOS('ios');
    impactAsync.mockRejectedValue(new Error('no actuator'));
    expect(() => triggerSelectionHaptic()).not.toThrow();
    await Promise.resolve();
  });
});
