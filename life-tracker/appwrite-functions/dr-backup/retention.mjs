const DAY_MS = 86_400_000;
const SNAPSHOT_RE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})Z$/;

export function parseBackupId(value) {
  const match = SNAPSHOT_RE.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, millis] = match;
  const date = new Date(
    `${year}-${month}-${day}T${hour}:${minute}:${second}.${millis}Z`
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseCompletedMarkerKey(key, prefix) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(
    `^${escaped}/snapshots/([^/]+)/COMPLETED$`
  ).exec(key);
  if (!match || !parseBackupId(match[1])) return null;
  return match[1];
}

function isoWeekKey(date) {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function keepDistinct(entries, count, keyFn, kept) {
  const seen = new Set();
  for (const entry of entries) {
    const key = keyFn(entry.date);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.add(entry.id);
    if (seen.size >= count) break;
  }
}

export function selectRetainedSnapshotIds(
  snapshotIds,
  {
    now = new Date(),
    daily = 7,
    weekly = 4,
    monthly = 6,
    lockDays = 30,
  } = {}
) {
  const entries = snapshotIds
    .map((id) => ({ id, date: parseBackupId(id) }))
    .filter((entry) => entry.date)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const kept = new Set();
  const lockCutoff = now.getTime() - Math.max(0, lockDays) * DAY_MS;
  for (const entry of entries) {
    if (entry.date.getTime() >= lockCutoff) kept.add(entry.id);
  }

  keepDistinct(
    entries,
    Math.max(0, daily),
    (date) => date.toISOString().slice(0, 10),
    kept
  );
  keepDistinct(entries, Math.max(0, weekly), isoWeekKey, kept);
  keepDistinct(
    entries,
    Math.max(0, monthly),
    (date) => date.toISOString().slice(0, 7),
    kept
  );
  return kept;
}
