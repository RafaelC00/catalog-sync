import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { resolveFontFamily } from '../../theme/fonts';
import type { PdpModule, BrandTheme } from '../../types/domain';
import type { Money } from '../../types/shopify';
import { formatAmount } from '../../utils/formatPrice';

interface BundleOfferProps {
  module: PdpModule;
  theme: BrandTheme;
  price: Money;
}

/**
 * `bundle` module. "Conditional pricing" here means exactly that: pricing
 * math only appears when the source `body` copy actually names a discount
 * percentage (e.g. "save 15%"). We never invent a bundle price the
 * merchandising copy didn't state -- if no percentage is present, this
 * renders as a descriptive callout with no numbers at all.
 */
export function BundleOffer({ module, theme, price }: BundleOfferProps) {
  const discountMatch = module.body.match(/(\d{1,2})\s*%/);
  const discountPercent = discountMatch ? Number.parseInt(discountMatch[1], 10) : null;
  const amount = Number.parseFloat(price.amount);
  const hasComputablePrice = discountPercent !== null && !Number.isNaN(amount);
  const bundlePrice = hasComputablePrice ? amount * (1 - discountPercent! / 100) : null;

  return (
    <View style={[styles.container, { backgroundColor: `${theme.primaryColor}0F`, borderRadius: theme.radius }]}>
      <Text
        style={[
          styles.heading,
          { color: theme.textColor, fontFamily: resolveFontFamily(theme.headingFont, 'semibold') },
        ]}
      >
        {module.heading}
      </Text>
      <Text style={[styles.body, { color: theme.textColor, fontFamily: resolveFontFamily(theme.bodyFont, 'regular') }]}>
        {module.body}
      </Text>

      {bundlePrice !== null ? (
        <View style={styles.priceRow}>
          <Text
            style={[
              styles.strikePrice,
              { color: `${theme.textColor}80`, fontFamily: resolveFontFamily(theme.bodyFont, 'regular') },
            ]}
          >
            {formatAmount(amount, price.currencyCode)}
          </Text>
          <Text
            style={[
              styles.bundlePrice,
              { color: theme.primaryColor, fontFamily: resolveFontFamily(theme.headingFont, 'bold') },
            ]}
          >
            {formatAmount(bundlePrice, price.currencyCode)}
          </Text>
          <View style={[styles.badge, { backgroundColor: theme.primaryColor, borderRadius: theme.radius / 2 }]}>
            {/* This text was previously left on default styles entirely --
                no theme font at all -- while every other label in this
                module was. Fixed to match: bold body-font, same as the
                weight the style already declared. */}
            <Text style={[styles.badgeText, { fontFamily: resolveFontFamily(theme.bodyFont, 'bold') }]}>
              Save {discountPercent}%
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
  },
  heading: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  strikePrice: {
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  bundlePrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 'auto',
  },
  // Sits on a solid theme.primaryColor chip; white reliably contrasts
  // against either brand's primary colour, whereas deriving it from the
  // theme (e.g. textColor) could land a dark label on a dark chip.
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
