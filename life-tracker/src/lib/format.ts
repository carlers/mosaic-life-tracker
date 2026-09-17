/**
 * Short relative-time formatter for conversation rows and sync status.
 *
 * Accepts an ISO timestamp or null. Returns '' for null/empty input so
 * callers can render the value unconditionally.
 *
 * Buckets:
 *   < 1 min   → 'now' / 'just now'
 *   < 1 hour  → 'Nm' / 'Nm ago'
 *   < 24 hr   → 'Nh' / 'Nh ago'
 *   < 7 days  → 'Nd' / 'Nd ago'
 *   else      → locale short date
 *
 * The `suffix` parameter controls whether buckets append ' ago'. The
 * conversation list uses the compact form (''), the sync sheet uses the
 * verbose form (' ago').
 */
export function formatRelative(iso: string | null, suffix = ''): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return suffix ? 'just now' : 'now';
  }
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return suffix ? 'just now' : 'now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m${suffix}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h${suffix}`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d${suffix}`;
  return suffix
    ? d.toLocaleDateString()
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
