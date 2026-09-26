import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useStoreTheme } from '../../theme/ThemeContext';
import { usePersona } from '../../context/PersonaContext';
import { resolveFontFamily } from '../../theme/fonts';
import { useMerchantModules, useMerchantProducts, useUpdateProductModules } from '../../api/merchant';
import { MerchantLoadingView, MerchantErrorView } from '../../components/merchant/MerchantStateViews';
import { moduleTypeEmoji, moduleTypeLabel } from '../../utils/merchantModuleEmoji';
import { triggerSelectionHaptic } from '../../utils/haptics';
import type { MerchantProductModulesScreenProps } from '../../types/navigation';

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((value) => setB.has(value));
}

/**
 * Attach/detach editor for one product's modules -- a **full replacement**
 * per the backend contract (`PUT .../products/{handle}/modules` takes the
 * complete `handles` list, not a diff), so `handleSave` always sends the
 * whole current `selectedHandles` set rather than trying to compute an
 * add/remove delta.
 *
 * Fetches the full product list (`filter: 'all'`) rather than trusting
 * whichever filtered list the Products screen linked from -- the product
 * this screen needs may not be in a `has`/`missing`-filtered cache entry
 * at all, and `'all'` is guaranteed to contain it.
 */
export function MerchantProductModulesScreen({ route, navigation }: MerchantProductModulesScreenProps) {
  const { handle, title } = route.params;
  const { store, theme } = useStoreTheme();
  const { setPersona } = usePersona();

  const productsQuery = useMerchantProducts(store, 'all');
  const modulesQuery = useMerchantModules(store);
  const updateProductModules = useUpdateProductModules(store);

  const product = productsQuery.data?.find((p) => p.handle === handle);
  const [selectedHandles, setSelectedHandles] = useState<string[]>([]);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!product) return;
    setSelectedHandles(product.module_handles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.handle]);

  const isLoading = productsQuery.isLoading || modulesQuery.isLoading;
  const isError = productsQuery.isError || modulesQuery.isError;

  if (isLoading) {
    return <MerchantLoadingView label="Loading product…" />;
  }

  if (isError) {
    return (
      <MerchantErrorView
        error={productsQuery.error ?? modulesQuery.error}
        onRetry={() => {
          productsQuery.refetch();
          modulesQuery.refetch();
        }}
      />
    );
  }

  if (!product || !modulesQuery.data) {
    return <MerchantErrorView error={new Error(`Product "${handle}" was not found.`)} onRetry={productsQuery.refetch} />;
  }

  const modules = modulesQuery.data;
  const isDirty = !sameSet(selectedHandles, product.module_handles);
  const canSave = isDirty && !updateProductModules.isPending;

  const toggleModule = (moduleHandle: string) => {
    triggerSelectionHaptic();
    setJustSaved(false);
    setSelectedHandles((current) =>
      current.includes(moduleHandle) ? current.filter((h) => h !== moduleHandle) : [...current, moduleHandle]
    );
  };

  const handleSave = () => {
    triggerSelectionHaptic();
    setJustSaved(false);
    updateProductModules.mutate(
      { handle: product.handle, moduleHandles: selectedHandles },
      { onSuccess: () => setJustSaved(true) }
    );
  };

  const handlePreview = () => {
    triggerSelectionHaptic();
    // The "moment this has to deliver": jump into the exact shopper PDP
    // for this product. Switches persona AND resets the stack under it to
    // [ProductList, ProductDetail] -- not a plain `navigate`, which would
    // leave the merchant stack sitting underneath a persona that's no
    // longer active (see PersonaSwitchButton's own comment for why a
    // reset, not a push, is what keeps the two in sync).
    setPersona('shopper');
    navigation.reset({
      index: 1,
      routes: [{ name: 'ProductList' }, { name: 'ProductDetail', params: { handle: product.handle, title } }],
    });
  };

  return (
    <ScrollView style={{ backgroundColor: theme.surfaceColor }} contentContainerStyle={styles.content}>
      <View style={styles.productRow}>
        <Image
          source={product.featured_image_url ? { uri: product.featured_image_url } : undefined}
          style={[styles.thumb, { borderRadius: theme.radius / 1.5, backgroundColor: `${theme.textColor}10` }]}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={product.handle}
        />
        <View style={styles.productText}>
          <Text
            style={[styles.title, { color: theme.textColor, fontFamily: resolveFontFamily(theme.headingFont, 'semibold') }]}
            numberOfLines={2}
          >
            {product.title}
          </Text>
          <Pressable onPress={handlePreview} style={styles.previewLink}>
            <Text
              style={[styles.previewLinkText, { color: theme.primaryColor, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') }]}
            >
              👀 Preview as shopper
            </Text>
          </Pressable>
        </View>
      </View>

      <Text
        style={[styles.sectionLabel, { color: `${theme.textColor}99`, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') }]}
      >
        MODULES ON THIS PRODUCT
      </Text>

      <View style={styles.moduleList}>
        {modules.map((module) => {
          const isSelected = selectedHandles.includes(module.handle);
          return (
            <Pressable
              key={module.handle}
              onPress={() => toggleModule(module.handle)}
              disabled={updateProductModules.isPending}
              style={[
                styles.moduleRow,
                {
                  borderRadius: theme.radius,
                  borderColor: isSelected ? theme.primaryColor : `${theme.textColor}20`,
                  backgroundColor: isSelected ? `${theme.primaryColor}0F` : 'transparent',
                },
              ]}
            >
              <Text style={styles.moduleEmoji}>{module.icon || moduleTypeEmoji(module.module_type)}</Text>
              <View style={styles.moduleText}>
                <Text
                  style={[styles.moduleType, { color: `${theme.textColor}99`, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') }]}
                >
                  {moduleTypeLabel(module.module_type).toUpperCase()}
                </Text>
                <Text
                  style={[styles.moduleHeading, { color: theme.textColor, fontFamily: resolveFontFamily(theme.headingFont, 'semibold') }]}
                  numberOfLines={1}
                >
                  {module.heading}
                </Text>
              </View>
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: isSelected ? theme.primaryColor : `${theme.textColor}40`,
                    backgroundColor: isSelected ? theme.primaryColor : 'transparent',
                    borderRadius: theme.radius / 3,
                  },
                ]}
              >
                {isSelected ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {updateProductModules.isError ? (
        <View style={[styles.errorBanner, { borderRadius: theme.radius }]}>
          <Text style={styles.errorBannerText}>
            {updateProductModules.error instanceof Error
              ? updateProductModules.error.message
              : 'Could not save these changes.'}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={handleSave}
        disabled={!canSave}
        style={[
          styles.saveButton,
          {
            borderRadius: theme.radius,
            backgroundColor: canSave ? theme.primaryColor : `${theme.textColor}20`,
          },
        ]}
      >
        <Text
          style={[
            styles.saveButtonText,
            { color: canSave ? '#FFFFFF' : `${theme.textColor}80`, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') },
          ]}
        >
          {updateProductModules.isPending ? 'Saving…' : justSaved ? 'Saved ✓' : 'Save changes'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    gap: 18,
    paddingBottom: 40,
  },
  productRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  thumb: {
    width: 64,
    height: 64,
  },
  productText: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  previewLink: {
    alignSelf: 'flex-start',
  },
  previewLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  moduleList: {
    gap: 10,
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    padding: 12,
  },
  moduleEmoji: {
    fontSize: 18,
  },
  moduleText: {
    flex: 1,
    gap: 2,
  },
  moduleType: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  moduleHeading: {
    fontSize: 14,
    fontWeight: '600',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxMark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: 'rgba(179,38,30,0.1)',
    padding: 12,
  },
  errorBannerText: {
    color: '#B3261E',
    fontSize: 13,
  },
  saveButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
