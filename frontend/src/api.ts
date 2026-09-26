// Thin fetch wrapper against the Django Ninja API. Relative /api by
// default so the same build works whether the frontend is served from
// the same origin as the backend (the deployed shape) or proxied in
// dev (see vite.config.ts).

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export type SyncStatus = "running" | "success" | "failed";
export type SyncTrigger = "cli" | "api" | "webhook";
export type EventLevel = "info" | "warning" | "error";

export interface Store {
  id: number;
  slug: string;
  name: string;
  domain: string;
  is_active: boolean;
  product_count: number;
}

export interface Variant {
  id: number;
  title: string;
  sku: string;
  price: string | null;
  inventory_quantity: number | null;
  last_synced_at: string;
}

export interface Product {
  id: number;
  store_slug: string;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  status: string;
  tags: string[];
  variant_count: number;
  last_synced_at: string;
}

export interface ProductDetail extends Product {
  variants: Variant[];
}

export interface SyncEvent {
  id: number;
  timestamp: string;
  level: EventLevel;
  event_type: string;
  message: string;
  data: Record<string, unknown>;
}

export interface SyncRun {
  id: number;
  store_slug: string;
  trigger: SyncTrigger;
  status: SyncStatus;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  products_created: number;
  products_updated: number;
  products_unchanged: number;
  variants_created: number;
  variants_updated: number;
  variants_unchanged: number;
  rate_limit_backoffs: number;
  api_requests: number;
  error_message: string;
}

export interface SyncRunDetail extends SyncRun {
  events: SyncEvent[];
}

export interface HealthDependency {
  name: string;
  ok: boolean;
  detail: string;
}

export interface Health {
  status: "ok" | "degraded" | "down";
  checked_at: string;
  dependencies: HealthDependency[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // response wasn't JSON, keep statusText
    }
    throw new Error(`${res.status} ${detail}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<Health>("/healthz"),
  stores: () => request<Store[]>("/stores"),
  products: (params: { store?: string; search?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.store) qs.set("store", params.store);
    if (params.search) qs.set("search", params.search);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<Product[]>(`/products${suffix}`);
  },
  product: (id: number) => request<ProductDetail>(`/products/${id}`),
  syncRuns: (store?: string) => {
    const suffix = store ? `?store=${encodeURIComponent(store)}` : "";
    return request<SyncRun[]>(`/sync-runs${suffix}`);
  },
  syncRun: (id: number) => request<SyncRunDetail>(`/sync-runs/${id}`),
  triggerSync: (storeSlug: string) =>
    request<SyncRun>("/sync-runs", {
      method: "POST",
      body: JSON.stringify({ store_slug: storeSlug }),
    }),
};
