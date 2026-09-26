import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BrandTheme } from '../../types/domain';
import type { ProductOption } from '../../types/shopify';
import { needsSwatchBorder, resolveSwatchHex, swatchBorderColor } from '../../utils/colorRegistry';
import { triggerSelectionHaptic } from '../../utils/haptics';
import { resolveFontFamily } from '../../theme/fonts';

const OUTER_SIZE = 40;
const INNER_SIZE = 30;

interface ColorSwatchesProps {
  option: ProductOption;
  selected: string;
  onSelect: (value: string) => void;
  theme: BrandTheme;
}

/**
 * Renders `option.values` as real colour swatches when the name resolves
 * in `colorRegistry` (verified live hexes only), and as a neutral text
 * chip otherwise -- Nómada's "Negro"/"Marfil" values are real, common
 * option values on that store but aren't in the (English, Loomwerk-hex)
 * registry, so they correctly fall back rather than rendering a guessed
 * colour. Selection state is a ring around the swatch, not a colour
 * change, since the swatch's own colour is the one thing that must never
 * be affected by "selected" vs not.
 */
export function ColorSwatches({ option, selected, onSelect, theme }: ColorSwatchesProps) {
  const handleSelect = (value: string) => {
    if (value === selected) return;
    triggerSelectionHaptic();
    onSelect(value);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text
          style={[
            styles.label,
            { color: `${theme.textColor}99`, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') },
          ]}
        >
          {option.name.toUpperCase()}
        </Text>
        <Text style={[styles.value, { color: theme.textColor, fontFamily: resolveFontFamily(theme.bodyFont, 'bold') }]}>
          {selected}
        </Text>
      </View>
      <View style={styles.row}>
        {option.values.map((value) => {
          const hex = resolveSwatchHex(value);
          const isSelected = value === selected;

          if (!hex) {
            return (
              <Pressable
                key={value}
                onPress={() => handleSelect(value)}
                style={({ pressed }) => [
                  styles.unknownChip,
                  {
                    borderRadius: theme.radius,
                    borderColor: isSelected ? theme.primaryColor : `${theme.textColor}30`,
                    backgroundColor: isSelected ? `${theme.primaryColor}14` : 'transparent',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.unknownChipText,
                    {
                      color: isSelected ? theme.primaryColor : theme.textColor,
                      fontFamily: resolveFontFamily(theme.bodyFont, 'semibold'),
                    },
                  ]}
                >
                  {value}
                </Text>
              </Pressable>
            );
          }

          // Contrast is against the ACTIVE theme's surface, not a fixed
          // assumption of a light page: black disappears on Loomwerk's
          // near-black ground exactly as white does on Nomada's cream.
          const lowContrast = needsSwatchBorder(hex, theme.surfaceColor);

          return (
            <Pressable
              key={value}
              onPress={() => handleSelect(value)}
              accessibilityLabel={value}
              style={({ pressed }) => [
                styles.swatchOuter,
                {
                  borderColor: isSelected ? theme.primaryColor : 'transparent',
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.swatchInner,
                  {
                    backgroundColor: hex,
                    borderColor: lowContrast ? swatchBorderColor(hex) : `${theme.textColor}1A`,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  swatchOuter: {
    width: OUTER_SIZE,
    height: OUTER_SIZE,
    borderRadius: OUTER_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchInner: {
    width: INNER_SIZE,
    height: INNER_SIZE,
    borderRadius: INNER_SIZE / 2,
    borderWidth: 1,
  },
  unknownChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    justifyContent: 'center',
  },
  unknownChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
