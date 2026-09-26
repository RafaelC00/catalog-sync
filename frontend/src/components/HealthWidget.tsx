import { useEffect, useRef, useState } from "react";
import { api, type Health } from "../api";

const STATUS_LABEL: Record<Health["status"], string> = {
  ok: "All systems nominal",
  degraded: "Degraded",
  down: "Down",
};

function formatRelative(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export function HealthWidget() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const result = await api.health();
        if (!cancelled) {
          setHealth(result);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }
    poll();
    const interval = setInterval(poll, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const status = error ? "down" : health?.status ?? "degraded";

  return (
    <div className="health-widget" ref={ref}>
      <button
        className="health-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className={`status-pill status-${status === "ok" ? "success" : status === "down" ? "failed" : "running"}`}>
          <span className="dot" aria-hidden="true" />
          {error ? "Unreachable" : health ? STATUS_LABEL[health.status] : "Checking"}
        </span>
      </button>
      {open && (
        <div className="health-dropdown" role="dialog" aria-label="Service health detail">
          <h3>/healthz</h3>
          {error && <p className="banner banner-error">Could not reach the API.</p>}
          {health?.dependencies.map((dep) => (
            <div className="health-dep" key={dep.name}>
              <span
                className="dot"
                style={{ background: dep.ok ? "var(--cyan)" : "var(--rose)" }}
                aria-hidden="true"
              />
              <div>
                <div className="health-dep-name">{dep.name.replace(/_/g, " ")}</div>
                <div className="health-dep-detail">{dep.detail}</div>
              </div>
            </div>
          ))}
          {health && <div className="health-checked">Checked {formatRelative(health.checked_at)}</div>}
        </div>
      )}
    </div>
  );
}
