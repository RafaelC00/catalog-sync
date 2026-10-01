import { metaobjectFieldsToRecord, parseBrandTheme, parsePdpModules } from '../metaobjects';
import { DEFAULT_THEME } from '../../theme/defaultTheme';
import type { MetaobjectNode } from '../../types/shopify';

function moduleNode(id: string, fields: Record<string, string>): MetaobjectNode {
  return {
    id,
    type: 'demo_pdp_module',
    fields: Object.entries(fields).map(([key, value]) => ({ key, value })),
  };
}

const valid = (id: string, order: string, type = 'care') =>
  moduleNode(id, { module_type: type, heading: `Heading ${id}`, body: `Body ${id}`, display_order: order });

describe('metaobjectFieldsToRecord', () => {
  it('flattens a key/value list into a lookup', () => {
    expect(
      metaobjectFieldsToRecord([
        { key: 'a', value: '1' },
        { key: 'b', value: '2' },
      ])
    ).toEqual({ a: '1', b: '2' });
  });

  it('returns an empty record for an empty field list', () => {
    expect(metaobjectFieldsToRecord([])).toEqual({});
  });

  it('keeps the last value when a key is repeated', () => {
    expect(
      metaobjectFieldsToRecord([
        { key: 'a', value: 'first' },
        { key: 'a', value: 'last' },
      ])
    ).toEqual({ a: 'last' });
  });
});

describe('parsePdpModules', () => {
  it('returns typed modules with every field mapped', () => {
    const [mod] = parsePdpModules([
      moduleNode('gid://1', {
        module_type: 'bundle',
        heading: 'Bundle up',
        body: 'Save 15%',
        display_order: '3',
        icon: '📦',
      }),
    ]);

    expect(mod).toEqual({
      id: 'gid://1',
      moduleType: 'bundle',
      heading: 'Bundle up',
      body: 'Save 15%',
      displayOrder: 3,
      icon: '📦',
    });
  });

  it('defaults icon to an empty string when the field is absent', () => {
    const [mod] = parsePdpModules([valid('a', '1')]);
    expect(mod.icon).toBe('');
  });

  it('sorts modules ascending by display_order regardless of input order', () => {
    const result = parsePdpModules([valid('c', '30', 'bundle'), valid('a', '10', 'care'), valid('b', '20', 'size_guide')]);
    expect(result.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts display_order numerically, not lexically', () => {
    const result = parsePdpModules([valid('ten', '10'), valid('two', '2'), valid('nine', '9')]);
    expect(result.map((m) => m.id)).toEqual(['two', 'nine', 'ten']);
  });

  it('keeps input order for modules sharing the same display_order', () => {
    const result = parsePdpModules([valid('first', '1'), valid('second', '1'), valid('third', '1')]);
    expect(result.map((m) => m.id)).toEqual(['first', 'second', 'third']);
  });

  it('accepts all three known module types', () => {
    const result = parsePdpModules([valid('a', '1', 'care'), valid('b', '2', 'size_guide'), valid('c', '3', 'bundle')]);
    expect(result.map((m) => m.moduleType)).toEqual(['care', 'size_guide', 'bundle']);
  });

  it('drops a module with a missing module_type', () => {
    const noType = moduleNode('x', { heading: 'h', body: 'b', display_order: '1' });
    expect(parsePdpModules([noType, valid('ok', '2')]).map((m) => m.id)).toEqual(['ok']);
  });

  it('drops a module with an empty module_type', () => {
    const empty = moduleNode('x', { module_type: '', heading: 'h', body: 'b', display_order: '1' });
    expect(parsePdpModules([empty])).toEqual([]);
  });

  it('drops a module with an unrecognised module_type', () => {
    expect(parsePdpModules([valid('x', '1', 'testimonial'), valid('ok', '2', 'care')]).map((m) => m.id)).toEqual(['ok']);
  });

  it('treats module_type as case-sensitive', () => {
    expect(parsePdpModules([valid('x', '1', 'Care')])).toEqual([]);
  });

  it('drops a module with an unparsable display_order', () => {
    expect(parsePdpModules([valid('x', 'first'), valid('y', ''), valid('ok', '4')]).map((m) => m.id)).toEqual(['ok']);
  });

  it('drops a module with no display_order field at all', () => {
    const missing = moduleNode('x', { module_type: 'care', heading: 'h', body: 'b' });
    expect(parsePdpModules([missing])).toEqual([]);
  });

  it('drops a module with a missing or empty heading or body', () => {
    const noHeading = moduleNode('a', { module_type: 'care', body: 'b', display_order: '1' });
    const emptyBody = moduleNode('b', { module_type: 'care', heading: 'h', body: '', display_order: '1' });
    expect(parsePdpModules([noHeading, emptyBody])).toEqual([]);
  });

  it('drops a node with no fields without throwing', () => {
    expect(parsePdpModules([{ id: 'x', type: 'demo_pdp_module', fields: [] }])).toEqual([]);
  });

  it('returns an empty list for an empty node list', () => {
    expect(parsePdpModules([])).toEqual([]);
  });

  it('keeps good modules when bad ones are interleaved', () => {
    const result = parsePdpModules([
      valid('b', '2'),
      moduleNode('bad1', { heading: 'h' }),
      valid('a', '1'),
      valid('bad2', 'nope'),
    ]);
    expect(result.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('does not mutate the input array', () => {
    const input = [valid('b', '2'), valid('a', '1')];
    parsePdpModules(input);
    expect(input.map((n) => n.id)).toEqual(['b', 'a']);
  });

  // The parser is typed for an array. Null-safety lives in the caller
  // (api/product.ts), which collapses a null connection to [] first; the
  // useProduct tests in hooks.test.tsx cover that path end to end.
  it('returns an empty list for the empty array a null connection collapses to', () => {
    const connection = null as { references: { nodes: MetaobjectNode[] } | null } | null;
    expect(parsePdpModules(connection?.references?.nodes ?? [])).toEqual([]);
  });
});

describe('parseBrandTheme', () => {
  const themeNode = (fields: Record<string, string>): MetaobjectNode => ({
    id: 'gid://theme',
    type: 'demo_brand_theme',
    fields: Object.entries(fields).map(([key, value]) => ({ key, value })),
  });

  it('falls back to DEFAULT_THEME when the store has no demo_brand_theme metaobject', () => {
    expect(parseBrandTheme([])).toBe(DEFAULT_THEME);
  });

  it('maps a fully provisioned metaobject onto the BrandTheme shape', () => {
    expect(
      parseBrandTheme([
        themeNode({
          primary_color: '#1F2A24',
          surface_color: '#F6F3EC',
          text_color: '#222222',
          heading_font: 'Cormorant',
          body_font: 'Montserrat',
          radius: '8',
        }),
      ])
    ).toEqual({
      primaryColor: '#1F2A24',
      surfaceColor: '#F6F3EC',
      textColor: '#222222',
      headingFont: 'Cormorant',
      bodyFont: 'Montserrat',
      radius: 8,
    });
  });

  it('fills missing fields from DEFAULT_THEME on a partially provisioned metaobject', () => {
    const theme = parseBrandTheme([themeNode({ primary_color: '#FF0000' })]);
    expect(theme).toEqual({ ...DEFAULT_THEME, primaryColor: '#FF0000' });
  });

  it('treats blank string fields as missing', () => {
    const theme = parseBrandTheme([themeNode({ primary_color: '', heading_font: '', radius: '' })]);
    expect(theme.primaryColor).toBe(DEFAULT_THEME.primaryColor);
    expect(theme.headingFont).toBe(DEFAULT_THEME.headingFont);
    expect(theme.radius).toBe(DEFAULT_THEME.radius);
  });

  it('falls back to the default radius when it is not a number', () => {
    expect(parseBrandTheme([themeNode({ radius: 'round' })]).radius).toBe(DEFAULT_THEME.radius);
  });

  it('accepts a radius of 0', () => {
    expect(parseBrandTheme([themeNode({ radius: '0' })]).radius).toBe(0);
  });

  it('uses only the first metaobject when several are returned', () => {
    const theme = parseBrandTheme([themeNode({ primary_color: '#111111' }), themeNode({ primary_color: '#222222' })]);
    expect(theme.primaryColor).toBe('#111111');
  });
});
