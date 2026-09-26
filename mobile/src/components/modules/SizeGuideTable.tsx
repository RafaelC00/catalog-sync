import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PdpModule, BrandTheme } from '../../types/domain';

interface TableRow {
  label: string;
  value: string;
}

/**
 * The `demo_size_guide` module only carries freeform `heading`/`body` text
 * -- there's no structured rows/columns field in the metaobject schema
 * (see mobile/README.md). Rather than inventing measurements that aren't
 * in the source data, this derives real table rows from the text: a
 * "label: value" segment (e.g. "Chest: 38in") becomes a two-column row;
 * anything else becomes a numbered guidance row. With the current sample
 * copy (no colons) every row lands in the numbered form, which is still an
 * honest, genuinely tabular rendering of what Shopify actually returned.
 */
function parseRows(body: string): TableRow[] {
  const lines = body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const segments = lines.length > 1 ? lines : body.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean);

  return segments.map((segment, index) => {
    const match = segment.match(/^([^:]{1,24}):\s*(.+)$/);
    if (match) {
      return { label: match[1], value: match[2] };
    }
    return { label: String(index + 1), value: segment };
  });
}

export function SizeGuideTable({ module, theme }: { module: PdpModule; theme: BrandTheme }) {
  const rows = parseRows(module.body);
  const borderColor = `${theme.textColor}20`;

  return (
    <View style={[styles.container, { borderColor, borderRadius: theme.radius }]}>
      <Text style={[styles.heading, { color: theme.textColor, fontFamily: theme.headingFont }]}>
        {module.heading}
      </Text>
      <View style={[styles.table, { borderColor }]}>
        {rows.map((row, index) => (
          <View
            key={index}
            style={[
              styles.row,
              { borderColor },
              index === rows.length - 1 ? styles.lastRow : null,
            ]}
          >
            <Text style={[styles.labelCell, { color: theme.primaryColor, fontFamily: theme.bodyFont }]}>
              {row.label}
            </Text>
            <Text
              style={[styles.valueCell, { color: theme.textColor, fontFamily: theme.bodyFont, borderColor }]}
            >
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    padding: 14,
  },
  heading: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  table: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
  },
  row: {
    flexDirection: 'row',
    borderRightWidth: 1,
    borderBottomWidth: 1,
  },
  lastRow: {},
  labelCell: {
    width: 34,
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 8,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  valueCell: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderLeftWidth: 1,
  },
});
