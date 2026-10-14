// Browser-public build profile gate. Never print credentials or literal feature values.
// Only the #592 canary stable branch is mandatory until the rollout is reviewed.
const CANARY = 'refs/heads/fix/592-trusted-archive-20261014';
const SCRATCH = '6a96e82d000d1310b3be';
const ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
const SHA = /^[0-9a-f]{40}$/i;
const has = value => typeof value === 'string' && value.trim().length > 0;
const httpsUrl = value => {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash; }
  catch { return false; }
};

export function assessPublicPreviewBuild(env, { mandatoryRef = CANARY } = {}) {
  const ref = env.GITHUB_REF ?? '';
  const isMain = ref === 'refs/heads/main';
  const isCanary = ref === mandatoryRef;
  const reasons = [];
  if (!SHA.test(env.GITHUB_SHA ?? '') ||
      env.VERCEL_GIT_COMMIT_SHA !== env.GITHUB_SHA ||
      env.VERCEL_GIT_COMMIT_REF !== ref.replace(/^refs\/heads\//, '')) {
    reasons.push('source SHA/branch not bound to the build');
  }
  const preview = !isMain;
  if (env.VERCEL_ENV !== (preview ? 'preview' : 'production')) {
    reasons.push('incorrect build target');
  }
  if (preview) {
    if (env.VITE_APPWRITE_PROJECT_ID !== SCRATCH ||
        env.VITE_APPWRITE_ENDPOINT !== ENDPOINT ||
        !has(env.VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID)) {
      reasons.push('Scratch backend is not explicit');
    }
  } else if (!has(env.VITE_APPWRITE_PROJECT_ID) || env.VITE_APPWRITE_PROJECT_ID === SCRATCH) {
    reasons.push('exact main Production backend is not explicit');
  }
  const giphy = has(env.VITE_GIPHY_API_KEY);
  const posthog = has(env.VITE_POSTHOG_TOKEN) && httpsUrl(env.VITE_POSTHOG_HOST);
  if (isCanary && !giphy) reasons.push('GIPHY browser-public Preview input absent');
  if (isCanary && !posthog) reasons.push('PostHog browser-public Preview inputs absent/invalid');
  return { eligible: reasons.length === 0, mandatory: isCanary, reasons,
    preview, giphy: giphy ? 'enabled' : 'disabled', posthog: posthog ? 'enabled' : 'disabled' };
}
