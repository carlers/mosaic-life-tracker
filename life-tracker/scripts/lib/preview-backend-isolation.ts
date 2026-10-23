// Fail closed during Vercel Preview builds. The official Mosaic fallback in
// appwriteConfig.ts targets production and must never be used by a Preview.
export const MOSAIC_SCRATCH_PROJECT_ID = '6a96e82d000d1310b3be';
export const MOSAIC_SCRATCH_ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
export const MOSAIC_PRODUCTION_PROJECT_ID = '6a9703c50016b37110ff';
export const MOSAIC_PRODUCTION_ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';
export const MOSAIC_PRODUCTION_FUNCTION_ID = '6aa8057f002a4c306fdd';
export const MOSAIC_SUPABASE_DEV_ORIGIN = 'https://hcxtiifzxoaflhjgoglb.supabase.co';

export function assertPreviewBackendIsolation(env = process.env) {
  if (env.VERCEL_ENV !== 'preview') return null;
  if (env.VITE_MOSAIC_BACKEND === 'supabase-cloud') {
    if (env.MOSAIC_SUPABASE_CORE_PREVIEW !== 'true' ||
        !['core-only', 'core-diary'].includes(env.VITE_MOSAIC_FEATURE_PROFILE ?? '') ||
        env.VITE_SUPABASE_URL !== MOSAIC_SUPABASE_DEV_ORIGIN ||
        !/^sb_publishable_[A-Za-z0-9_-]+$/.test(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '')) {
      throw new Error('Refusing Mosaic Preview build: isolated core-only/core-diary mosaic-dev Supabase configuration required.');
    }
    return { backend: 'supabase-cloud' as const,
      projectId: 'hcxtiifzxoaflhjgoglb', endpoint: MOSAIC_SUPABASE_DEV_ORIGIN };
  }
  if (env.VITE_MOSAIC_BACKEND && env.VITE_MOSAIC_BACKEND !== 'appwrite-cloud')
    throw new Error('Refusing Mosaic Preview build: unsupported backend.');
  const projectId = String(env.VITE_APPWRITE_PROJECT_ID || '').trim();
  const endpoint = String(env.VITE_APPWRITE_ENDPOINT || '').trim().replace(/\/$/, '');
  const functionId = String(env.VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID || '').trim();
  if (projectId !== MOSAIC_SCRATCH_PROJECT_ID ||
      endpoint !== MOSAIC_SCRATCH_ENDPOINT || !functionId) {
    throw new Error(
      'Refusing Mosaic Preview build: explicit VITE_APPWRITE_PROJECT_ID and ' +
      'VITE_APPWRITE_ENDPOINT must target the disposable scratch Appwrite ' +
      'project in fra, with an explicit scratch Function ID, not the production fallback. Check Preview-only Vercel env.'
    );
  }
  return { projectId, endpoint };
}

export function assertProductionBackendIsolation(env = process.env) {
  if (env.VERCEL_ENV !== 'production') return null;
  if (env.VITE_MOSAIC_BACKEND && env.VITE_MOSAIC_BACKEND !== 'appwrite-cloud')
    throw new Error('Refusing Mosaic Production build: candidate backends are Preview-only.');
  // Official production may intentionally use the checked-in production fallback.
  // An explicit override must never silently redirect official main to scratch.
  const projectId = String(env.VITE_APPWRITE_PROJECT_ID || MOSAIC_PRODUCTION_PROJECT_ID).trim();
  const endpoint = String(env.VITE_APPWRITE_ENDPOINT || MOSAIC_PRODUCTION_ENDPOINT).trim().replace(/\/+$/, '');
  const functionId = String(env.VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID || MOSAIC_PRODUCTION_FUNCTION_ID).trim();
  if (projectId !== MOSAIC_PRODUCTION_PROJECT_ID ||
      endpoint !== MOSAIC_PRODUCTION_ENDPOINT ||
      functionId !== MOSAIC_PRODUCTION_FUNCTION_ID) {
    throw new Error('Refusing Mosaic Production build: explicit Appwrite overrides must match the approved production project, region, and message-action Function.');
  }
  return { projectId, endpoint, functionId };
}
