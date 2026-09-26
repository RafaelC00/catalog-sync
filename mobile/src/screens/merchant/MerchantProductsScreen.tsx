import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useStoreTheme } from '../../theme/ThemeContext';
import { resolveFontFamily } from '../../theme/fonts';
import { useMerchantProducts } from '../../api/merchant';
import { MerchantLoadingView, MerchantErrorView, MerchantEmptyView } from '../../components/merchant/MerchantStateViews';
import type { MerchantProductsScreenProps } from '../../types/navigation';
import type { MerchantProductFilter, MerchantProductListItem } from '../../types/merchant';
import type { BrandTheme } from '../../types/domain';

const FILTERS: { value: MerchantProductFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'has', label: 'Has modules' },
  { value: 'missing', label: 'Missing' },
];

/**
 * The catalog, filterable by module coverage. `has_modules` filtering is
 * server-side (the API's own `?has_modules=true|false|all`, see
 * `src/api/merchant.ts`) rather than filtered client-side out of an "all"
 * fetch, so each filter is its own React Query cache entry -- switching
 * filters doesn't need a local re-derivation and stays correct if the
 * dataset is ever large enough that "fetch everything, filter in JS"
 * wouldn't scale.
 */
export function MerchantProductsScreen({ navigation }: MerchantProductsScreenProps) {
  const { store, theme } = useStoreTheme();
  const [filter, setFilter] = useState<MerchantProductFilter>('all');
  const productsQuery = useMerchantProducts(store, filter);

  return (
    <View style={[styles.screen, { backgroundColor: theme.surfaceColor }]}>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const isActive = f.value === filter;
          return (
            <Pressable
              key={f.value}
              onPress={() => setFilter(f.value)}
              style={[
                styles.filterChip,
                {
                  borderRadius: theme.radius,
                  borderColor: isActive ? theme.primaryColor : `${theme.textColor}30`,
                  backgroundColor: isActive ? theme.primaryColor : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: isActive ? '#FFFFFF' : theme.textColor,
                    fontFamily: resolveFontFamily(theme.bodyFont, 'semibold'),
                  },
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {productsQuery.isLoading ? (
        <MerchantLoadingView label="Loading products…" />
      ) : productsQuery.isError || !productsQuery.data ? (
        <MerchantErrorView error={productsQuery.error} onRetry={productsQuery.refetch} />
      ) : (
        <FlatList
          data={productsQuery.data}
          keyExtractor={(item) => item.handle}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ProductRow
              product={item}
              theme={theme}
              onPress={() => navigation.navigate('MerchantProductModules', { handle: item.handle, title: item.title })}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={
            <RefreshControl refreshing={productsQuery.isRefetching} onRefresh={productsQuery.refetch} tintColor={theme.primaryColor} />
          }
          ListEmptyComponent={
            <MerchantEmptyView
              label={
                filter === 'has'
                  ? 'No products have modules attached yet.'
                  : filter === 'missing'
                    ? 'Every product already has at least one module.'
                    : `${store.label} has no products yet.`
              }
            />
          }
        />
      )}
    </View>
  );
}

function ProductRow({
  product,
  theme,
  onPress,
}: {
  product: MerchantProductListItem;
  theme: BrandTheme;
  onPress: () => void;
}) {
  const moduleCount = product.module_handles.length;
  const hasModules = moduleCount > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: `${theme.textColor}18`, borderRadius: theme.radius, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Image
        source={product.featured_image_url ? { uri: product.featured_image_url } : undefined}
        style={[styles.thumb, { borderRadius: theme.radius / 1.5, backgroundColor: `${theme.textColor}10` }]}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={product.handle}
      />
      <View style={styles.rowText}>
        <Text
          style={[styles.title, { color: theme.textColor, fontFamily: resolveFontFamily(theme.headingFont, 'semibold') }]}
          numberOfLines={2}
        >
          {product.title}
        </Text>
        <View
          style={[
            styles.badge,
            {
              borderRadius: theme.radius / 2,
              backgroundColor: hasModules ? `${theme.primaryColor}1A` : `${theme.textColor}0D`,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              {
                color: hasModules ? theme.primaryColor : `${theme.textColor}80`,
                fontFamily: resolveFontFamily(theme.bodyFont, 'semibold'),
              },
            ]}
          >
            {hasModules ? `✅ ${moduleCount} module${moduleCount === 1 ? '' : 's'}` : '— No modules'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  filterChip: {
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    padding: 10,
  },
  thumb: {
    width: 52,
    height: 52,
  },
  rowText: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
