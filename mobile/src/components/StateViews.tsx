import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useStoreTheme } from '../theme/ThemeContext';
import { resolveFontFamily } from '../theme/fonts';

/** Shared loading/empty/error states so every screen handles all three
 * consistently instead of ad-hoc `{data && ...}` checks that silently
 * render nothing when something's wrong. */

export function LoadingView({ label }: { label: string }) {
  const { theme } = useStoreTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.primaryColor} />
      <Text
        style={[styles.message, { color: theme.textColor, fontFamily: resolveFontFamily(theme.bodyFont, 'regular') }]}
      >
        {label}
      </Text>
    </View>
  );
}

export function EmptyView({ label }: { label: string }) {
  const { theme } = useStoreTheme();
  return (
    <View style={styles.center}>
      <Text
        style={[styles.message, { color: theme.textColor, fontFamily: resolveFontFamily(theme.bodyFont, 'regular') }]}
      >
        {label}
      </Text>
    </View>
  );
}

export function ErrorView({ label, onRetry }: { label: string; onRetry?: () => void }) {
  const { theme } = useStoreTheme();
  return (
    <View style={styles.center}>
      <Text style={[styles.message, styles.errorText, { fontFamily: resolveFontFamily(theme.bodyFont, 'regular') }]}>
        {label}
      </Text>
      {onRetry ? (
        <Text
          onPress={onRetry}
          style={[styles.retry, { color: theme.primaryColor, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') }]}
        >
          Tap to retry
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
  },
  // Deliberate exception to "no hardcoded colours": an error message is a
  // semantic/accessibility signal (this must read as an error regardless of
  // which store's theme is active), not brand styling, so it isn't tokenized
  // through BrandTheme.
  errorText: {
    color: '#B3261E',
  },
  retry: {
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
