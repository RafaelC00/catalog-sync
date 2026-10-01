import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStoreTheme } from '../../theme/ThemeContext';
import { resolveFontFamily } from '../../theme/fonts';
import { MerchantApiAuthError, MerchantApiUnavailableError } from '../../api/merchantClient';

/** Loading state for merchant screens -- same shape as the shopper's
 * `LoadingView` (src/components/StateViews.tsx) but kept as its own copy
 * rather than a shared import: the shopper one is deliberately scoped to
 * that persona's states, and this file is where every merchant-only
 * classification (`MerchantErrorView` below) lives together. */
export function MerchantLoadingView({ label }: { label: string }) {
  const { theme } = useStoreTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.surfaceColor }]}>
      <ActivityIndicator color={theme.primaryColor} />
      <Text
        style={[styles.message, { color: theme.textColor, fontFamily: resolveFontFamily(theme.bodyFont, 'regular') }]}
      >
        {label}
      </Text>
    </View>
  );
}

export function MerchantEmptyView({ label }: { label: string }) {
  const { theme } = useStoreTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.surfaceColor }]}>
      <Text
        style={[styles.message, { color: theme.textColor, fontFamily: resolveFontFamily(theme.bodyFont, 'regular') }]}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Classifies `error` into the calm, specific copy the spec asks for
 * ("a clear, calm 'merchant API unavailable' view with the reason, never
 * a crash or a blank screen") instead of one generic "Something went
 * wrong" for every failure mode. `MerchantApiUnavailableError` /
 * `MerchantApiAuthError` (see `src/api/merchantClient.ts`) each get their
 * own heading; anything else (a real 4xx/5xx from the backend, or a
 * thrown non-Error) falls back to a generic-but-still-specific message.
 */
function describeError(error: unknown): { icon: string; heading: string; detail: string } {
  if (error instanceof MerchantApiUnavailableError) {
    return { icon: '📡', heading: 'Merchant API unavailable', detail: error.message };
  }
  if (error instanceof MerchantApiAuthError) {
    return { icon: '🔒', heading: 'Not authorized', detail: error.message };
  }
  if (error instanceof Error) {
    return { icon: '⚠️', heading: 'Something went wrong', detail: error.message };
  }
  return { icon: '⚠️', heading: 'Something went wrong', detail: 'An unexpected error occurred.' };
}

export function MerchantErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { theme } = useStoreTheme();
  const { icon, heading, detail } = describeError(error);

  return (
    <View style={[styles.center, { backgroundColor: theme.surfaceColor }]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text
        style={[
          styles.heading,
          { color: theme.textColor, fontFamily: resolveFontFamily(theme.headingFont, 'semibold') },
        ]}
      >
        {heading}
      </Text>
      {/* Semantic error colour, same deliberate exception the shopper
          `ErrorView` makes -- this must read as an error regardless of
          which brand's theme is active. */}
      <Text
        style={[styles.detail, styles.errorText, { fontFamily: resolveFontFamily(theme.bodyFont, 'regular') }]}
      >
        {detail}
      </Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={[styles.retryButton, { backgroundColor: theme.primaryColor, borderRadius: theme.radius }]}
        >
          <Text
            style={[styles.retryLabel, { fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') }]}
          >
            Try again
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 10,
  },
  icon: {
    fontSize: 32,
    marginBottom: 4,
  },
  heading: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
  },
  detail: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorText: {
    color: '#B3261E',
  },
  retryButton: {
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
