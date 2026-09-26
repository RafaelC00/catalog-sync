import type { SyncStatus } from "../api";

const LABELS: Record<SyncStatus, string> = {
  running: "Running",
  success: "Success",
  failed: "Failed",
};

export function StatusPill({ status }: { status: SyncStatus }) {
  return (
    <span className={`status-pill status-${status}`}>
      <span className="dot" aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}
