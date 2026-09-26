import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStoreTheme } from '../theme/ThemeContext';
import { useProduct } from '../api/product';
import { ImageGallery } from '../components/ImageGallery';
import { ModuleList } from '../components/modules/ModuleList';
import { LoadingView, ErrorView } from '../components/StateViews';
import { stripHtml } from '../utils/stripHtml';
import { resolveFontFamily } from '../theme/fonts';
import type { ProductDetailScreenProps } from '../types/navigation';

export function ProductDetailScreen({ route }: ProductDetailScreenProps) {
  const { handle } = route.params;
  const { store, theme } = useStoreTheme();
  const { data, isLoading, isError, error, refetch } = useProduct(store, handle);

  if (isLoading) {
    return <LoadingView label="Loading product…" />;
  }

  if (isError || !data) {
    return (
      <ErrorView
        label={error instanceof Error ? error.message : 'Could not load this product.'}
        onRetry={refetch}
      />
    );
  }

  const { product, modules } = data;
  const price = product.priceRange.minVariantPrice;
  const description = stripHtml(product.descriptionHtml);

  return (
    <ScrollView
      style={{ backgroundColor: theme.surfaceColor }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <ImageGallery images={product.images.nodes} theme={theme} />

      <View style={styles.body}>
        <Text
          style={[styles.title, { color: theme.textColor, fontFamily: resolveFontFamily(theme.headingFont, 'bold') }]}
        >
          {product.title}
        </Text>
        <Text
          style={[
            styles.price,
            { color: theme.primaryColor, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') },
          ]}
        >
          {price.currencyCode} {price.amount}
        </Text>

        {description ? (
          <Text
            style={[
              styles.description,
              { color: theme.textColor, fontFamily: resolveFontFamily(theme.bodyFont, 'regular') },
            ]}
          >
            {description}
          </Text>
        ) : null}

        <VariantSummary
          availableForSale={product.variants.nodes.some((v) => v.availableForSale)}
          textColor={theme.textColor}
          bodyFont={theme.bodyFont}
        />

        <View style={styles.modules}>
          <ModuleList modules={modules} theme={theme} price={price} />
        </View>
      </View>
    </ScrollView>
  );
}

function VariantSummary({
  availableForSale,
  textColor,
  bodyFont,
}: {
  availableForSale: boolean;
  textColor: string;
  bodyFont: string;
}) {
  return (
    <Text
      style={[
        styles.availability,
        { color: `${textColor}99`, fontFamily: resolveFontFamily(bodyFont, 'regular') },
      ]}
    >
      {availableForSale ? 'In stock' : 'Currently unavailable'}
    </Text>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 40,
  },
  body: {
    padding: 18,
    gap: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  availability: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 12,
  },
  modules: {
    marginTop: 8,
  },
});
