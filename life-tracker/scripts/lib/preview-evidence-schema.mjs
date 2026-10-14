const SHA = /^[a-f0-9]{40}$/i;

export function validateBuildEvidence(manifest, expected = {}) {
  if (manifest?.schemaVersion !== 1 ||
      manifest?.kind !== 'non-deployable-ci-build-evidence' ||
      manifest?.deploymentAuthorized !== false) {
    throw new Error('CI build evidence is not a deployment authorization');
  }
  if (!SHA.test(manifest.source?.sha ?? '') ||
      !/^refs\/heads\/(?:main|dev|(?:feature|fix|perf|security|refactor)\/[a-z0-9._/-]+)$/.test(
        manifest.source?.ref ?? '',
      )) throw new Error('Untrusted source identity in CI build evidence');
  if (expected.sha && manifest.source.sha !== expected.sha)
    throw new Error('CI build evidence source SHA mismatch');
  if (expected.ref && manifest.source.ref !== expected.ref)
    throw new Error('CI build evidence source ref mismatch');
  if (!/^[a-f0-9]{64}$/.test(manifest.inventory?.digest ?? '') ||
      !Number.isSafeInteger(manifest.inventory?.count) || manifest.inventory.count < 3 ||
      !/^[a-f0-9]{64}$/.test(manifest.jsCssFingerprint ?? '') ||
      !manifest.metrics || typeof manifest.metrics !== 'object') {
    throw new Error('Incomplete CI build evidence');
  }
  const profile = manifest.buildProfile;
  if (!profile || profile.environment !== 'untrusted-ci-diagnostic' ||
      profile.giphy !== 'enabled' && profile.giphy !== 'disabled' ||
      !Number.isSafeInteger(profile.nodeMajor) || profile.nodeMajor < 20) {
    throw new Error('Untrusted or incomplete CI build profile');
  }
  return manifest;
}
