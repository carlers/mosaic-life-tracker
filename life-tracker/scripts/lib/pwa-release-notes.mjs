// Durable build-time contract for human-authored notes delivered by the waiting worker.
// This validator cannot establish truthfulness; authors must review every claim.
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PLACEHOLDER = /\b(?:TODO|TBD|placeholder|coming soon|lorem ipsum)\b/i;
const GENERIC = /^(?:mosaic update ready|app update|new version|bug fixes|improvements|fixes and refinements)$/i;
function parts(value) {
  if (typeof value !== 'string' || !VERSION.test(value)) return null;
  const result = value.split('.').map(Number);
  return result.every(Number.isSafeInteger) ? result : null;
}
function compare(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
export function validatePwaReleaseNotes(version, releases) {
  const current = parts(version);
  if (!current) throw new Error('Invalid application version');
  if (!Array.isArray(releases) || releases.length === 0 || releases.length > 12) {
    throw new Error('PWA notes must contain 1–12 releases');
  }
  const seen = new Set();
  let previous = null;
  for (const entry of releases) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Invalid PWA release-note entry');
    }
    const value = parts(entry.version);
    if (!value || compare(value, current) > 0 || seen.has(entry.version)) {
      throw new Error('Duplicate, future or invalid PWA release-note version');
    }
    if (previous && compare(value, previous) >= 0) {
      throw new Error('PWA release notes must be sorted newest first');
    }
    if (typeof entry.headline !== 'string' || entry.headline.trim().length < 12 ||
        entry.headline.length > 120 || PLACEHOLDER.test(entry.headline) ||
        GENERIC.test(entry.headline.trim())) {
      throw new Error('PWA release headline must describe a concrete change');
    }
    if (!Array.isArray(entry.changes) || entry.changes.length < 1 || entry.changes.length > 4 ||
        entry.changes.some(change => typeof change !== 'string' ||
          change.trim().length < 20 || change.length > 180 ||
          PLACEHOLDER.test(change) || GENERIC.test(change.trim()))) {
      throw new Error('PWA release must contain 1–4 specific, bounded changes');
    }
    seen.add(entry.version);
    previous = value;
  }
  if (!seen.has(version)) {
    throw new Error('Missing required PWA release notes for v' + version);
  }
  return releases.find(entry => entry.version === version);
}
