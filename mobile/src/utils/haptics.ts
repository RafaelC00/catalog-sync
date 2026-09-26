import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Platform difference #2 (haptics): iOS has a Taptic Engine tuned for
 * crisp, low-amplitude "Light" impacts; Android's linear resonant
 * actuators are less consistent at that intensity across devices, so we
 * ask for "Medium" there to stay perceptible. Web has no Vibration/Haptics
 * API at all -- calling expo-haptics there would just reject a promise
 * nobody awaits, so we no-op instead of letting that surface as a warning.
 */
export function triggerSelectionHaptic(): void {
  if (Platform.OS === 'web') return;

  const style = Platform.OS === 'ios' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium;

  Haptics.impactAsync(style).catch(() => {
    // Best-effort only -- a haptics failure should never block the
    // interaction it's decorating (accordion toggle, store switch, etc).
  });
}
