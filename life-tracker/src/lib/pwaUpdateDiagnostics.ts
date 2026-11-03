/**
 * Preview-only, local and opt-in-to-export PWA acquisition timing.
 * Never records account identity, URLs, task data, device fingerprint or IP.
 * Workbox precache "bytes" are emitted uncompressed asset sizes, NOT transfer bytes.
 */
export type PwaDiagnosticSource = 'background' | 'manual' | 'browser';
export type PwaDiagnosticStage =
  | 'started' | 'checking' | 'joined-install' | 'still-installing' | 'update-found' | 'downloading'
  | 'first-asset' | 'asset-quarter' | 'asset-half' | 'asset-three-quarters'
  | 'assets-complete' | 'visibility-hidden' | 'visibility-visible'
  | 'ready' | 'up-to-date' | 'unavailable' | 'redundant' | 'timeout' | 'error';

export interface PwaDiagnosticEvent {
  stage: PwaDiagnosticStage;
  elapsedMs: number;
  completedAssets?: number;
  totalAssets?: number;
  // Asset size from the build manifest, NOT browser network transfer bytes.
  completedAssetBytes?: number;
  totalAssetBytes?: number;
}
// Predefined categories only; never persist exception messages or URLs.
export type PwaDiagnosticErrorKind =
  | 'network' | 'security' | 'invalid-state' | 'abort' | 'type-error' | 'other';

const errorKinds = new Set<PwaDiagnosticErrorKind>([
  'network', 'security', 'invalid-state', 'abort', 'type-error', 'other',
]);

function classifyError(error: unknown): PwaDiagnosticErrorKind {
  const name = error && typeof error === 'object' && 'name' in error
    ? error.name : null;
  if (name === 'NetworkError') return 'network';
  if (name === 'SecurityError') return 'security';
  if (name === 'InvalidStateError') return 'invalid-state';
  if (name === 'AbortError') return 'abort';
  if (name === 'TypeError') return 'type-error';
  return 'other';
}

export interface PwaDiagnosticRecord {
  id: string;
  source: PwaDiagnosticSource;
  startedAt: string;
  visibleAtStart: boolean;
  onlineAtStart: boolean | null;
  events: PwaDiagnosticEvent[];
  outcome: string | null;
  durationMs: number | null;
  errorKind?: PwaDiagnosticErrorKind;
}

const KEY = 'mosaic_preview_pwa_update_timings_v1';
const MAX_RECORDS = 24;
const MAX_EVENTS = 32;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const allowedStages = new Set<PwaDiagnosticStage>([
  'started', 'checking', 'joined-install', 'still-installing', 'update-found', 'downloading',
  'first-asset', 'asset-quarter', 'asset-half', 'asset-three-quarters',
  'assets-complete', 'visibility-hidden', 'visibility-visible',
  'ready', 'up-to-date', 'unavailable', 'redundant', 'timeout', 'error',
]);

type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function validRecord(value: unknown): value is PwaDiagnosticRecord {
  if (!value || typeof value !== 'object') return false;
  const v = value as PwaDiagnosticRecord;
  return typeof v.id === 'string' && v.id.length < 64 &&
    (v.source === 'background' || v.source === 'manual' || v.source === 'browser') &&
    typeof v.startedAt === 'string' && Number.isFinite(Date.parse(v.startedAt)) &&
    typeof v.visibleAtStart === 'boolean' &&
    (v.onlineAtStart === null || typeof v.onlineAtStart === 'boolean') &&
    Array.isArray(v.events) && v.events.length <= MAX_EVENTS &&
    v.events.every((e) => e && allowedStages.has(e.stage) &&
      Number.isFinite(e.elapsedMs) && e.elapsedMs >= 0 &&
      e.elapsedMs <= MAX_AGE_MS &&
      (e.completedAssets === undefined || Number.isSafeInteger(e.completedAssets)) &&
      (e.totalAssets === undefined || Number.isSafeInteger(e.totalAssets)) &&
      (e.completedAssetBytes === undefined || Number.isSafeInteger(e.completedAssetBytes)) &&
      (e.totalAssetBytes === undefined || Number.isSafeInteger(e.totalAssetBytes))) &&
    (v.outcome === null || typeof v.outcome === 'string') &&
    (v.errorKind === undefined || errorKinds.has(v.errorKind)) &&
    (v.durationMs === null || (Number.isFinite(v.durationMs) && v.durationMs >= 0));
}

export function createPwaDiagnosticRecorder({
  enabled,
  storage,
  now = () => performance.now(),
  wallNow = () => Date.now(),
  visible = () => typeof document !== 'undefined' && document.visibilityState !== 'hidden',
  online = () => typeof navigator === 'undefined' ? null : navigator.onLine,
}: {
  enabled: boolean;
  storage: StoragePort | null;
  now?: () => number;
  wallNow?: () => number;
  visible?: () => boolean;
  online?: () => boolean | null;
}) {
  const started = new Map<string, number>();
  const progressMilestones = new Map<string, number>();
  const listeners = new Set<() => void>();
  let sequence = 0;
  let records: PwaDiagnosticRecord[] = [];

  if (enabled && storage) {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(KEY) ?? '[]');
      if (Array.isArray(parsed)) {
        records = parsed.filter(validRecord).filter((r) =>
          wallNow() - Date.parse(r.startedAt) < MAX_AGE_MS &&
          Date.parse(r.startedAt) <= wallNow() + 60_000
        ).slice(-MAX_RECORDS).map((r) => ({ ...r, events: [...r.events] }));
      }
    } catch { /* storage blocked or stale/tampered history; use empty in-memory history */ }
  }

  function persist() {
    if (!enabled) return;
    try { storage?.setItem(KEY, JSON.stringify(records)); } catch { /* quotas/private mode */ }
    listeners.forEach((listener) => listener());
  }

  function start(source: PwaDiagnosticSource): string | null {
    if (!enabled) return null;
    const id = String(wallNow()) + '-' + String(++sequence);
    const record: PwaDiagnosticRecord = {
      id, source, startedAt: new Date(wallNow()).toISOString(),
      visibleAtStart: visible(), onlineAtStart: online(),
      events: [{ stage: 'started', elapsedMs: 0 }],
      outcome: null, durationMs: null,
    };
    records = [...records.slice(-(MAX_RECORDS - 1)), record];
    started.set(id, now());
    persist();
    return id;
  }

  function mark(id: string | null, stage: PwaDiagnosticStage, progress?: {
    completed: number; total: number;
    completedBytes: number | null; totalBytes: number | null;
  }) {
    if (!id || !started.has(id)) return;
    const record = records.find((r) => r.id === id);
    if (!record || record.outcome !== null || record.events.length >= MAX_EVENTS) return;
    const event: PwaDiagnosticEvent = { stage, elapsedMs: Math.max(0, Math.round(now() - started.get(id)!)) };
    if (progress) {
      event.completedAssets = progress.completed;
      event.totalAssets = progress.total;
      if (progress.completedBytes !== null && progress.totalBytes !== null) {
        event.completedAssetBytes = progress.completedBytes;
        event.totalAssetBytes = progress.totalBytes;
      }
    }
    record.events.push(event);
    persist();
  }

  function progress(progress: {
    completed: number; total: number;
    completedBytes: number | null; totalBytes: number | null;
  }) {
    if (!Number.isSafeInteger(progress.total) || progress.total <= 0 ||
      !Number.isSafeInteger(progress.completed) || progress.completed < 0 ||
      progress.completed > progress.total) return;
    const ratio = progress.completed / progress.total;
    const milestone = ratio >= 1 ? 5 : ratio >= .75 ? 4 : ratio >= .5 ? 3 : ratio >= .25 ? 2 : 1;
    const stages: PwaDiagnosticStage[] = [
      'started', 'first-asset', 'asset-quarter', 'asset-half',
      'asset-three-quarters', 'assets-complete',
    ];
    for (const id of started.keys()) {
      if ((progressMilestones.get(id) ?? 0) >= milestone) continue;
      progressMilestones.set(id, milestone);
      mark(id, stages[milestone], progress);
    }
  }

  function end(id: string | null, outcome: PwaDiagnosticStage) {
    if (!id || !started.has(id)) return;
    mark(id, outcome);
    const record = records.find((r) => r.id === id);
    if (record) {
      record.durationMs = Math.max(0, Math.round(now() - started.get(id)!));
      record.outcome = outcome;
    }
    started.delete(id);
    progressMilestones.delete(id);
    persist();
  }

  function fail(id: string | null, error: unknown) {
    if (!id || !started.has(id)) return;
    const record = records.find((r) => r.id === id);
    if (record) record.errorKind = classifyError(error);
    end(id, 'error');
  }

  function visibilityChanged() {
    for (const id of started.keys()) mark(id, visible() ? 'visibility-visible' : 'visibility-hidden');
  }

  function clear() {
    records = [];
    started.clear();
    progressMilestones.clear();
    try { storage?.removeItem(KEY); } catch { /* storage blocked */ }
    listeners.forEach((listener) => listener());
  }

  return {
    start, mark, progress, end, fail, visibilityChanged, clear,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getRecords: () => records.map((r) => ({ ...r, events: r.events.map((e) => ({ ...e })) })),
    exportJson: () => JSON.stringify({
      schema: 1, description: 'Preview-only local PWA timing. Asset bytes are build sizes, not network bytes.',
      records,
    }, null, 2),
  };
}

function detectPreview(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const raw = document.querySelector<HTMLMetaElement>('meta[name="mosaic-build-info"]')?.content;
    return Boolean(raw && (JSON.parse(raw) as { channel?: string }).channel === 'Preview');
  } catch { return false; }
}

export const pwaDiagnosticsEnabled = detectPreview();
export const pwaDiagnostics = createPwaDiagnosticRecorder({
  enabled: pwaDiagnosticsEnabled,
  storage: (() => {
    if (!pwaDiagnosticsEnabled) return null;
    try { return globalThis.localStorage; } catch { return null; }
  })(),
});
