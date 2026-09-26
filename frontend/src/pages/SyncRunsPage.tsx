import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Store, type SyncRun } from "../api";
import { StatusPill } from "../components/StatusPill";
import { RunSyncButton } from "../components/RunSyncButton";
import { formatDateTime, formatDuration } from "../format";

const TRIGGER_LABEL: Record<string, string> = {
  cli: "CLI",
  api: "API",
  webhook: "Webhook",
};

export function SyncRunsPage() {
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadRuns(storeFilter: string) {
    try {
      const data = await api.syncRuns(storeFilter || undefined);
      setRuns(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sync runs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.stores().then(setStores).catch(() => setStores([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    loadRuns(selectedStore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStore]);

  const runButtonStore = selectedStore || stores[0]?.slug || null;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-kicker">Operations</div>
          <h1 className="page-title">Sync runs</h1>
          <p className="page-description">
            Every catalog sync executed against a connected Shopify store, with change counts and
            outcome. Trigger a new run below or drill into any row for its event timeline.
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
        <RunSyncButton
          storeSlug={runButtonStore}
          onComplete={() => loadRuns(selectedStore)}
        />
        {stores.length > 1 && !selectedStore && (
          <span style={{ color: "var(--text-faint)", fontSize: 11.5 }}>
            Run sync targets {stores[0]?.name}. Filter to a store to target a different one.
          </span>
        )}
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      <div className="panel table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Store</th>
              <th>Started</th>
              <th>Duration</th>
              <th>Trigger</th>
              <th>Products</th>
              <th>Variants</th>
              <th>Backoffs</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8}>
                  <div className="loading-row">
                    <span className="spinner" aria-hidden="true" />
                    Loading sync runs
                  </div>
                </td>
              </tr>
            )}
            {!loading && runs.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    No sync runs yet. Trigger one with the button above, or run
                    <code style={{ margin: "0 4px" }}>manage.py sync_store &lt;slug&gt;</code>
                    from the CLI.
                  </div>
                </td>
              </tr>
            )}
            {runs.map((run) => (
              <tr key={run.id} className="row-link" onClick={() => navigate(`/runs/${run.id}`)}>
                <td>{run.store_slug}</td>
                <td className="mono-num">{formatDateTime(run.started_at)}</td>
                <td className="mono-num">{formatDuration(run.duration_seconds)}</td>
                <td>{TRIGGER_LABEL[run.trigger] ?? run.trigger}</td>
                <td>
                  <div className="count-cell mono-num">
                    <span className="count-created">+{run.products_created}</span>
                    <span className="count-updated">~{run.products_updated}</span>
                    <span className="count-unchanged">={run.products_unchanged}</span>
                  </div>
                </td>
                <td>
                  <div className="count-cell mono-num">
                    <span className="count-created">+{run.variants_created}</span>
                    <span className="count-updated">~{run.variants_updated}</span>
                    <span className="count-unchanged">={run.variants_unchanged}</span>
                  </div>
                </td>
                <td className="mono-num">{run.rate_limit_backoffs}</td>
                <td>
                  <StatusPill status={run.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
