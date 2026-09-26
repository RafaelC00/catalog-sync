import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { PdpModule, BrandTheme } from '../../types/domain';
import { triggerSelectionHaptic } from '../../utils/haptics';
import { resolveFontFamily } from '../../theme/fonts';

/**
 * `care` module: a tap-to-expand accordion. Uses reanimated's Layout
 * Animations (`entering`/`exiting`) rather than manual shared values --
 * for a mount/unmount transition like this, they're the more direct tool
 * (still genuinely reanimated, just its declarative layer instead of the
 * imperative one used in ImageGallery, which needs frame-by-frame control).
 */
export function CareAccordion({ module, theme }: { module: PdpModule; theme: BrandTheme }) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    triggerSelectionHaptic();
    setExpanded((v) => !v);
  };

  return (
    <View style={[styles.container, { borderColor: `${theme.textColor}20`, borderRadius: theme.radius }]}>
      <Pressable onPress={toggle} style={styles.header}>
        <Text
          style={[
            styles.heading,
            { color: theme.textColor, fontFamily: resolveFontFamily(theme.headingFont, 'semibold') },
          ]}
        >
          {module.heading}
        </Text>
        {/* Previously left on default styles entirely -- no theme font at
            all, unlike every other label in this module. Fixed to match:
            semibold body-font, same weight the style already declared. */}
        <Text
          style={[styles.chevron, { color: theme.primaryColor, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') }]}
        >
          {expanded ? '−' : '+'}
        </Text>
      </Pressable>
      {expanded ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={styles.body}>
          <Text
            style={[styles.bodyText, { color: theme.textColor, fontFamily: resolveFontFamily(theme.bodyFont, 'regular') }]}
          >
            {module.body}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  heading: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 12,
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 19,
  },
});
