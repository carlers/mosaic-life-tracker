// Only trusted publisher Actions code uses this local Git history reader.
// Never treat unmerged task/Preview branches as shipped production milestones.
import { execFileSync } from 'node:child_process';
import { compareVersions, parseVersion } from './versioning.mjs';

export const MILESTONE_START = '<!-- mosaic:milestones:v1 -->';
export const MILESTONE_END = '<!-- /mosaic:milestones:v1 -->';
const SHA = /^[a-f0-9]{40}$/;

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }).trim();
}

export function normalizeMilestone({ sha, subject, body, sourceVersion }, previous, current) {
  if (!SHA.test(sha) || typeof subject !== 'string' || typeof sourceVersion !== 'string') return null;
  const match = /\bv((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\b/.exec(subject);
  if (!match || match[1] !== sourceVersion) return null;
  try { parseVersion(sourceVersion); } catch { return null; }
  if (compareVersions(sourceVersion, previous) <= 0 ||
      compareVersions(sourceVersion, current) > 0) return null;
  // The first text line is a proven merge subject. Drop mechanical prefixes only.
  const title = subject
    .replace(/^[\w-]+(?:\([\w-]+\))?:\s*/, '')
    .replace(/\b(?:Merge accepted )?v\d+\.\d+\.\d+\s*[—–:-]?\s*/i, '')
    .replace(/\s*(?:into dev|with latest dev)\b/i, '')
    .replace(/\s*\(#\d+(?:,\s*#\d+)*\)\s*$/, '')
    .trim()
    .slice(0, 130);
  if (!title) return null;
  // No CI, backend/deployment metadata, hashes or internal rollout details in user-facing notes.
  const bullets = (body || '').split(/\r?\n/)
    .map(line => /^-\s+(.+)$/.exec(line)?.[1]?.trim())
    .filter(Boolean)
    .filter(line => !/(?:\b(?:CI|Vercel|SHA|workflow|preview|scratch|Appwrite|schema|migration|test|size gate|bundle|contract|source tree|deployment|build budget)\b|\b[0-9a-f]{12,}\b)/i.test(line))
    .map(line => line.slice(0, 200))
    .slice(0, 3);
  return { tag: 'v' + sourceVersion, title, notes: bullets.length ? bullets.map(x => '- ' + x).join('\n') : '- ' + title };
}

export function formatVersionMilestones(entries) {
  if (!entries.length) return '';
  return [MILESTONE_START, '## Version milestones',
    ...entries.flatMap(entry => ['### ' + entry.tag + ' — ' + entry.title, entry.notes, '']),
    MILESTONE_END].join('\n');
}

export function collectProductionMilestones({ devHead, previousVersion, version }) {
  if (!SHA.test(devHead)) throw new Error('Verified production merge has no valid dev parent');
  parseVersion(previousVersion);
  parseVersion(version);
  // First-parent dev promotions only; excludes task branches, unfinished Previews,
  // and arbitrary commits with version numbers in their titles.
  const log = git('log', '--first-parent', '--merges', '--format=%H%x09%s', '--max-count=600', devHead);
  const candidates = log.split('\n').filter(Boolean).reverse();
  const entries = [];
  const seen = new Set();
  for (const line of candidates) {
    const [sha, ...titleParts] = line.split('\t');
    const subject = titleParts.join('\t');
    const match = /\bv((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\b/.exec(subject);
    if (!match || seen.has(match[1]) ||
        compareVersions(match[1], previousVersion) <= 0 ||
        compareVersions(match[1], version) > 0) continue;
    // Verify the version against the exact historical tree, not the title alone.
    let sourceVersion;
    try {
      sourceVersion = JSON.parse(git('show', sha + ':life-tracker/package.json')).version;
    } catch { continue; }
    if (sourceVersion !== match[1]) continue;
    const body = git('show', '-s', '--format=%b', sha);
    const entry = normalizeMilestone({ sha, subject, body, sourceVersion }, previousVersion, version);
    if (entry) {
      entries.push(entry);
      seen.add(match[1]);
    }
  }
  // A production version without a verified dev promotion gets no fabricated milestone.
  entries.sort((a, b) => compareVersions(b.tag.slice(1), a.tag.slice(1)));
  return entries.slice(0, 60);
}
