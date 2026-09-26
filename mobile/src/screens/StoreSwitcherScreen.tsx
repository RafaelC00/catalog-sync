import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStoreTheme } from '../theme/ThemeContext';
import { triggerSelectionHaptic } from '../utils/haptics';
import { resolveFontFamily } from '../theme/fonts';
import type { StoreSwitcherScreenProps } from '../types/navigation';
import type { StoreConfig } from '../types/domain';

/**
 * Presented as a native-stack modal (see RootNavigator). This is the
 * "headline demo" moment -- picking a store here changes `storeId` in
 * StoreThemeContext, which re-fetches that store's `demo_brand_theme` and
 * re-themes every screen underneath, while ThemeTransitionOverlay plays
 * the colour-wash transition on top.
 */
export function StoreSwitcherScreen({ navigation }: StoreSwitcherScreenProps) {
  const { storeId, availableStores, setStoreId, theme } = useStoreTheme();

  const handleSelect = (store: StoreConfig) => {
    triggerSelectionHaptic();
    setStoreId(store.id);
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surfaceColor }]}>
      <Text style={[styles.title, { color: theme.textColor, fontFamily: resolveFontFamily(theme.headingFont, 'bold') }]}>
        Choose a store
      </Text>
      {availableStores.map((store) => {
        const isActive = store.id === storeId;
        return (
          <Pressable
            key={store.id}
            onPress={() => handleSelect(store)}
            style={[
              styles.option,
              {
                borderRadius: theme.radius,
                borderColor: isActive ? theme.primaryColor : `${theme.textColor}20`,
              },
            ]}
          >
            <Text
              style={[
                styles.optionLabel,
                { color: theme.textColor, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') },
              ]}
            >
              {store.label}
            </Text>
            {isActive ? (
              <Text
                style={[
                  styles.activeMark,
                  { color: theme.primaryColor, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') },
                ]}
              >
                Active
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    padding: 16,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  activeMark: {
    fontSize: 13,
    fontWeight: '600',
  },
});
