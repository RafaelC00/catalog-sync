import type { MetaobjectField, MetaobjectNode } from '../types/shopify';
import type { BrandTheme, PdpModule, PdpModuleType } from '../types/domain';
import { DEFAULT_THEME } from '../theme/defaultTheme';

/** Every metaobject comes back as a flat `[{key, value}]` list. This is the
 * one place that flattens it into a lookup -- everything downstream reads
 * named fields, never re-scans the array. */
export function metaobjectFieldsToRecord(fields: MetaobjectField[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const field of fields) {
    record[field.key] = field.value;
  }
  return record;
}

const VALID_MODULE_TYPES: readonly PdpModuleType[] = ['care', 'size_guide', 'bundle'];

function isPdpModuleType(value: string): value is PdpModuleType {
  return (VALID_MODULE_TYPES as readonly string[]).includes(value);
}

/**
 * Parses the `custom.pdp_modules` metaobject references into typed,
 * display-ordered modules. Anything malformed (missing module_type, an
 * unrecognized module_type, an unparsable display_order) is dropped rather
 * than crashing the PDP -- this content is provisioned by a separate
 * service, so defensive parsing here is load-bearing, not decorative.
 */
export function parsePdpModules(nodes: MetaobjectNode[]): PdpModule[] {
  const modules: PdpModule[] = [];

  for (const node of nodes) {
    const fields = metaobjectFieldsToRecord(node.fields);
    const moduleType = fields.module_type;
    const heading = fields.heading;
    const body = fields.body;
    const icon = fields.icon ?? '';
    const displayOrder = Number.parseInt(fields.display_order ?? '', 10);

    if (!moduleType || !isPdpModuleType(moduleType) || !heading || !body || Number.isNaN(displayOrder)) {
      continue;
    }

    modules.push({ id: node.id, moduleType, heading, body, displayOrder, icon });
  }

  return modules.sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Parses the `demo_brand_theme` metaobject, filling in `DEFAULT_THEME` for
 * any field that's missing, blank, or not yet provisioned. This is what
 * lets the app run before the metaobject definitions exist at all (empty
 * `nodes`) and while they're only partially filled in.
 */
export function parseBrandTheme(nodes: MetaobjectNode[]): BrandTheme {
  if (nodes.length === 0) {
    return DEFAULT_THEME;
  }

  const fields = metaobjectFieldsToRecord(nodes[0].fields);
  const radius = Number.parseInt(fields.radius ?? '', 10);

  return {
    primaryColor: fields.primary_color || DEFAULT_THEME.primaryColor,
    surfaceColor: fields.surface_color || DEFAULT_THEME.surfaceColor,
    textColor: fields.text_color || DEFAULT_THEME.textColor,
    headingFont: fields.heading_font || DEFAULT_THEME.headingFont,
    bodyFont: fields.body_font || DEFAULT_THEME.bodyFont,
    radius: Number.isNaN(radius) ? DEFAULT_THEME.radius : radius,
  };
}
