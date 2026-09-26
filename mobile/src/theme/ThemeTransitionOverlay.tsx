import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { useStoreTheme } from './ThemeContext';

/**
 * A full-screen colour wash that plays over the app on every store switch.
 * This is the "headline demo" moment: switching brands should feel like a
 * deliberate transition, not a re-render. Implementation: an absolutely
 * positioned, pointerEvents="none" layer fades in to the *new* theme's
 * primary colour and back out, timed so the underlying screen has already
 * re-rendered with the new theme by the time the wash clears.
 */
export function ThemeTransitionOverlay() {
  const { theme, transitionToken } = useStoreTheme();
  const opacity = useSharedValue(0);
  const color = useSharedValue(theme.primaryColor);

  useEffect(() => {
    if (transitionToken === 0) return; // skip on initial mount
    color.value = theme.primaryColor;
    opacity.value = withSequence(
      withTiming(0.94, { duration: 180, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitionToken]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    backgroundColor: color.value,
  }));

  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlay, animatedStyle]} />;
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 999,
  },
});
