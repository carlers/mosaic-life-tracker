import { compareVersions, parseVersion } from './versioning.mjs';

export const PRODUCTION_DOMAIN = 'https://mosaic-life-tracker.vercel.app';
export const VERCEL_STATUS_PREFIX = 'https://vercel.com/carls-projects-72516fde/mosaic-life-tracker/';

export function releaseTag(version) {
  parseVersion(version);
  return 'v' + version;
}

export function extractReleaseNotes(body) {
  if (typeof body !== 'string') throw new Error('Production PR has no release notes');
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex(line => /^#{2,3}\s+(?:User-facing release notes|User-facing changes since [^\r\n]+)\s*$/i.test(line.trim()));
  if (start < 0) throw new Error('Production PR must include a User-facing release notes section');
  const endOffset = lines.slice(start + 1).findIndex(line => /^#{1,3}\s+\S/.test(line));
  const notes = lines.slice(start + 1, endOffset < 0 ? undefined : start + 1 + endOffset).join('\n').trim();
  if (notes.length < 25 || notes.length > 8000 || !/^[-*]\s+\S/m.test(notes)) {
    throw new Error('Production release notes must contain a bounded user-facing change list');
  }
  if (/\b(TODO|TBD|placeholder)\b/i.test(notes)) throw new Error('Release notes contain unfinished placeholders');
  return notes;
}

function htmlDecode(value) {
  return value.replace(/&quot;/g, '"').replace(/&#(?:0*34|x0*22);/gi, '"')
    .replace(/&#(?:0*39|x0*27);/gi, "'").replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

export function parseProductionBuild(html) {
  if (typeof html !== 'string') throw new Error('Invalid production HTML');
  const tag = html.match(/<meta\b[^>]*\bname=["']mosaic-build-info["'][^>]*>/i)?.[0];
  const content = tag?.match(/\bcontent=(["'])([\s\S]*?)\1/i)?.[2];
  if (!content) throw new Error('Production build identity meta is missing');
  const data = JSON.parse(htmlDecode(content));
  if (!data || typeof data !== 'object') throw new Error('Invalid production build identity');
  return data;
}

export function assertProductionEvidence({ build, sha, statuses }) {
  if (build?.commit !== sha || build?.branch !== 'main' || build?.channel !== 'Production') {
    throw new Error('Live production identity does not match the proposed main commit');
  }
  const vercel = Array.isArray(statuses) ? statuses.find(s => s.context === 'Vercel') : null;
  if (vercel?.state !== 'success' || typeof vercel.target_url !== 'string' ||
    !vercel.target_url.startsWith(VERCEL_STATUS_PREFIX)) {
    throw new Error('Exact production commit has no successful Mosaic Vercel status');
  }
}

export function isNewProductionVersion(version, previous) {
  return compareVersions(version, previous) > 0;
}

export function decidePublication({ version, priorVersion, currentSha, mainSha, taggedSha, existingRelease }) {
  const tag = releaseTag(version);
  if (currentSha !== mainSha) throw new Error('Superseded main SHA: refusing an obsolete release');
  if (taggedSha && taggedSha !== currentSha) throw new Error('Existing tag points to another commit');
  if (existingRelease) {
    if (existingRelease.tag_name !== tag || existingRelease.draft || existingRelease.prerelease ||
        !existingRelease.published_at) throw new Error('Existing release is not a published stable release');
    return 'already-published';
  }
  if (priorVersion && compareVersions(version, priorVersion) <= 0) {
    throw new Error('Production version must increase beyond the latest published release');
  }
  return 'publish';
}
