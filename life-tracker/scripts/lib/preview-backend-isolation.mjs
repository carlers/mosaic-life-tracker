// Fail closed during Vercel Preview builds. The official Mosaic fallback in
// appwriteConfig.ts targets production and must never be used by a Preview.
export const MOSAIC_SCRATCH_PROJECT_ID = '6a96e82d000d1310b3be';
export const MOSAIC_SCRATCH_ENDPOINT = 'https://fra.cloud.appwrite.io/v1';

export function assertPreviewBackendIsolation(env = process.env) {
  if (env.VERCEL_ENV !== 'preview') return null;
  const projectId = String(env.VITE_APPWRITE_PROJECT_ID || '').trim();
  const endpoint = String(env.VITE_APPWRITE_ENDPOINT || '').trim().replace(/\/$/, '');
  if (projectId !== MOSAIC_SCRATCH_PROJECT_ID ||
      endpoint !== MOSAIC_SCRATCH_ENDPOINT) {
    throw new Error(
      'Refusing Mosaic Preview build: explicit VITE_APPWRITE_PROJECT_ID and ' +
      'VITE_APPWRITE_ENDPOINT must target the disposable scratch Appwrite ' +
      'project in fra, not the production fallback. Check Preview-only Vercel env.'
    );
  }
  return { projectId, endpoint };
}
