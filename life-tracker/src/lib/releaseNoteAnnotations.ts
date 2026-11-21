import type { DevelopmentEvent } from './developmentHistory';

// History event identities remain immutable. Optional notes augment only verified
// events whose original publisher recorded no notes; annotations prove no deploys.
export const RELEASE_NOTE_ANNOTATIONS_URL =
  'https://raw.githubusercontent.com/carlers/mosaic-life-tracker/mosaic-release-history/notes.json';
const CACHE_KEY = 'mosaic:development-release-notes:v1';
const FRESH_MS = 15 * 60 * 1000;
const MAX_ANNOTATIONS = 1200;
const MAX_NOTES = 2400;
const ID = /^(preview|dev):([a-f0-9]{40})$/;
const COMMIT = 'https://github.com/carlers/mosaic-life-tracker/commit/';

export interface ReleaseNoteAnnotation {
  id: string;
  notes: string;
  source: string;
}
export interface ReleaseNoteAnnotationsResult {
  annotations: ReleaseNoteAnnotation[];
  source: 'live' | 'cached' | 'unavailable';
  fetchedAt: number | null;
}

export function normalizeReleaseNoteAnnotations(raw: unknown): ReleaseNoteAnnotation[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid note annotations');
  }
  const data = raw as Record<string, unknown>;
  if (data.schema !== 1 || !Array.isArray(data.annotations) ||
      data.annotations.length > MAX_ANNOTATIONS) {
    throw new Error('Unsupported note annotations');
  }
  const found = new Set<string>();
  return data.annotations.map((candidate: unknown) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new Error('Invalid note annotation');
    }
    const entry = candidate as Record<string, unknown>;
    const match = typeof entry.id === 'string' ? entry.id.match(ID) : null;
    if (!match || found.has(entry.id as string) ||
        typeof entry.notes !== 'string' || !entry.notes.trim() ||
        entry.notes.length > MAX_NOTES ||
        entry.source !== COMMIT + match[2]) {
      throw new Error('Invalid note provenance');
    }
    found.add(entry.id as string);
    return { id: entry.id as string, notes: entry.notes, source: entry.source as string };
  });
}

export function enrichDevelopmentEvents(
  events: DevelopmentEvent[], annotations: ReleaseNoteAnnotation[],
): DevelopmentEvent[] {
  const verified = new Map(events.map(event => [event.id, event]));
  const byId = new Map(annotations.filter(annotation => verified.has(annotation.id))
    .map(annotation => [annotation.id, annotation.notes]));
  return events.map(event => {
    const note = byId.get(event.id);
    return !event.notes.trim() && note ? { ...event, notes: note } : event;
  });
}

function cached(): ReleaseNoteAnnotationsResult | null {
  try {
    const item = localStorage.getItem(CACHE_KEY);
    if (!item) return null;
    const data = JSON.parse(item) as { fetchedAt: number; payload: unknown };
    if (!Number.isFinite(data.fetchedAt) || data.fetchedAt <= 0 ||
        data.fetchedAt > Date.now()) return null;
    return { annotations: normalizeReleaseNoteAnnotations(data.payload),
      source: 'cached', fetchedAt: data.fetchedAt };
  } catch { return null; }
}

export function readCachedReleaseNoteAnnotations(): ReleaseNoteAnnotationsResult | null {
  return cached();
}

export async function loadReleaseNoteAnnotations(
  force = false, signal?: AbortSignal,
): Promise<ReleaseNoteAnnotationsResult> {
  const saved = cached();
  if (!force && saved && Date.now() - saved.fetchedAt! < FRESH_MS) return saved;
  try {
    const response = await fetch(RELEASE_NOTE_ANNOTATIONS_URL, {
      signal, headers: { Accept: 'application/json' }, cache: force ? 'no-store' : 'default',
    });
    if (!response.ok) throw new Error('Release notes unavailable');
    const payload: unknown = await response.json();
    const annotations = normalizeReleaseNoteAnnotations(payload);
    const fetchedAt = Date.now();
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        fetchedAt, payload: { schema: 1, annotations },
      }));
    } catch { /* Browser storage is optional. */ }
    return { annotations, source: 'live', fetchedAt };
  } catch {
    if (signal?.aborted) throw new Error('Notes request cancelled');
    return saved ?? { annotations: [], source: 'unavailable', fetchedAt: null };
  }
}
