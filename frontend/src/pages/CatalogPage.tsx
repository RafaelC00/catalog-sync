import { Fragment, useEffect, useState } from "react";
import { api, type Product, type ProductDetail, type Store } from "../api";
import { formatRelativeTime } from "../format";

function ExpandedVariants({ product }: { product: Product }) {
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .product(product.id)
      .then((d) => !cancelled && setDetail(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  return (
    <tr className="variant-expand-row">
      <td colSpan={6}>
        {error && <div className="banner banner-error" style={{ margin: 16 }}>{error}</div>}
        {!detail && !error && <div className="loading-row">Loading variants</div>}
        {detail && (
          <div className="variant-list">
            {detail.variants.map((v) => (
              <div className="variant-card" key={v.id}>
                <div className="variant-title">{v.title || "Default"}</div>
                <div className="variant-sku">{v.sku || "no sku"}</div>
                {v.price !== null && <div className="variant-price mono-num">${v.price}</div>}
              </div>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}

export function CatalogPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.stores().then(setStores).catch(() => setStores([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    const handle = setTimeout(() => {
      api
        .products({ store: selectedStore || undefined, search: search || undefined })
        .then((data) => {
          setProducts(data);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load products"))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(handle);
  }, [selectedStore, search]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-kicker">Catalog</div>
          <h1 className="page-title">Synced products</h1>
          <p className="page-description">
            The local mirror of every product Catalog Sync has pulled from the connected stores,
            with the timestamp of its most recent successful sync.
          </p>
        </div>
      </div>

      <div className="toolbar">
        <select
          className="select"
          value={selectedStore}
          onChange={(e) => setSelectedStore(e.target.value)}
          aria-label="Filter by store"
        >
          <option value="">All stores</option>
          {stores.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name} ({s.product_count})
            </option>
          ))}
        </select>
        <input
          className="text-input"
          type="search"
          placeholder="Search by title"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search products"
          style={{ minWidth: 220 }}
        />
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      <div className="panel table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th aria-hidden="true"></th>
              <th>Title</th>
              <th>Store</th>
              <th>Vendor</th>
              <th>Variants</th>
              <th>Last synced</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6}>
                  <div className="loading-row">
                    <span className="spinner" aria-hidden="true" />
                    Loading catalog
                  </div>
                </td>
              </tr>
            )}
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">No products match this filter.</div>
                </td>
              </tr>
            )}
            {products.map((p) => (
              <Fragment key={p.id}>
                <tr
                  className="row-link"
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                >
                  <td>
                    <button
                      className="expand-toggle"
                      aria-label={expandedId === p.id ? "Collapse variants" : "Expand variants"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(expandedId === p.id ? null : p.id);
                      }}
                    >
                      {expandedId === p.id ? "▾" : "▸"}
                    </button>
                  </td>
                  <td>
                    {p.title}
                    {p.tags.slice(0, 2).map((t) => (
                      <span className="tag-chip" key={t}>
                        {t}
                      </span>
                    ))}
                  </td>
                  <td>{p.store_slug}</td>
                  <td className="vendor-cell">{p.vendor || "not set"}</td>
                  <td className="mono-num">{p.variant_count}</td>
                  <td className="mono-num">{formatRelativeTime(p.last_synced_at)}</td>
                </tr>
                {expandedId === p.id && <ExpandedVariants product={p} />}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
