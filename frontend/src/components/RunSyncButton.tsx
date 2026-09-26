import { useState } from "react";
import { api, type SyncRun } from "../api";

export function RunSyncButton({
  storeSlug,
  onComplete,
}: {
  storeSlug: string | null;
  onComplete: (run: SyncRun) => void;
}) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!storeSlug || running) return;
    setRunning(true);
    setError(null);
    try {
      const run = await api.triggerSync(storeSlug);
      onComplete(run);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button className="btn" onClick={handleClick} disabled={!storeSlug || running}>
        {running ? (
          <>
            <span className="spinner" aria-hidden="true" />
            Syncing
          </>
        ) : (
          "Run sync"
        )}
      </button>
      {error && (
        <span style={{ color: "var(--rose)", fontSize: 12 }} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
