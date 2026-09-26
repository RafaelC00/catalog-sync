import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { BrandTheme } from '../../types/domain';
import { triggerSelectionHaptic } from '../../utils/haptics';
import { resolveFontFamily } from '../../theme/fonts';

/**
 * Tap-to-expand section for the description's `<h3>`-titled blocks
 * (Specifications, Wholesale terms). Deliberately the same interaction as
 * `CareAccordion` (+/- chevron, reanimated FadeIn/FadeOut on the body,
 * haptic on toggle) so the PDP feels like one coherent pattern rather than
 * two accordions that happen to look similar. Kept as its own component
 * instead of reusing `CareAccordion` directly because that one is typed
 * around a metaobject-driven `PdpModule` with a single plain-text body;
 * this one takes an arbitrary heading + children (a `SpecGrid`).
 */
export function CollapsibleSection({
  title,
  theme,
  defaultExpanded = false,
  children,
}: {
  title: string;
  theme: BrandTheme;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = () => {
    triggerSelectionHaptic();
    setExpanded((value) => !value);
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
          {title}
        </Text>
        <Text
          style={[styles.chevron, { color: theme.primaryColor, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') }]}
        >
          {expanded ? '−' : '+'}
        </Text>
      </Pressable>
      {expanded ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={styles.body}>
          {children}
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
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
});
