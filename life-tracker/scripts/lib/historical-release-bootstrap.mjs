import { compareVersions } from './versioning.mjs';
import { decidePublication } from './production-release.mjs';

// Immutable, audited historical production release. Do not infer/backdate any other versions.
export const FIRST_PRODUCTION_RELEASE = Object.freeze({
  version: '0.12.1',
  sha: '95c8b25edeba5e2730252f6d265d392949890caa',
  priorVersion: '0.6.2',
  promotionPr: 505,
  deploymentStatusUrl:
    'https://vercel.com/carls-projects-72516fde/mosaic-life-tracker/7fPghDwB9z2dvW7w2rCwHB8zmZCY',
});

export const FIRST_PRODUCTION_NOTES = [
  '- **Release history:** Browse official production releases and expanded notes from Settings, with offline caching.',
  '- **Navigation and motion:** Animated pages, Android/Escape Back, improved chat and trackpad gestures, and a Reduce animations preference.',
  '- **Task productivity:** Completion-status sorting, bulk copying selected tasks, easier completion and reordering.',
  '- **Profile, messaging and Settings:** One Display Name editor, corrected message context actions, clearer Settings and improved dark-mode task contrast.',
  '- **Reliability:** Stronger interaction, routing and browser checks while respecting PWA/startup budgets.',
].join('\n');

export function historicalBootstrapDecision({
  currentVersion, previousVersion, mergeBaseSha, taggedSha, existingRelease, publishedVersions,
}) {
  const historical = FIRST_PRODUCTION_RELEASE;
  if (currentVersion !== historical.version || previousVersion !== historical.version) {
    return 'not-applicable';
  }
  if (mergeBaseSha !== historical.sha) {
    throw new Error('Historical release is not an ancestor of current production main');
  }
  if (existingRelease && !taggedSha) {
    throw new Error('Published historical Release has no resolvable Git tag');
  }
  for (const publishedVersion of publishedVersions) {
    if (compareVersions(publishedVersion, historical.version) > 0) {
      throw new Error('Refusing to backdate the initial release after newer public Releases');
    }
  }
  return decidePublication({
    version: historical.version,
    priorVersion: null,
    currentSha: historical.sha,
    mainSha: historical.sha,
    taggedSha,
    existingRelease,
  });
}

export function assertHistoricalProof({ pr, run, statuses, oldVersion, releasedVersion }) {
  const historical = FIRST_PRODUCTION_RELEASE;
  if (oldVersion !== historical.priorVersion || releasedVersion !== historical.version) {
    throw new Error('Historical release source version or previous production version differs');
  }
  if (!pr || pr.number !== historical.promotionPr || pr.merged !== true ||
      pr.merge_commit_sha !== historical.sha || pr.base?.ref !== 'main') {
    throw new Error('Historical production promotion PR provenance is invalid');
  }
  if (!run?.check_runs?.some(x =>
    x.name === 'canonical-acceptance' && x.conclusion === 'success' &&
    x.head_sha === historical.sha && x.app?.slug === 'github-actions')) {
    throw new Error('Historical release has no successful canonical main CI');
  }
  const status = statuses?.find(x => x.context === 'Vercel');
  if (status?.state !== 'success' || status.target_url !== historical.deploymentStatusUrl) {
    throw new Error('Historical release Vercel production deployment proof is missing');
  }
}
