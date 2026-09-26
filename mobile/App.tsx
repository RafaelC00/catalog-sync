import 'react-native-gesture-handler';
import React from 'react';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StoreThemeProvider, useStoreTheme } from './src/theme/ThemeContext';
import { ThemeTransitionOverlay } from './src/theme/ThemeTransitionOverlay';
import { PersonaProvider } from './src/context/PersonaContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { FONTS_TO_LOAD } from './src/theme/fonts';

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
  const [fontsLoaded, fontError] = useFonts(FONTS_TO_LOAD);

  // Hold here instead of mounting the real tree: every themed `Text` in
  // this app resolves its `fontFamily` against these exact assets (see
  // `src/theme/fonts.ts`). Rendering before they're ready would paint the
  // platform system font for one frame and then swap to the brand font --
  // returning `null` means the app's first paint is already correct.
  // `fontError` still proceeds (a failed asset just resolves to the system
  // font via `resolveFontFamily`'s `undefined` fallback) rather than
  // getting stuck on a blank screen forever over one bad font file.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StoreThemeProvider>
            <PersonaProvider>
              <ThemedApp />
            </PersonaProvider>
          </StoreThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
