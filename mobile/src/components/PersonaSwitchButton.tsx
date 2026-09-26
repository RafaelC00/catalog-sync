import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStoreTheme } from '../theme/ThemeContext';
import { usePersona } from '../context/PersonaContext';
import { resolveFontFamily } from '../theme/fonts';
import { triggerSelectionHaptic } from '../utils/haptics';
import type { RootStackParamList } from '../types/navigation';

/**
 * The persona switch "at the app root" the brief asks for. Rather than a
 * separate always-mounted overlay (which would have to reimplement header
 * safe-area/insets on every screen), this is dropped into every screen's
 * header via `RootNavigator`'s `screenOptions.headerRight` plus the two
 * `headerShown: false` home screens' own custom headers -- so it's reachable
 * from anywhere in either persona's stack, one tap away, always.
 *
 * Switching persona is a `navigation.reset` (not `navigate`) to that
 * persona's home route: both personas live in one `RootStackParamList`
 * (see `types/navigation.ts`), so without a reset the *other* persona's
 * screens would still sit underneath in the stack, reachable by hitting
 * back into a persona that's no longer "active".
 */
export function PersonaSwitchButton() {
  const { theme } = useStoreTheme();
  const { persona, toggledPersona, setPersona } = usePersona();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handlePress = () => {
    triggerSelectionHaptic();
    setPersona(toggledPersona);
    navigation.reset({
      index: 0,
      routes: [{ name: toggledPersona === 'merchant' ? 'MerchantOverview' : 'ProductList' }],
    });
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.pill,
        {
          borderColor: theme.primaryColor,
          borderRadius: theme.radius,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        style={[styles.label, { color: theme.primaryColor, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') }]}
      >
        {persona === 'merchant' ? '🛍️ Shopper' : '🧑‍💼 Merchant'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
