// Public, account-independent history. Only published production Releases are authoritative.
export const RELEASES_URL = 'https://api.github.com/repos/carlers/mosaic-life-tracker/releases?per_page=30';
export const RELEASES_PAGE_URL = 'https://github.com/carlers/mosaic-life-tracker/releases';
const CACHE_KEY = 'mosaic:public-releases:v1';
const CACHE_FRESH_MS = 15 * 60 * 1000;
const MAX_RELEASES = 30;
const MAX_NOTES = 16000;
const VERSION_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const MILESTONES_START = '<!-- mosaic:milestones:v1 -->';
const MILESTONES_END = '<!-- /mosaic:milestones:v1 -->';

export interface VersionMilestone {
  tag: string;
  title: string;
  notes: string;
}

export interface PublicRelease {
  tag: string;
  date: string;
  summary: string;
  notes: string;
  url: string;
  milestones: VersionMilestone[];
}

export interface ReleaseHistoryResult {
  releases: PublicRelease[];
  source: 'live' | 'cached' | 'unavailable';
  fetchedAt: number | null;
}

type CachedResponse = { fetchedAt: number; items: unknown };

function versionParts(tag: string): number[] {
  return tag.slice(1).split('.').map(Number);
}

function compareTags(a: string, b: string): number {
  const left = versionParts(a);
  const right = versionParts(b);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] - right[i];
  return 0;
}

export function splitReleaseMilestones(body: string, productionTag: string): {
  notes: string; milestones: VersionMilestone[];
} {
  const start = body.indexOf(MILESTONES_START);
  const end = body.indexOf(MILESTONES_END, start + MILESTONES_START.length);
  if (start < 0 || end < 0 || end < start) return { notes: body, milestones: [] };
  const section = body.slice(start + MILESTONES_START.length, end);
  const aggregate = (body.slice(0, start) + body.slice(end + MILESTONES_END.length)).trim();
  const milestones: VersionMilestone[] = [];
  const seen = new Set<string>();
  let current: VersionMilestone | null = null;
  for (const line of section.split(/\r?\n/)) {
    const heading = /^### (v\d+\.\d+\.\d+)(?:\s+[—–-]\s+(.+))?\s*$/.exec(line);
    if (heading) {
      if (current && current.notes.trim()) milestones.push({ ...current, notes: current.notes.trim() });
      current = null;
      if (milestones.length >= 60 || !VERSION_TAG.test(heading[1]) ||
          compareTags(heading[1], productionTag) > 0 || seen.has(heading[1])) continue;
      seen.add(heading[1]);
      current = { tag: heading[1], title: (heading[2] || 'Version update').trim().slice(0, 160), notes: '' };
    } else if (current) {
      current.notes += line + '\n';
    }
  }
  if (current && current.notes.trim() && milestones.length < 60) {
    milestones.push({ ...current, notes: current.notes.trim() });
  }
  milestones.sort((a, b) => compareTags(b.tag, a.tag));
  return { notes: aggregate, milestones };
}

function asRelease(value: unknown): PublicRelease | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  const tag = r.tag_name;
  const date = r.published_at;
  if (r.draft !== false || r.prerelease !== false ||
      typeof tag !== 'string' || !VERSION_TAG.test(tag) ||
      typeof date !== 'string' || !Number.isFinite(Date.parse(date))) return null;
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  const body = typeof r.body === 'string' ? r.body.slice(0, MAX_NOTES).trim() : '';
  const { notes, milestones } = splitReleaseMilestones(body, tag);
  const firstLine = notes.split(/\r?\n/)
    .map(line => line.replace(/^#+\s*|^\s*[-*]\s*/, '').replace(/\*\*/g, '').trim())
    .find(Boolean);
  return {
    tag, date,
    summary: (name && name !== tag && name !== 'Mosaic ' + tag
      ? name.replace(/^Mosaic v\d+\.\d+\.\d+\s*[—–-]\s*/, '')
      : firstLine || 'Release notes').slice(0, 180),
    notes, milestones,
    // Never trust arbitrary links provided by GitHub content or browser storage.
    url: RELEASES_PAGE_URL + '/tag/' + encodeURIComponent(tag),
  };
}

export function normalizeReleases(value: unknown): PublicRelease[] {
  if (!Array.isArray(value)) throw new Error('Invalid releases response');
  const seen = new Set<string>();
  return value.slice(0, MAX_RELEASES).map(asRelease)
    .filter((item): item is PublicRelease => {
      if (!item || seen.has(item.tag)) return false;
      seen.add(item.tag);
      return true;
    })
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

function readCache(): CachedResponse | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedResponse;
    if (!cached || typeof cached.fetchedAt !== 'number' ||
        !Number.isFinite(cached.fetchedAt) || cached.fetchedAt <= 0 ||
        cached.fetchedAt > Date.now() || !Array.isArray(cached.items)) return null;
    normalizeReleases(cached.items);
    return cached;
  } catch {
    return null;
  }
}

export function readCachedReleaseHistory(): ReleaseHistoryResult | null {
  const cached = readCache();
  return cached
    ? { releases: normalizeReleases(cached.items), source: 'cached', fetchedAt: cached.fetchedAt }
    : null;
}

export async function loadReleaseHistory(
  force = false,
  signal?: AbortSignal,
): Promise<ReleaseHistoryResult> {
  const cached = readCache();
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_FRESH_MS) {
    return { releases: normalizeReleases(cached.items), source: 'cached', fetchedAt: cached.fetchedAt };
  }
  try {
    const response = await fetch(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal,
    });
    if (!response.ok) throw new Error('Release history unavailable');
    const items: unknown = await response.json();
    const releases = normalizeReleases(items);
    const fetchedAt = Date.now();
    try {
      const sanitized = (items as unknown[]).slice(0, MAX_RELEASES).map(item => {
        if (!item || typeof item !== 'object') return null;
        const r = item as Record<string, unknown>;
        return {
          tag_name: r.tag_name, published_at: r.published_at,
          draft: r.draft, prerelease: r.prerelease,
          name: typeof r.name === 'string' ? r.name.slice(0, 180) : '',
          body: typeof r.body === 'string' ? r.body.slice(0, MAX_NOTES) : '',
        };
      });
      localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt, items: sanitized }));
    } catch { /* Storage may be unavailable or full; live history still works. */ }
    return { releases, source: 'live', fetchedAt };
  } catch {
    if (signal?.aborted) throw new Error('Release request cancelled');
    if (cached) return { releases: normalizeReleases(cached.items), source: 'cached', fetchedAt: cached.fetchedAt };
    return { releases: [], source: 'unavailable', fetchedAt: null };
  }
}
