import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStoreTheme } from '../theme/ThemeContext';
import { resolveFontFamily } from '../theme/fonts';
import { ProductListScreen } from '../screens/ProductListScreen';
import { ProductDetailScreen } from '../screens/ProductDetailScreen';
import { StoreSwitcherScreen } from '../screens/StoreSwitcherScreen';
import { MerchantOverviewScreen } from '../screens/merchant/MerchantOverviewScreen';
import { MerchantModulesScreen } from '../screens/merchant/MerchantModulesScreen';
import { MerchantModuleEditorScreen } from '../screens/merchant/MerchantModuleEditorScreen';
import { MerchantProductsScreen } from '../screens/merchant/MerchantProductsScreen';
import { MerchantProductModulesScreen } from '../screens/merchant/MerchantProductModulesScreen';
import { PersonaSwitchButton } from '../components/PersonaSwitchButton';
import type { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { theme } = useStoreTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: theme.primaryColor,
        headerStyle: { backgroundColor: theme.surfaceColor },
        // Explicit semibold weight (not left unspecified) so the heading
        // fonts never need a regular-weight variant bundled -- no heading
        // anywhere in this app renders at regular weight, see fonts.ts.
        headerTitleStyle: { fontFamily: resolveFontFamily(theme.headingFont, 'semibold'), fontWeight: '600' },
        // Platform difference #3: iOS's native-stack supports the
        // collapsing "large title" header (a system idiom users expect,
        // e.g. App Store, Settings). Android/Material has no equivalent
        // pattern -- forcing it there just wastes vertical space with a
        // header style nobody on that platform recognizes, so it's iOS-only.
        headerLargeTitle: Platform.OS === 'ios',
        // Reachable from every screen that keeps the default header (the
        // two home screens -- ProductList, MerchantOverview -- render
        // their own custom header instead and embed the same button
        // directly; see PersonaSwitchButton's own doc comment for why a
        // single global control beats a floating overlay here).
        headerRight: () => <PersonaSwitchButton />,
      }}
    >
      <Stack.Screen
        name="ProductList"
        component={ProductListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={({ route }) => ({ title: route.params.title, headerLargeTitle: false })}
      />
      <Stack.Screen
        name="StoreSwitcher"
        component={StoreSwitcherScreen}
        options={{ presentation: 'modal', title: 'Switch store' }}
      />
      <Stack.Screen
        name="MerchantOverview"
        component={MerchantOverviewScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MerchantModules"
        component={MerchantModulesScreen}
        options={{ title: 'Modules', headerLargeTitle: false }}
      />
      <Stack.Screen
        name="MerchantModuleEditor"
        component={MerchantModuleEditorScreen}
        options={{ title: 'Edit module', headerLargeTitle: false }}
      />
      <Stack.Screen
        name="MerchantProducts"
        component={MerchantProductsScreen}
        options={{ title: 'Products', headerLargeTitle: false }}
      />
      <Stack.Screen
        name="MerchantProductModules"
        component={MerchantProductModulesScreen}
        options={({ route }) => ({ title: route.params.title, headerLargeTitle: false })}
      />
    </Stack.Navigator>
  );
}
