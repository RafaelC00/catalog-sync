import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StoreThemeProvider, useStoreTheme } from './src/theme/ThemeContext';
import { ThemeTransitionOverlay } from './src/theme/ThemeTransitionOverlay';
import { RootNavigator } from './src/navigation/RootNavigator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60 * 1000,
    },
  },
});

function ThemedApp() {
  const { theme } = useStoreTheme();
  return (
    <NavigationContainer>
      <RootNavigator />
      <ThemeTransitionOverlay />
      <StatusBar style={isLight(theme.surfaceColor) ? 'dark' : 'light'} />
    </NavigationContainer>
  );
}

/** Cheap luminance check so the status bar icons stay legible against
 * whichever store's surface colour is active, instead of hardcoding one. */
function isLight(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  if (hex.length < 6) return true;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StoreThemeProvider>
            <ThemedApp />
          </StoreThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
