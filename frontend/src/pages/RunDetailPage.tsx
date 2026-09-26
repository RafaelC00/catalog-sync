import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type SyncRunDetail } from "../api";
import { StatusPill } from "../components/StatusPill";
import { formatDateTime, formatDuration } from "../format";

const EVENT_LABEL: Record<string, string> = {
  started: "Sync started",
  page_fetched: "Page fetched",
  rate_limit_backoff: "Rate limit backoff",
  product_upserted: "Product upserted",
  finished: "Sync finished",
  error: "Error",
};

function EventData({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <div className="timeline-data">
      {entries.map(([key, value]) => (
        <span key={key}>
          {key.replace(/_/g, " ")}: <b>{String(value)}</b>
        </span>
      ))}
    </div>
  );
}

export function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<SyncRunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      try {
        const data = await api.syncRun(Number(id));
        if (!cancelled) setRun(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load run");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <div className="banner banner-error">{error}</div>;
  if (!run) {
    return (
      <div className="loading-row">
        <span className="spinner" aria-hidden="true" />
        Loading run
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-kicker">
            <Link to="/" className="nav-link" style={{ padding: 0 }}>
              ← Sync runs
            </Link>
          </div>
          <h1 className="page-title">
            Run #{run.id} · {run.store_slug}
          </h1>
          <p className="page-description">
            Started {formatDateTime(run.started_at)}, triggered via {run.trigger}.
            {run.error_message && ` Failed: ${run.error_message}`}
          </p>
        </div>
        <StatusPill status={run.status} />
      </div>

      <div className="run-summary">
        <div className="run-stat">
          <div className="run-stat-label">Duration</div>
          <div className="run-stat-value mono-num">{formatDuration(run.duration_seconds)}</div>
        </div>
        <div className="run-stat">
          <div className="run-stat-label">Products created</div>
          <div className="run-stat-value accent-cyan mono-num">{run.products_created}</div>
        </div>
        <div className="run-stat">
          <div className="run-stat-label">Products updated</div>
          <div className="run-stat-value accent-amber mono-num">{run.products_updated}</div>
        </div>
        <div className="run-stat">
          <div className="run-stat-label">Products unchanged</div>
          <div className="run-stat-value mono-num">{run.products_unchanged}</div>
        </div>
        <div className="run-stat">
          <div className="run-stat-label">Variants created</div>
          <div className="run-stat-value accent-cyan mono-num">{run.variants_created}</div>
        </div>
        <div className="run-stat">
          <div className="run-stat-label">Variants updated</div>
          <div className="run-stat-value accent-amber mono-num">{run.variants_updated}</div>
        </div>
        <div className="run-stat">
          <div className="run-stat-label">API requests</div>
          <div className="run-stat-value mono-num">{run.api_requests}</div>
        </div>
        <div className="run-stat">
          <div className="run-stat-label">Rate limit backoffs</div>
          <div className="run-stat-value accent-violet mono-num">{run.rate_limit_backoffs}</div>
        </div>
      </div>

      <div className="section-label">Event timeline</div>
      <div className="panel" style={{ padding: "18px 20px" }}>
        {run.events.length === 0 ? (
          <div className="empty-state">No events recorded for this run.</div>
        ) : (
          <div className="timeline">
            {run.events.map((event) => (
              <div className={`timeline-item level-${event.level}`} key={event.id}>
                <span className="timeline-dot" aria-hidden="true" />
                <div className="timeline-head">
                  <span className="timeline-time mono-num">{formatDateTime(event.timestamp)}</span>
                  <span className="timeline-type">{EVENT_LABEL[event.event_type] ?? event.event_type}</span>
                </div>
                <div className="timeline-message">{event.message}</div>
                <EventData data={event.data} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
