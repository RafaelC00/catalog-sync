import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStoreTheme } from '../../theme/ThemeContext';
import { resolveFontFamily } from '../../theme/fonts';
import { useMerchantModules, useUpdateMerchantModule } from '../../api/merchant';
import { MerchantLoadingView, MerchantErrorView } from '../../components/merchant/MerchantStateViews';
import { moduleTypeEmoji, moduleTypeLabel } from '../../utils/merchantModuleEmoji';
import { triggerSelectionHaptic } from '../../utils/haptics';
import type { MerchantModuleEditorScreenProps } from '../../types/navigation';
import type { MerchantModulePatch } from '../../types/merchant';
import type { BrandTheme } from '../../types/domain';

/**
 * Edits one `demo_pdp_module`'s heading/body/display_order. Reads the
 * module from the already-fetched `useMerchantModules` cache by `handle`
 * (the same "navigate with a key, read from React Query's cache" pattern
 * `ProductDetailScreen` uses for the shopper PDP) rather than the route
 * carrying the whole module object -- and it doubles as a safety net: if
 * a save on this screen changes `display_order`, the invalidated list
 * this screen reads from is also the up-to-date one Modules re-renders
 * from your Nav back.
 */
export function MerchantModuleEditorScreen({ route }: MerchantModuleEditorScreenProps) {
  const { handle } = route.params;
  const { store, theme } = useStoreTheme();
  const modulesQuery = useMerchantModules(store);
  const updateModule = useUpdateMerchantModule(store);

  const module = modulesQuery.data?.find((m) => m.handle === handle);

  const [heading, setHeading] = useState('');
  const [body, setBody] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [justSaved, setJustSaved] = useState(false);

  // Re-seed local edit state only when the module *identity* changes (or
  // first loads) -- not on every background refetch of the modules list,
  // which would otherwise stomp on whatever the merchant is mid-typing.
  useEffect(() => {
    if (!module) return;
    setHeading(module.heading);
    setBody(module.body);
    setDisplayOrder(module.display_order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module?.handle]);

  if (modulesQuery.isLoading) {
    return <MerchantLoadingView label="Loading module…" />;
  }

  if (modulesQuery.isError) {
    return <MerchantErrorView error={modulesQuery.error} onRetry={modulesQuery.refetch} />;
  }

  if (!module) {
    return <MerchantErrorView error={new Error(`Module "${handle}" was not found.`)} onRetry={modulesQuery.refetch} />;
  }

  const isDirty = heading !== module.heading || body !== module.body || displayOrder !== module.display_order;
  const canSave = isDirty && heading.trim().length > 0 && body.trim().length > 0 && !updateModule.isPending;

  const handleSave = () => {
    triggerSelectionHaptic();
    const patch: MerchantModulePatch = {};
    if (heading !== module.heading) patch.heading = heading;
    if (body !== module.body) patch.body = body;
    if (displayOrder !== module.display_order) patch.display_order = displayOrder;

    setJustSaved(false);
    updateModule.mutate(
      { handle: module.handle, patch },
      {
        onSuccess: () => setJustSaved(true),
      }
    );
  };

  const adjustDisplayOrder = (delta: number) => {
    triggerSelectionHaptic();
    setJustSaved(false);
    setDisplayOrder((value) => Math.max(0, value + delta));
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.surfaceColor }}
      // Platform difference: iOS needs the "padding" behaviour to push
      // content above the keyboard; Android already resizes the window
      // via its own soft-input mode, so adding "padding" there double-
      // compensates and shoves content up too far.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.typeRow}>
          <Text style={styles.emoji}>{module.icon || moduleTypeEmoji(module.module_type)}</Text>
          <Text
            style={[styles.typeLabel, { color: theme.primaryColor, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') }]}
          >
            {moduleTypeLabel(module.module_type).toUpperCase()} MODULE
          </Text>
        </View>

        <Field label="Heading" theme={theme}>
          <TextInput
            value={heading}
            onChangeText={(text) => {
              setJustSaved(false);
              setHeading(text);
            }}
            placeholder="Module heading"
            placeholderTextColor={`${theme.textColor}66`}
            editable={!updateModule.isPending}
            style={[
              styles.input,
              {
                color: theme.textColor,
                borderColor: `${theme.textColor}30`,
                borderRadius: theme.radius,
                fontFamily: resolveFontFamily(theme.bodyFont, 'semibold'),
              },
            ]}
          />
        </Field>

        <Field label="Body" theme={theme}>
          <TextInput
            value={body}
            onChangeText={(text) => {
              setJustSaved(false);
              setBody(text);
            }}
            placeholder="Module body copy"
            placeholderTextColor={`${theme.textColor}66`}
            editable={!updateModule.isPending}
            multiline
            numberOfLines={5}
            style={[
              styles.input,
              styles.multilineInput,
              {
                color: theme.textColor,
                borderColor: `${theme.textColor}30`,
                borderRadius: theme.radius,
                fontFamily: resolveFontFamily(theme.bodyFont, 'regular'),
              },
            ]}
          />
        </Field>

        <Field label="Display order" theme={theme}>
          <View style={styles.stepperRow}>
            <StepperButton label="−" disabled={updateModule.isPending} onPress={() => adjustDisplayOrder(-1)} theme={theme} />
            <Text
              style={[styles.stepperValue, { color: theme.textColor, fontFamily: resolveFontFamily(theme.headingFont, 'bold') }]}
            >
              {displayOrder}
            </Text>
            <StepperButton label="+" disabled={updateModule.isPending} onPress={() => adjustDisplayOrder(1)} theme={theme} />
          </View>
        </Field>

        <Text
          style={[styles.usageNote, { color: `${theme.textColor}80`, fontFamily: resolveFontFamily(theme.bodyFont, 'regular') }]}
        >
          Used on {module.used_on_product_count} {module.used_on_product_count === 1 ? 'product' : 'products'} right now.
        </Text>

        {updateModule.isError ? (
          <View style={[styles.errorBanner, { borderRadius: theme.radius }]}>
            <Text style={styles.errorBannerText}>
              {updateModule.error instanceof Error ? updateModule.error.message : 'Could not save this module.'}
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
            {updateModule.isPending ? 'Saving…' : justSaved ? 'Saved ✓' : 'Save changes'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, theme, children }: { label: string; theme: BrandTheme; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text
        style={[styles.fieldLabel, { color: `${theme.textColor}99`, fontFamily: resolveFontFamily(theme.bodyFont, 'semibold') }]}
      >
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function StepperButton({
  label,
  onPress,
  disabled,
  theme,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  theme: BrandTheme;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.stepperButton,
        {
          borderColor: `${theme.textColor}30`,
          borderRadius: theme.radius,
          opacity: pressed ? 0.7 : disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text style={[styles.stepperButtonText, { color: theme.primaryColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    gap: 18,
    paddingBottom: 40,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emoji: {
    fontSize: 18,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  stepperValue: {
    fontSize: 18,
    minWidth: 28,
    textAlign: 'center',
  },
  usageNote: {
    fontSize: 12,
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
