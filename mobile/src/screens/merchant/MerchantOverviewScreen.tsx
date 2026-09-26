import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStoreTheme } from '../../theme/ThemeContext';
import { resolveFontFamily } from '../../theme/fonts';
import { useMerchantOverview } from '../../api/merchant';
import { MerchantLoadingView, MerchantErrorView } from '../../components/merchant/MerchantStateViews';
import { PersonaSwitchButton } from '../../components/PersonaSwitchButton';
import type { MerchantOverviewScreenProps } from '../../types/navigation';
import type { BrandTheme } from '../../types/domain';

/**
 * The merchant persona's home screen -- the "control panel for a brand"
 * the brief asks for. Renders the store's `demo_brand_theme` as data (not
 * as the screen's own chrome, which still comes from `useStoreTheme()` so
 * this reads correctly on both brands regardless of what the API returns)
 * plus module-coverage stats, and links into Modules / Products.
 */
export function MerchantOverviewScreen({ navigation }: MerchantOverviewScreenProps) {
  const { store, theme } = useStoreTheme();
  const overviewQuery = useMerchantOverview(store);

  // The header (and with it, `PersonaSwitchButton`) renders unconditionally,
  // *before* branching on loading/error/data -- this screen has
  // `headerShown: false` (see RootNavigator), so it's the only route in the
  // merchant stack that doesn't get the switch "for free" via the
  // navigator's `headerRight`. An early return here for the error/loading
  // states (the way the shopper equivalent does it) would leave a merchant
  // stuck on this persona with literally no way back while the backend is
  // down -- exactly the case the brief calls out as a real, expected state.
  const headerLabel = overviewQuery.data?.store.name ?? store.label;

  return (
    <View style={[styles.screen, { backgroundColor: theme.surfaceColor }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text
            style={[styles.eyebrow, { color: `${theme.textColor}80`, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') }]}
          >
            MERCHANT
          </Text>
          {/* Store names come from Shopify and can be long ("Loomwerk Apparel
              Wholesale"). Without truncation the title pushes the persona
              switch off the right edge of a phone screen, clipping the one
              control that gets you back to the shopper view. */}
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.storeName, { color: theme.textColor, fontFamily: resolveFontFamily(theme.headingFont, 'bold') }]}
          >
            {headerLabel}
          </Text>
        </View>
        <PersonaSwitchButton />
      </View>

      {overviewQuery.isLoading ? (
        <MerchantLoadingView label={`Loading ${store.label} control panel…`} />
      ) : overviewQuery.isError || !overviewQuery.data ? (
        <MerchantErrorView error={overviewQuery.error} onRetry={overviewQuery.refetch} />
      ) : (
        <OverviewBody
          overview={overviewQuery.data}
          theme={theme}
          isRefetching={overviewQuery.isRefetching}
          onRefresh={overviewQuery.refetch}
          onOpenModules={() => navigation.navigate('MerchantModules')}
          onOpenProducts={() => navigation.navigate('MerchantProducts')}
        />
      )}
    </View>
  );
}

function OverviewBody({
  overview,
  theme,
  isRefetching,
  onRefresh,
  onOpenModules,
  onOpenProducts,
}: {
  overview: import('../../types/merchant').MerchantOverview;
  theme: BrandTheme;
  isRefetching: boolean;
  onRefresh: () => void;
  onOpenModules: () => void;
  onOpenProducts: () => void;
}) {
  const withoutModules = Math.max(overview.product_count - overview.products_with_modules, 0);
  const coverageRatio = overview.product_count > 0 ? overview.products_with_modules / overview.product_count : 0;

  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.primaryColor} />}
    >
      <Section title="Brand identity" theme={theme}>
        <View style={styles.swatchRow}>
          <ColorSwatch label="Primary" hex={overview.theme.primary_color} theme={theme} />
          <ColorSwatch label="Surface" hex={overview.theme.surface_color} theme={theme} />
          <ColorSwatch label="Text" hex={overview.theme.text_color} theme={theme} />
        </View>

        <View style={styles.fontRow}>
          <FontSample role="Heading" fontName={overview.theme.heading_font} weight="bold" theme={theme} />
          <FontSample role="Body" fontName={overview.theme.body_font} weight="semibold" theme={theme} />
        </View>

        <View style={styles.radiusRow}>
          <View
            style={[
              styles.radiusPreview,
              { borderRadius: overview.theme.radius, borderColor: theme.primaryColor, backgroundColor: `${theme.primaryColor}14` },
            ]}
          />
          <Text
            style={[styles.radiusLabel, { color: theme.textColor, fontFamily: resolveFontFamily(theme.bodyFont, 'regular') }]}
          >
            Corner radius · {overview.theme.radius}px
          </Text>
        </View>
      </Section>

      <Section title="Module coverage" theme={theme}>
        <View style={styles.coverageBarTrack}>
          <View
            style={[
              styles.coverageBarFill,
              { width: `${Math.round(coverageRatio * 100)}%`, backgroundColor: theme.primaryColor },
            ]}
          />
        </View>
        <Text
          style={[styles.coverageCaption, { color: `${theme.textColor}99`, fontFamily: resolveFontFamily(theme.bodyFont, 'regular') }]}
        >
          {Math.round(coverageRatio * 100)}% of products have at least one PDP module
        </Text>

        <View style={styles.statRow}>
          <StatTile emoji="🧩" value={overview.product_count} label="Products" theme={theme} />
          <StatTile emoji="✅" value={overview.products_with_modules} label="With modules" theme={theme} />
          <StatTile emoji="—" value={withoutModules} label="Missing" theme={theme} />
          <StatTile emoji="🗂️" value={overview.module_count} label="Modules defined" theme={theme} />
        </View>
      </Section>

      <View style={styles.navCards}>
        <NavCard
          emoji="🗂️"
          title="Modules"
          subtitle="Edit care, size guide & bundle copy"
          theme={theme}
          onPress={onOpenModules}
        />
        <NavCard
          emoji="🧩"
          title="Products"
          subtitle="Attach or detach modules per product"
          theme={theme}
          onPress={onOpenProducts}
        />
      </View>
    </ScrollView>
  );
}

function Section({ title, theme, children }: { title: string; theme: BrandTheme; children: React.ReactNode }) {
  return (
    <View style={[styles.section, { borderColor: `${theme.textColor}18`, borderRadius: theme.radius }]}>
      <Text
        style={[styles.sectionTitle, { color: `${theme.textColor}99`, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') }]}
      >
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function ColorSwatch({ label, hex, theme }: { label: string; hex: string; theme: BrandTheme }) {
  return (
    <View style={styles.swatchItem}>
      <View style={[styles.swatchBox, { backgroundColor: hex, borderColor: `${theme.textColor}20` }]} />
      <Text
        style={[styles.swatchLabel, { color: theme.textColor, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') }]}
      >
        {label}
      </Text>
      <Text
        style={[styles.swatchHex, { color: `${theme.textColor}80`, fontFamily: resolveFontFamily(theme.bodyFont, 'regular') }]}
      >
        {hex.toUpperCase()}
      </Text>
    </View>
  );
}

function FontSample({
  role,
  fontName,
  weight,
  theme,
}: {
  role: string;
  fontName: string;
  weight: 'semibold' | 'bold';
  theme: BrandTheme;
}) {
  return (
    <View style={styles.fontSample}>
      <Text
        style={[styles.fontRole, { color: `${theme.textColor}80`, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') }]}
      >
        {role.toUpperCase()}
      </Text>
      {/* The font name rendered SET IN that font, per the brief -- if the
          name isn't in `FONT_REGISTRY` (an unbundled family), this simply
          falls back to the system font, same rule as everywhere else. */}
      <Text style={[styles.fontName, { color: theme.textColor, fontFamily: resolveFontFamily(fontName, weight) }]}>
        {fontName}
      </Text>
    </View>
  );
}

function StatTile({ emoji, value, label, theme }: { emoji: string; value: number; label: string; theme: BrandTheme }) {
  return (
    <View style={[styles.statTile, { backgroundColor: `${theme.textColor}0D`, borderRadius: theme.radius }]}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text
        style={[styles.statValue, { color: theme.textColor, fontFamily: resolveFontFamily(theme.headingFont, 'bold') }]}
      >
        {value}
      </Text>
      <Text
        style={[styles.statLabel, { color: `${theme.textColor}99`, fontFamily: resolveFontFamily(theme.bodyFont, 'regular') }]}
      >
        {label}
      </Text>
    </View>
  );
}

function NavCard({
  emoji,
  title,
  subtitle,
  theme,
  onPress,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  theme: BrandTheme;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.navCard,
        {
          borderColor: theme.primaryColor,
          borderRadius: theme.radius,
          backgroundColor: `${theme.primaryColor}0F`,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={styles.navCardEmoji}>{emoji}</Text>
      <View style={styles.navCardText}>
        <Text style={[styles.navCardTitle, { color: theme.textColor, fontFamily: resolveFontFamily(theme.headingFont, 'semibold') }]}>
          {title}
        </Text>
        <Text style={[styles.navCardSubtitle, { color: `${theme.textColor}99`, fontFamily: resolveFontFamily(theme.bodyFont, 'regular') }]}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
  },
  headerText: {
    gap: 2,
    // flex + minWidth:0 lets the title shrink instead of pushing the persona
    // switch past the edge. Without minWidth a flex row refuses to shrink a
    // child below its content width, which is the usual cause of a control
    // being clipped off-screen rather than the layout wrapping.
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  storeName: {
    fontSize: 24,
    fontWeight: '700',
  },
  section: {
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 16,
  },
  swatchItem: {
    alignItems: 'center',
    gap: 4,
  },
  swatchBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
  },
  swatchLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  swatchHex: {
    fontSize: 10,
  },
  fontRow: {
    flexDirection: 'row',
    gap: 24,
  },
  fontSample: {
    gap: 2,
  },
  fontRole: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  fontName: {
    fontSize: 20,
  },
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radiusPreview: {
    width: 40,
    height: 40,
    borderWidth: 1.5,
  },
  radiusLabel: {
    fontSize: 13,
  },
  coverageBarTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  coverageBarFill: {
    height: 10,
    borderRadius: 5,
  },
  coverageCaption: {
    fontSize: 12,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statTile: {
    flexGrow: 1,
    minWidth: '22%',
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statEmoji: {
    fontSize: 16,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  navCards: {
    gap: 10,
  },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    padding: 16,
  },
  navCardText: {
    flex: 1,
    gap: 2,
  },
  navCardEmoji: {
    fontSize: 22,
  },
  navCardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  navCardSubtitle: {
    fontSize: 13,
  },
});
