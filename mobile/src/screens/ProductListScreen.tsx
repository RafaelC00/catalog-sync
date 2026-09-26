import React, { useCallback, useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useStoreTheme } from '../theme/ThemeContext';
import { useProducts } from '../api/products';
import { ProductCard } from '../components/ProductCard';
import { LoadingView, ErrorView, EmptyView } from '../components/StateViews';
import type { ProductListNode } from '../types/shopify';
import type { ProductListScreenProps } from '../types/navigation';

const NUM_COLUMNS = 2;

export function ProductListScreen({ navigation }: ProductListScreenProps) {
  const { store, theme } = useStoreTheme();
  const { data, isLoading, isError, error, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useProducts(store);

  const products = useMemo<ProductListNode[]>(() => data?.pages.flatMap((page) => page.nodes) ?? [], [data]);

  const handlePressProduct = useCallback(
    (product: ProductListNode) => {
      navigation.navigate('ProductDetail', { handle: product.handle, title: product.title });
    },
    [navigation]
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return <LoadingView label={`Loading ${store.label} catalog…`} />;
  }

  if (isError) {
    return (
      <ErrorView
        label={error instanceof Error ? error.message : 'Something went wrong loading products.'}
        onRetry={refetch}
      />
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.surfaceColor }]}>
      <Header
        storeLabel={store.label}
        color={theme.textColor}
        primaryColor={theme.primaryColor}
        headingFont={theme.headingFont}
        bodyFont={theme.bodyFont}
        onSwitchStore={() => navigation.navigate('StoreSwitcher')}
      />
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        renderItem={({ item }) => <ProductCard product={item} theme={theme} onPress={handlePressProduct} />}
        contentContainerStyle={styles.listContent}
        // --- Performance: windowing tuned deliberately, not left default ---
        // initialNumToRender: enough to fill ~2 screens of a 2-column grid
        // on first paint without asking Metro/JS thread to build the whole
        // page (which is small here, but this is what would matter at
        // real catalog scale).
        initialNumToRender={8}
        // maxToRenderPerBatch: caps how many rows get added per render pass
        // during scroll, keeping each batch cheap instead of one big commit.
        maxToRenderPerBatch={8}
        // windowSize: in "screens" above/below the viewport kept mounted.
        // Default (21) is generous for a grid of images this size; 7
        // trims memory (fewer expo-image instances alive) while still
        // covering fast flicks without a blank-cell flash.
        windowSize={7}
        // removeClippedSubviews: unmounts rows once they're fully outside
        // the viewport instead of just hiding them -- worth it here because
        // rows contain images (real memory), not just text.
        removeClippedSubviews
        onEndReachedThreshold={0.5}
        onEndReached={handleEndReached}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primaryColor} />
        }
        ListEmptyComponent={<EmptyView label={`${store.label} has no products yet.`} />}
        ListFooterComponent={isFetchingNextPage ? <LoadingView label="Loading more…" /> : null}
      />
    </View>
  );
}

function Header({
  storeLabel,
  color,
  primaryColor,
  headingFont,
  bodyFont,
  onSwitchStore,
}: {
  storeLabel: string;
  color: string;
  primaryColor: string;
  headingFont: string;
  bodyFont: string;
  onSwitchStore: () => void;
}) {
  return (
    <View style={styles.header}>
      <Text style={[styles.storeName, { color, fontFamily: headingFont }]}>{storeLabel}</Text>
      <Pressable onPress={onSwitchStore} style={styles.switchButton}>
        <Text style={[styles.switchText, { color: primaryColor, fontFamily: bodyFont }]}>Switch store</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  storeName: {
    fontSize: 22,
    fontWeight: '700',
  },
  switchButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  switchText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 6,
    paddingBottom: 24,
  },
});
