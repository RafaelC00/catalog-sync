import React, { memo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { ProductListNode } from '../types/shopify';
import type { BrandTheme } from '../types/domain';

interface ProductCardProps {
  product: ProductListNode;
  theme: BrandTheme;
  onPress: (product: ProductListNode) => void;
}

const CARD_IMAGE_HEIGHT = 200;

/**
 * Memoised: FlatList re-renders every visible row whenever the list's own
 * state changes (e.g. a pull-to-refresh spinner toggling) unless rows opt
 * out. `React.memo` + passing only primitives/stable callbacks in means a
 * row only re-renders when its own product or the active theme changes.
 */
export const ProductCard = memo(function ProductCard({ product, theme, onPress }: ProductCardProps) {
  const price = product.priceRange.minVariantPrice;

  return (
    <Pressable
      onPress={() => onPress(product)}
      style={({ pressed }) => [
        styles.card,
        cardShadow,
        { backgroundColor: theme.surfaceColor, borderRadius: theme.radius, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Image
        source={product.featuredImage ? { uri: product.featuredImage.url } : undefined}
        style={[styles.image, { borderRadius: theme.radius, backgroundColor: `${theme.textColor}10` }]}
        contentFit="cover"
        // Performance: cache to disk as well as memory. Product photography
        // doesn't change per-session, so once fetched a row should never
        // re-hit the network just because it scrolled off-screen and back.
        cachePolicy="memory-disk"
        // Lets expo-image's internal recycler match this image to the same
        // cache slot across re-renders/list re-ordering instead of treating
        // every mount as a fresh image.
        recyclingKey={product.id}
        transition={150}
      />
      <Text
        style={[styles.title, { color: theme.textColor, fontFamily: theme.headingFont }]}
        numberOfLines={2}
      >
        {product.title}
      </Text>
      <Text style={[styles.price, { color: theme.primaryColor, fontFamily: theme.bodyFont }]}>
        {price.currencyCode} {price.amount}
      </Text>
    </Pressable>
  );
});

/**
 * Platform difference #1: iOS shadows are drawn from `shadow*` props
 * (colour/offset/opacity/radius composited by the layer tree); Android's
 * renderer ignores those entirely and instead derives a Material shadow
 * from the `elevation` prop, which iOS ignores. There's no single prop
 * that produces an equivalent look on both, so this has to branch.
 */
const cardShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  android: {
    elevation: 3,
  },
  default: {},
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 6,
    padding: 10,
    minWidth: 0,
  },
  image: {
    width: '100%',
    height: CARD_IMAGE_HEIGHT,
  },
  title: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  price: {
    marginTop: 2,
    fontSize: 13,
  },
});
