import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStoreTheme } from '../theme/ThemeContext';
import { useProduct } from '../api/product';
import { ImageGallery } from '../components/ImageGallery';
import { ModuleList } from '../components/modules/ModuleList';
import { ColorSwatches } from '../components/pdp/ColorSwatches';
import { SizeChips } from '../components/pdp/SizeChips';
import { ProductDescription } from '../components/pdp/ProductDescription';
import { LoadingView, ErrorView } from '../components/StateViews';
import { resolveFontFamily } from '../theme/fonts';
import type { ProductDetailScreenProps } from '../types/navigation';
import { formatPrice } from '../utils/formatPrice';
import {
  defaultOptionValue,
  findColorOption,
  findMatchingVariant,
  findSizeOption,
  isCombinationAvailable,
  orderedSizeValues,
} from '../utils/productOptions';
import type { ProductVariant } from '../types/shopify';

export function ProductDetailScreen({ route }: ProductDetailScreenProps) {
  const { handle } = route.params;
  const { store, theme } = useStoreTheme();
  const { data, isLoading, isError, error, refetch } = useProduct(store, handle);
  const product = data?.product;

  // Detected by option *name*, not position -- verified live, the two
  // stores don't agree on naming (Loomwerk: "Size"/"Color"; Nómada's "Sin
  // Drama" tee: "Talla"/"Color"/"Estilo"). Either can legitimately be
  // undefined (Nómada's tote bags carry no size option at all).
  const colorOption = useMemo(() => (product ? findColorOption(product.options) : undefined), [product]);
  const sizeOption = useMemo(() => (product ? findSizeOption(product.options) : undefined), [product]);

  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);
  const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined);

  // Re-derive defaults whenever the product itself changes (a genuinely
  // new product, e.g. navigating PDP -> PDP), not on every background
  // refetch of the same product -- keyed on `id`, not the `product`
  // object reference, so an in-place refetch never resets what the
  // shopper already picked.
  useEffect(() => {
    if (!product) return;
    const variants = product.variants.nodes;
    const nextColor = colorOption ? defaultOptionValue(colorOption, variants) : undefined;
    setSelectedColor(nextColor);

    if (sizeOption) {
      const colorConstraint = colorOption && nextColor ? [{ name: colorOption.name, value: nextColor }] : [];
      const nextSize = orderedSizeValues(sizeOption).find((value) =>
        isCombinationAvailable(variants, [...colorConstraint, { name: sizeOption.name, value }])
      );
      setSelectedSize(nextSize ?? sizeOption.values[0]);
    } else {
      setSelectedSize(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const isSizeAvailable = (variants: ProductVariant[], value: string): boolean => {
    if (!sizeOption) return false;
    const constraints = [{ name: sizeOption.name, value }];
    if (colorOption && selectedColor) constraints.push({ name: colorOption.name, value: selectedColor });
    return isCombinationAvailable(variants, constraints);
  };

  // If switching colour makes the currently selected size unavailable,
  // fall forward to the nearest size that *is* available for the new
  // colour rather than leaving a disabled chip silently selected.
  useEffect(() => {
    if (!product || !sizeOption || !selectedSize) return;
    if (isSizeAvailable(product.variants.nodes, selectedSize)) return;
    const fallback = orderedSizeValues(sizeOption).find((value) => isSizeAvailable(product.variants.nodes, value));
    setSelectedSize(fallback ?? sizeOption.values[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColor]);

  if (isLoading) {
    return <LoadingView label="Loading product…" />;
  }

  if (isError || !data || !product) {
    return (
      <ErrorView
        label={error instanceof Error ? error.message : 'Could not load this product.'}
        onRetry={refetch}
      />
    );
  }

  const { modules } = data;
  const price = product.priceRange.minVariantPrice;
  const variants = product.variants.nodes;

  const constraints = [
    ...(colorOption && selectedColor ? [{ name: colorOption.name, value: selectedColor }] : []),
    ...(sizeOption && selectedSize ? [{ name: sizeOption.name, value: selectedSize }] : []),
  ];
  const matchedVariant = findMatchingVariant(variants, constraints);
  const availableForSale = matchedVariant ? matchedVariant.availableForSale : variants.some((v) => v.availableForSale);

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
          {formatPrice(price)}
        </Text>

        <VariantSummary availableForSale={availableForSale} textColor={theme.textColor} bodyFont={theme.bodyFont} />

        {colorOption && selectedColor ? (
          <View style={styles.selectorBlock}>
            <ColorSwatches option={colorOption} selected={selectedColor} onSelect={setSelectedColor} theme={theme} />
          </View>
        ) : null}

        {sizeOption && selectedSize ? (
          <View style={styles.selectorBlock}>
            <SizeChips
              option={sizeOption}
              selected={selectedSize}
              onSelect={setSelectedSize}
              isAvailable={(value) => isSizeAvailable(variants, value)}
              theme={theme}
            />
          </View>
        ) : null}

        <View style={styles.description}>
          <ProductDescription descriptionHtml={product.descriptionHtml} theme={theme} />
        </View>

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
  availability: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 4,
  },
  selectorBlock: {
    marginTop: 14,
  },
  description: {
    marginTop: 22,
  },
  modules: {
    marginTop: 22,
  },
});
