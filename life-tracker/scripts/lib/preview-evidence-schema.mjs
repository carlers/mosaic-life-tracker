const SHA = /^[a-f0-9]{40}$/i;

export function validateBuildEvidence(manifest, expected = {}) {
  if (manifest?.schemaVersion !== 1 ||
      manifest?.kind !== 'non-deployable-ci-build-evidence' ||
      manifest?.deploymentAuthorized !== false) {
    throw new Error('CI build evidence is not a deployment authorization');
  }
  // All CI evidence remains NON-deployable. Quiet AI task branches can
  // diagnose the full build; protected main independently rejects AI refs
  // before considering any provider creation or artifact authentication.
  const sourceRef = manifest.source?.ref ?? '';
  const stable = /^refs\/heads\/(?:main|dev|(?:feature|fix|perf|security|refactor)\/[a-z0-9._/-]+)$/.test(sourceRef);
  const diagnostic = /^refs\/heads\/(?:chatgpt|codex)\/[a-z0-9][a-z0-9._/-]*$/.test(sourceRef) &&
    !sourceRef.includes('//') && !sourceRef.includes('..') && !sourceRef.endsWith('/');
  if (!SHA.test(manifest.source?.sha ?? '') || (!stable && !diagnostic))
    throw new Error('Untrusted source identity in CI build evidence');
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
  if (profile.backend === 'supabase-cloud' &&
      (profile.vercelEnvironment !== 'preview' || profile.appwriteBackend !== 'none' ||
       !['core-only', 'core-diary'].includes(profile.featureProfile) ||
       profile.supabaseOrigin !== 'https://hcxtiifzxoaflhjgoglb.supabase.co' ||
       !/^[a-f0-9]{64}$/.test(profile.publishableKeySha256 ?? ''))) {
    throw new Error('Incomplete isolated Supabase Preview build profile');
  }
  return manifest;
}
