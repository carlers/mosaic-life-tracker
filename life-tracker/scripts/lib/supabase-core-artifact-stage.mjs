/**
 * Source-only isolated Supabase CI artifact identity checks.
 *
 * This NEVER makes an artifact deployable or replaces trusted external
 * canonical/hosted GitHub acceptance or Vercel/SSO provenance checks.
 */
export const CORE_ARTIFACT_ENTRIES = Object.freeze([
  'config.json', 'dist.tar.gz', 'dist.tar.gz.sha256',
  'evidence.json', 'inventory.json', 'routing-evidence.json',
]);

const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
export const CORE_BRANCH = 'feature/1027-supabase-recovery-20261020';
export const CORE_SUPABASE_ORIGIN = 'https://hcxtiifzxoaflhjgoglb.supabase.co';
export const CORE_VERCEL_PROJECT = 'prj_jysOLDbuO9c5rP8x6Q145DVIw0fc';
export const CORE_VERCEL_TEAM = 'team_UbpudOr8jXyrDA5SdVUxVGOr';

export function assertExactCoreArtifact({ sha, zipDigest, entries, evidence }) {
  if (!SHA.test(sha ?? '') || !DIGEST.test(zipDigest ?? ''))
    throw Error('Accepted exact SHA and GitHub artifact ZIP digest required');
  if (!Array.isArray(entries) || entries.length !== CORE_ARTIFACT_ENTRIES.length ||
      entries.some((name, i) => name !== CORE_ARTIFACT_ENTRIES[i]))
    throw Error('Unexpected or missing Supabase artifact ZIP entry');
  if (evidence?.kind !== 'non-deployable-ci-build-evidence' ||
      evidence.schemaVersion !== 1 || evidence.deploymentAuthorized !== false ||
      evidence.source?.sha !== sha ||
      evidence.source?.ref !== 'refs/heads/' + CORE_BRANCH)
    throw Error('Supabase artifact source/CI provenance mismatch');
  const profile = evidence.buildProfile;
  if (profile?.environment !== 'untrusted-ci-diagnostic' ||
      profile.vercelEnvironment !== 'preview' ||
      profile.backend !== 'supabase-cloud' ||
      profile.featureProfile !== 'core-diary' ||
      profile.appwriteBackend !== 'none' ||
      profile.supabaseOrigin !== CORE_SUPABASE_ORIGIN ||
      profile.giphy !== 'disabled' || profile.posthog !== 'disabled' ||
      !DIGEST.test(profile.publishableKeySha256 ?? ''))
    throw Error('Supabase core artifact has an unexpected provider/feature profile');
  return { sha, ref: evidence.source.ref };
}
