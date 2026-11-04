import type { PublicRelease, VersionMilestone } from './releaseHistory';

export const DEVELOPMENT_HISTORY_URL =
  'https://raw.githubusercontent.com/carlers/mosaic-life-tracker/mosaic-release-history/history.json';
const CACHE_KEY = 'mosaic:development-releases:v1';
const FRESH_MS = 15 * 60 * 1000;
const MAX_EVENTS = 1200;
const MAX_NOTES = 2400;
const VERSION_RE = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SHA_RE = /^[a-f0-9]{40}$/;
const BRANCH_RE = /^(?:feature|fix|perf|security|refactor)\/[a-zA-Z0-9._/-]{1,160}$/;
const REPO_URL = 'https://github.com/carlers/mosaic-life-tracker/';

export type ReleaseStage = 'preview' | 'dev' | 'production';

export interface DevelopmentEvent {
  id: string;
  tag: string;
  stage: ReleaseStage;
  sha: string;
  lineageId: string;
  branch: string;
  recordedAt: string;
  title: string;
  notes: string;
  url: string;
}

export interface DevelopmentHistoryResult {
  events: DevelopmentEvent[];
  source: 'live' | 'cached' | 'unavailable';
  fetchedAt: number | null;
}

export interface UnifiedVersion {
  key: string;
  tag: string;
  title: string;
  notes: string;
  events: DevelopmentEvent[];
  productionRelease?: PublicRelease;
  milestones: VersionMilestone[];
  historicalPreview: boolean;
  date: string | null;
}

function normalizedEvent(raw: unknown): DevelopmentEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  if (e.stage !== 'preview' && e.stage !== 'dev' && e.stage !== 'production') return null;
  const stage = e.stage;
  if (typeof e.sha !== 'string' || !SHA_RE.test(e.sha) ||
      typeof e.lineageId !== 'string' || !SHA_RE.test(e.lineageId) ||
      typeof e.tag !== 'string' || !VERSION_RE.test(e.tag) ||
      typeof e.branch !== 'string' ||
      (stage === 'preview' ? !BRANCH_RE.test(e.branch) :
        e.branch !== (stage === 'dev' ? 'dev' : 'main')) ||
      e.id !== stage + ':' + e.sha ||
      typeof e.recordedAt !== 'string' ||
      !Number.isFinite(Date.parse(e.recordedAt)) ||
      typeof e.title !== 'string' || e.title.length > 180 ||
      typeof e.notes !== 'string' || e.notes.length > MAX_NOTES ||
      typeof e.url !== 'string' || !e.url.startsWith(REPO_URL)) return null;
  try {
    const parsed = new URL(e.url);
    if (parsed.origin !== 'https://github.com' ||
        !parsed.pathname.startsWith('/carlers/mosaic-life-tracker/')) return null;
  } catch { return null; }
  return {
    id: e.id, tag: e.tag, stage, sha: e.sha, lineageId: e.lineageId,
    branch: e.branch, recordedAt: e.recordedAt,
    title: e.title, notes: e.notes, url: e.url,
  };
}

export function normalizeDevelopmentHistory(raw: unknown): DevelopmentEvent[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid development history');
  const data = raw as Record<string, unknown>;
  if (data.schema !== 1 || !Array.isArray(data.events) || data.events.length > MAX_EVENTS) {
    throw new Error('Unsupported development history');
  }
  const seen = new Map<string, DevelopmentEvent>();
  for (const candidate of data.events) {
    const entry = normalizedEvent(candidate);
    if (!entry) throw new Error('Invalid development event');
    const prior = seen.get(entry.id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(entry)) {
      throw new Error('Conflicting development event');
    }
    seen.set(entry.id, entry);
  }
  return [...seen.values()].sort((a, b) =>
    Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
}

function cache(): DevelopmentHistoryResult | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fetchedAt: number; payload: unknown };
    if (!Number.isFinite(parsed.fetchedAt) || parsed.fetchedAt <= 0 ||
        parsed.fetchedAt > Date.now()) return null;
    return {
      events: normalizeDevelopmentHistory(parsed.payload),
      source: 'cached', fetchedAt: parsed.fetchedAt,
    };
  } catch { return null; }
}

export function readCachedDevelopmentHistory(): DevelopmentHistoryResult | null {
  return cache();
}

export async function loadDevelopmentHistory(
  force = false, signal?: AbortSignal,
): Promise<DevelopmentHistoryResult> {
  const saved = cache();
  if (!force && saved && Date.now() - saved.fetchedAt! < FRESH_MS) return saved;
  try {
    const response = await fetch(DEVELOPMENT_HISTORY_URL, {
      signal, headers: { Accept: 'application/json' }, cache: force ? 'no-store' : 'default',
    });
    if (!response.ok) throw new Error('Development history unavailable');
    const payload: unknown = await response.json();
    const events = normalizeDevelopmentHistory(payload);
    const fetchedAt = Date.now();
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt, payload: { schema: 1, events } }));
    } catch { /* Browser storage is optional. */ }
    return { events, source: 'live', fetchedAt };
  } catch {
    if (signal?.aborted) throw new Error('History request cancelled');
    return saved ?? { events: [], source: 'unavailable', fetchedAt: null };
  }
}

function versionParts(tag: string): number[] {
  return tag.slice(1).split('.').map(Number);
}

export function buildUnifiedHistory(
  releases: PublicRelease[],
  development: DevelopmentEvent[],
  archivedPreview: VersionMilestone[],
): UnifiedVersion[] {
  const entries = new Map<string, UnifiedVersion>();
  const byPublishedSha = new Map<string, UnifiedVersion>();
  const create = (key: string, tag: string, title: string, notes = ''): UnifiedVersion => {
    const existing = entries.get(key);
    if (existing) return existing;
    const entry: UnifiedVersion = {
      key, tag, title, notes, events: [], milestones: [],
      historicalPreview: false, date: null,
    };
    entries.set(key, entry);
    return entry;
  };
  // A version label is not a lineage proof. Development events share a card
  // only when the trusted publisher gave them the same lineage identity.
  for (const event of development) {
    const key = 'lineage:' + event.lineageId + ':' + event.tag;
    const entry = create(key, event.tag, event.title, event.notes);
    if (!entry.events.some(previous => previous.id === event.id)) entry.events.push(event);
    if (!entry.notes && event.notes) entry.notes = event.notes;
    if (!entry.date || Date.parse(event.recordedAt) > Date.parse(entry.date)) {
      entry.date = event.recordedAt;
    }
    if (event.stage === 'production') byPublishedSha.set(event.tag, entry);
  }
  for (const release of releases) {
    const entry = byPublishedSha.get(release.tag) ??
      create('official:' + release.tag, release.tag, release.summary, release.notes);
    entry.productionRelease = release;
    entry.title = release.summary;
    entry.notes = release.notes;
    entry.date = release.date;
    entry.milestones = release.milestones.filter(item => item.tag !== release.tag);
  }
  for (const item of archivedPreview) {
    // Archive snapshots describe old Preview experiments; no event time or
    // deployment proof is inferred from their PR provenance.
    if ([...entries.values()].some(e => e.tag === item.tag)) continue;
    const entry = create('archive:' + item.tag, item.tag, item.title, item.notes);
    entry.historicalPreview = true;
  }
  for (const entry of entries.values()) {
    entry.events.sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
  }
  return [...entries.values()].sort((a, b) => {
    const x = versionParts(a.tag);
    const y = versionParts(b.tag);
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i];
    return Date.parse(b.date || '1970-01-01') - Date.parse(a.date || '1970-01-01');
  });
}

export function versionInChannel(entry: UnifiedVersion, channel: 'all' | ReleaseStage): boolean {
  if (channel === 'all') return true;
  if (channel === 'production') return !!entry.productionRelease;
  if (channel === 'preview') return entry.historicalPreview ||
    entry.events.some(event => event.stage === 'preview');
  return entry.events.some(event => event.stage === 'dev');
}
