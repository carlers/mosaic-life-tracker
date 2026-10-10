// Public, account-independent release notes. GitHub Releases are published only after main acceptance.
export const RELEASES_URL = 'https://api.github.com/repos/carlers/mosaic-life-tracker/releases?per_page=30';
export const RELEASES_PAGE_URL = 'https://github.com/carlers/mosaic-life-tracker/releases';
const CACHE_KEY = 'mosaic:public-releases:v1';
const CACHE_FRESH_MS = 15 * 60 * 1000;
const MAX_RELEASES = 30;
const VERSION_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export interface PublicRelease {
  tag: string;
  date: string;
  summary: string;
  notes: string;
  url: string;
}

export interface ReleaseHistoryResult {
  releases: PublicRelease[];
  source: 'live' | 'cached' | 'unavailable';
  fetchedAt: number | null;
}

type CachedResponse = { fetchedAt: number; items: unknown };

function asRelease(value: unknown): PublicRelease | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  const tag = r.tag_name;
  const date = r.published_at;
  if (r.draft !== false || r.prerelease !== false ||
      typeof tag !== 'string' || !VERSION_TAG.test(tag) ||
      typeof date !== 'string' || !Number.isFinite(Date.parse(date))) return null;
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  const notes = typeof r.body === 'string' ? r.body.slice(0, 8000).trim() : '';
  const firstLine = notes.split(/\r?\n/).map(line => line.replace(/^#+\s*|^\s*[-*]\s*/, '').trim()).find(Boolean);
  return {
    tag, date,
    summary: (name && name !== tag ? name : firstLine || 'Release notes').slice(0, 180),
    notes,
    // Never accept arbitrary links from an API payload or stale browser cache.
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
      // Store only bounded API records; never cache user data or credentials.
      const sanitized = (items as unknown[]).slice(0, MAX_RELEASES).map(item => {
        if (!item || typeof item !== 'object') return null;
        const r = item as Record<string, unknown>;
        return {
          tag_name: r.tag_name, published_at: r.published_at,
          draft: r.draft, prerelease: r.prerelease,
          name: typeof r.name === 'string' ? r.name.slice(0, 180) : '',
          body: typeof r.body === 'string' ? r.body.slice(0, 8000) : '',
        };
      });
      localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt, items: sanitized }));
    } catch { /* Browser storage can be disabled or full. */ }
    return { releases, source: 'live', fetchedAt };
  } catch {
    if (signal?.aborted) throw new Error('Release request cancelled');
    if (cached) return { releases: normalizeReleases(cached.items), source: 'cached', fetchedAt: cached.fetchedAt };
    return { releases: [], source: 'unavailable', fetchedAt: null };
  }
}
