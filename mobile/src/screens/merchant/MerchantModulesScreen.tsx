import React from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useStoreTheme } from '../../theme/ThemeContext';
import { resolveFontFamily } from '../../theme/fonts';
import { useMerchantModules } from '../../api/merchant';
import { MerchantLoadingView, MerchantErrorView, MerchantEmptyView } from '../../components/merchant/MerchantStateViews';
import { moduleTypeEmoji, moduleTypeLabel } from '../../utils/merchantModuleEmoji';
import type { MerchantModulesScreenProps } from '../../types/navigation';
import type { MerchantModule } from '../../types/merchant';

/**
 * The `demo_pdp_module` catalog (care / size_guide / bundle) -- each row
 * shows exactly the fields the spec asks for: heading, body preview,
 * display order and how many products use it. Tapping opens the editor.
 */
export function MerchantModulesScreen({ navigation }: MerchantModulesScreenProps) {
  const { store, theme } = useStoreTheme();
  const modulesQuery = useMerchantModules(store);

  if (modulesQuery.isLoading) {
    return <MerchantLoadingView label="Loading modules…" />;
  }

  if (modulesQuery.isError || !modulesQuery.data) {
    return <MerchantErrorView error={modulesQuery.error} onRetry={modulesQuery.refetch} />;
  }

  const modules = [...modulesQuery.data].sort((a, b) => a.display_order - b.display_order);

  return (
    <FlatList
      style={{ backgroundColor: theme.surfaceColor }}
      contentContainerStyle={styles.content}
      data={modules}
      keyExtractor={(item) => item.handle}
      renderItem={({ item }) => (
        <ModuleRow module={item} onPress={() => navigation.navigate('MerchantModuleEditor', { handle: item.handle })} />
      )}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      refreshControl={
        <RefreshControl refreshing={modulesQuery.isRefetching} onRefresh={modulesQuery.refetch} tintColor={theme.primaryColor} />
      }
      ListEmptyComponent={<MerchantEmptyView label="No PDP modules are defined for this store yet." />}
    />
  );
}

function ModuleRow({ module, onPress }: { module: MerchantModule; onPress: () => void }) {
  const { theme } = useStoreTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: `${theme.textColor}18`, borderRadius: theme.radius, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <View style={styles.rowTop}>
        <Text style={styles.emoji}>{module.icon || moduleTypeEmoji(module.module_type)}</Text>
        <View style={styles.rowTitleBlock}>
          <Text
            style={[styles.typeLabel, { color: theme.primaryColor, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') }]}
          >
            {moduleTypeLabel(module.module_type).toUpperCase()} · #{module.display_order}
          </Text>
          <Text
            style={[styles.heading, { color: theme.textColor, fontFamily: resolveFontFamily(theme.headingFont, 'semibold') }]}
            numberOfLines={1}
          >
            {module.heading}
          </Text>
        </View>
      </View>

      <Text
        style={[styles.body, { color: `${theme.textColor}99`, fontFamily: resolveFontFamily(theme.bodyFont, 'regular') }]}
        numberOfLines={2}
      >
        {module.body}
      </Text>

      <View style={[styles.usageBadge, { backgroundColor: `${theme.textColor}0D`, borderRadius: theme.radius / 2 }]}>
        <Text
          style={[styles.usageText, { color: theme.textColor, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') }]}
        >
          Used on {module.used_on_product_count} {module.used_on_product_count === 1 ? 'product' : 'products'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
  row: {
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  emoji: {
    fontSize: 20,
  },
  rowTitleBlock: {
    flex: 1,
    gap: 2,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  heading: {
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  usageBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  usageText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
