// Metadata comes from the exact waiting service worker, never a mutable web endpoint.
// Missing or incompatible metadata must not block a user-approved app update.
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

export interface PwaUpdatePresentation {
  kind: PwaUpdateKind;
  label: string;
  title: string;
  description: string;
  version: string | null;
  changes: string[];
}

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function parts(value: string): number[] | null {
  if (!VERSION.test(value)) return null;
  const result = value.split('.').map(Number);
  return result.every(Number.isSafeInteger) ? result : null;
}

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

export function parsePwaUpdateInfo(value: unknown): PwaUpdateInfo | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  if (typeof source.version !== 'string' || !parts(source.version) ||
    !Array.isArray(source.releases) || source.releases.length > 12) return null;
  const target = parts(source.version)!;
  const seen = new Set<string>();
  const releases: PwaReleaseNote[] = [];
  for (const entry of source.releases) {
    if (!entry || typeof entry !== 'object') return null;
    const note = entry as Record<string, unknown>;
    if (typeof note.version !== 'string' || !parts(note.version) ||
      compare(parts(note.version)!, target) > 0 || seen.has(note.version) ||
      typeof note.headline !== 'string' || !note.headline.trim() ||
      note.headline.length > 120 || !Array.isArray(note.changes) ||
      note.changes.length > 4 || !note.changes.every(change =>
        typeof change === 'string' && change.trim().length > 0 && change.length <= 180
      )) return null;
    seen.add(note.version);
    releases.push({
      version: note.version,
      headline: note.headline.trim(),
      changes: (note.changes as string[]).map(change => change.trim()),
    });
  }
  return { version: source.version, releases };
}

export function describePwaUpdate(
  installedVersion: string,
  info: PwaUpdateInfo | null,
): PwaUpdatePresentation {
  const installed = parts(installedVersion);
  const target = info && parts(info.version);
  const generic = {
    kind: 'unknown' as const,
    label: 'App update',
    title: 'Mosaic update ready',
    description: 'An update is downloaded and ready to install. Mosaic will reload after you confirm.',
    version: null,
    changes: [],
  };
  if (!installed || !info || !target || compare(target, installed) < 0) return generic;
  const kind: PwaUpdateKind =
    compare(target, installed) === 0 ? 'maintenance' :
    target[0] !== installed[0] ? 'major' :
    target[1] !== installed[1] ? 'minor' : 'patch';
  const defaults = {
    major: ['Major update', 'A major Mosaic update is ready.', 'This release introduces significant changes.'],
    minor: ["What's new", 'New features are ready', 'This update includes new features and improvements.'],
    patch: ['Improvements', 'Fixes and polish', 'This update includes refinements and fixes.'],
    maintenance: ['Maintenance update', 'Mosaic update ready', 'A newer build is ready to install.'],
    unknown: [generic.label, generic.title, generic.description],
  }[kind];
  // Only actual catalog entries newer than the installed version can be shown.
  // These are selected highlights, not a claim to be a complete release history.
  const applicable = info.releases.filter(note => {
    const version = parts(note.version);
    return version && compare(version, installed) > 0 && compare(version, target) <= 0;
  }).sort((a, b) => compare(parts(b.version)!, parts(a.version)!));
  const newest = applicable.find(note => note.version === info.version);
  return {
    kind,
    label: defaults[0],
    title: kind !== 'maintenance' && newest ? newest.headline : defaults[1],
    description: defaults[2],
    version: info.version,
    changes: kind === 'maintenance' ? [] :
      applicable.flatMap(note => note.changes).slice(0, 4),
  };
}
