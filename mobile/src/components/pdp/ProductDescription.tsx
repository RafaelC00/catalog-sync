import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BrandTheme } from '../../types/domain';
import { parseDescription } from '../../utils/parseDescription';
import { resolveFontFamily } from '../../theme/fonts';
import { SpecGrid } from './SpecGrid';
import { CollapsibleSection } from './CollapsibleSection';

/**
 * Replaces the naive `stripHtml(descriptionHtml)` wall of orphaned lines
 * with the actual structure Shopify sends: real prose paragraphs, an
 * always-visible spec grid, and collapsible `<h3>` sections for the
 * longer reference material (Specifications, Wholesale terms). Parsing
 * happens here (not in the screen) so `descriptionHtml` never leaves this
 * component as anything other than typed data.
 */
export function ProductDescription({ descriptionHtml, theme }: { descriptionHtml: string; theme: BrandTheme }) {
  const parsed = useMemo(() => parseDescription(descriptionHtml), [descriptionHtml]);

  if (parsed.paragraphs.length === 0 && parsed.specPairs.length === 0 && parsed.sections.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {parsed.paragraphs.length > 0 ? (
        <View style={styles.prose}>
          {parsed.paragraphs.map((paragraph, index) => (
            <Text
              key={index}
              style={[
                styles.paragraph,
                { color: theme.textColor, fontFamily: resolveFontFamily(theme.bodyFont, 'regular') },
              ]}
            >
              {paragraph}
            </Text>
          ))}
        </View>
      ) : null}

      <SpecGrid pairs={parsed.specPairs} theme={theme} />

      {parsed.sections.map((section) => (
        <CollapsibleSection key={section.title} title={section.title} theme={theme}>
          <SpecGrid pairs={section.pairs} theme={theme} />
        </CollapsibleSection>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
  },
  prose: {
    gap: 12,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
  },
});
