import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BrandTheme } from '../../types/domain';
import type { ProductOption } from '../../types/shopify';
import { orderedSizeValues } from '../../utils/productOptions';
import { triggerSelectionHaptic } from '../../utils/haptics';
import { resolveFontFamily } from '../../theme/fonts';

interface SizeChipsProps {
  option: ProductOption;
  selected: string;
  onSelect: (value: string) => void;
  isAvailable: (value: string) => boolean;
  theme: BrandTheme;
}

/**
 * Size chips in canonical size order (`sortSizeValues`), not the source
 * array order or alphabetical. `isAvailable` is asked per value rather
 * than baked into this component, since "available" depends on the
 * *currently selected colour* -- ProductDetailScreen recomputes it from
 * `variants[].availableForSale` every time the colour selection changes.
 */
export function SizeChips({ option, selected, onSelect, isAvailable, theme }: SizeChipsProps) {
  const values = orderedSizeValues(option);

  const handleSelect = (value: string) => {
    if (!isAvailable(value) || value === selected) return;
    triggerSelectionHaptic();
    onSelect(value);
  };

  return (
    <View style={styles.container}>
      <Text
        style={[styles.label, { color: `${theme.textColor}99`, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') }]}
      >
        {option.name.toUpperCase()}
      </Text>
      <View style={styles.row}>
        {values.map((value) => {
          const available = isAvailable(value);
          const isSelected = value === selected && available;

          return (
            <Pressable
              key={value}
              disabled={!available}
              onPress={() => handleSelect(value)}
              style={({ pressed }) => [
                styles.chip,
                {
                  borderRadius: theme.radius,
                  borderColor: isSelected ? theme.primaryColor : `${theme.textColor}${available ? '30' : '15'}`,
                  backgroundColor: isSelected ? theme.primaryColor : 'transparent',
                  opacity: pressed && available ? 0.75 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: isSelected ? '#FFFFFF' : `${theme.textColor}${available ? 'FF' : '55'}`,
                    textDecorationLine: available ? 'none' : 'line-through',
                    fontFamily: resolveFontFamily(theme.bodyFont, 'semibold'),
                  },
                ]}
              >
                {value}
              </Text>
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
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minWidth: 44,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
