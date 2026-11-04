// Descriptions are derived only from the exact waiting worker, never the mutable latest deployment.
export interface PwaReleaseNote {
  version: string;
  headline: string;
  changes: string[];
}
export interface PwaUpdateInfo {
  version: string;
  releases: PwaReleaseNote[];
}
export type PwaUpdateKind = 'major' | 'minor' | 'patch' | 'maintenance' | 'unknown';
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
function parts(value: string): number[] | null {
  if (!VERSION.test(value)) return null;
  const result = value.split('.').map(Number);
  return result.every(Number.isSafeInteger) ? result : null;
}
function compare(left: number[], right: number[]): number {
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] - right[i];
  return 0;
}
export function parsePwaUpdateInfo(value: unknown): PwaUpdateInfo | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (typeof input.version !== 'string' || !parts(input.version) ||
      !Array.isArray(input.releases) || input.releases.length > 12) return null;
  const target = parts(input.version)!;
  const seen = new Set<string>();
  const releases: PwaReleaseNote[] = [];
  for (const candidate of input.releases) {
    if (!candidate || typeof candidate !== 'object') return null;
    const entry = candidate as Record<string, unknown>;
    if (typeof entry.version !== 'string' || !parts(entry.version) ||
        compare(parts(entry.version)!, target) > 0 || seen.has(entry.version) ||
        typeof entry.headline !== 'string' || entry.headline.trim().length === 0 ||
        entry.headline.length > 120 || !Array.isArray(entry.changes) ||
        entry.changes.length > 4 || !entry.changes.every(change =>
          typeof change === 'string' && change.trim().length > 0 && change.length <= 180
        )) return null;
    seen.add(entry.version);
    releases.push({
      version: entry.version, headline: entry.headline.trim(),
      changes: (entry.changes as string[]).map(change => change.trim()),
    });
  }
  return { version: input.version, releases };
}
export function describePwaUpdate(installedVersion: string, info: PwaUpdateInfo | null) {
  const installed = parts(installedVersion);
  const target = info && parts(info.version);
  const fallback = {
    kind: 'unknown' as PwaUpdateKind,
    label: 'App update',
    title: 'Mosaic update ready',
    description: 'A new Mosaic build is downloaded and ready to install.',
    version: null as string | null,
    changes: [] as string[],
  };
  if (!installed || !target || !info || compare(target, installed) < 0) return fallback;
  const kind: PwaUpdateKind =
    compare(target, installed) === 0 ? 'maintenance' :
    target[0] !== installed[0] ? 'major' :
    target[1] !== installed[1] ? 'minor' : 'patch';
  const labels = {
    major: ['Major update', 'A major Mosaic update is ready'],
    minor: ["What's new", 'New Mosaic features are ready'],
    patch: ['Improvements', 'Fixes and refinements are ready'],
    maintenance: ['Maintenance', 'A newer Mosaic build is ready'],
    unknown: [fallback.label, fallback.title],
  }[kind];
  const applicable = info.releases.filter(note => {
    const version = parts(note.version);
    return version && compare(version, installed) > 0 && compare(version, target) <= 0;
  }).sort((a, b) => compare(parts(b.version)!, parts(a.version)!));
  const selected = applicable.find(note => note.version === info.version);
  return {
    kind, label: labels[0], title: selected?.headline ?? labels[1],
    description: 'The update is downloaded. Mosaic will reload when you choose Update now.',
    version: info.version,
    changes: applicable.flatMap(note => note.changes).slice(0,4),
  };
}
