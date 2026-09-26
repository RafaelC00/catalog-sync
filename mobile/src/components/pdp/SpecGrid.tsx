import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BrandTheme } from '../../types/domain';
import type { DescriptionSpecPair } from '../../utils/parseDescription';
import { specEmoji } from '../../utils/specEmoji';
import { resolveFontFamily } from '../../theme/fonts';

/**
 * The replacement for the stripped "Weight\n180 GSM\nFabric\n..." wall: a
 * two-up card grid, one card per label/value pair, with a single emoji
 * standing in for the source markup's inline `<svg>` icon. Reused both for
 * the ungrouped top-of-description spec grid and inside each collapsible
 * `<h3>` section (Specifications, Wholesale terms) so the whole PDP reads
 * as one consistent pattern rather than two different treatments.
 */
export function SpecGrid({ pairs, theme }: { pairs: DescriptionSpecPair[]; theme: BrandTheme }) {
  if (pairs.length === 0) return null;

  return (
    <View style={styles.grid}>
      {pairs.map((pair, index) => (
        <View
          key={`${pair.label}-${index}`}
          style={[styles.card, { backgroundColor: `${theme.textColor}0D`, borderRadius: theme.radius }]}
        >
          <View style={styles.labelRow}>
            <Text style={styles.emoji}>{specEmoji(pair.label)}</Text>
            <Text
              style={[
                styles.label,
                { color: `${theme.textColor}99`, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') },
              ]}
            >
              {pair.label.toUpperCase()}
            </Text>
          </View>
          <Text
            style={[styles.value, { color: theme.textColor, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') }]}
          >
            {pair.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '47%',
    flexGrow: 1,
    padding: 14,
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emoji: {
    fontSize: 15,
    lineHeight: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
});
