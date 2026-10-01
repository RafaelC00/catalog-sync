import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBrandTheme } from '../theme';
import { useProduct } from '../product';
import { shopifyFetch } from '../client';
import { DEFAULT_THEME } from '../../theme/defaultTheme';
import type { StoreConfig } from '../../types/domain';

jest.mock('../client', () => ({ shopifyFetch: jest.fn() }));

const mockFetch = shopifyFetch as jest.MockedFunction<typeof shopifyFetch>;

const store: StoreConfig = { id: 'loomwerk', label: 'Loomwerk', domain: 'example.myshopify.com', token: 'test-token' };

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => mockFetch.mockReset());

describe('useBrandTheme', () => {
  it('resolves to DEFAULT_THEME when the store has no demo_brand_theme metaobject', async () => {
    mockFetch.mockResolvedValue({ metaobjects: { nodes: [] } });

    const { result } = await renderHook(() => useBrandTheme(store), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(DEFAULT_THEME);
  });

  it('resolves to DEFAULT_THEME instead of erroring when the request fails', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    const { result } = await renderHook(() => useBrandTheme(store), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(DEFAULT_THEME);
  });

  it('returns the parsed theme when the metaobject exists', async () => {
    mockFetch.mockResolvedValue({
      metaobjects: {
        nodes: [{ id: 't', type: 'demo_brand_theme', fields: [{ key: 'primary_color', value: '#123456' }] }],
      },
    });

    const { result } = await renderHook(() => useBrandTheme(store), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.primaryColor).toBe('#123456');
  });
});

describe('useProduct', () => {
  const baseProduct = {
    id: 'p1',
    title: 'Tee',
    descriptionHtml: '',
    images: { nodes: [] },
    priceRange: { minVariantPrice: { amount: '10.0', currencyCode: 'USD' } },
    options: [],
    variants: { nodes: [] },
  };

  it('yields an empty module list when pdpModules is null', async () => {
    mockFetch.mockResolvedValue({ product: { ...baseProduct, pdpModules: null } });

    const { result } = await renderHook(() => useProduct(store, 'tee'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.modules).toEqual([]);
  });

  it('yields an empty module list when the references connection is null', async () => {
    mockFetch.mockResolvedValue({ product: { ...baseProduct, pdpModules: { references: null } } });

    const { result } = await renderHook(() => useProduct(store, 'tee'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.modules).toEqual([]);
  });

  it('parses and orders modules from the wire shape into domain modules', async () => {
    const node = (id: string, order: string) => ({
      id,
      type: 'demo_pdp_module',
      fields: [
        { key: 'module_type', value: 'care' },
        { key: 'heading', value: 'h' },
        { key: 'body', value: 'b' },
        { key: 'display_order', value: order },
      ],
    });
    mockFetch.mockResolvedValue({
      product: { ...baseProduct, pdpModules: { references: { nodes: [node('late', '2'), node('early', '1')] } } },
    });

    const { result } = await renderHook(() => useProduct(store, 'tee'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.modules.map((m) => m.id)).toEqual(['early', 'late']);
  });

  it('errors with a clear message when the product does not exist', async () => {
    mockFetch.mockResolvedValue({ product: null });

    const { result } = await renderHook(() => useProduct(store, 'missing'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Product "missing" was not found on Loomwerk.');
  });
});
