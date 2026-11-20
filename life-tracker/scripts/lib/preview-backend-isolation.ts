// Fail closed during Vercel Preview builds. The official Mosaic fallback in
// appwriteConfig.ts targets production and must never be used by a Preview.
export const MOSAIC_SCRATCH_PROJECT_ID = '6ae94a2100014d01f5ed';
export const MOSAIC_SCRATCH_ENDPOINT = 'https://129-221-244-67.sslip.io/v1';
// Separate Vercel application, never an override on normal Preview/Dev.
export const MOSAIC_E2EE_LAB_PROJECT_ID = '6b00671500279e901846';
export const MOSAIC_E2EE_LAB_VERCEL_PROJECT_ID = 'prj_O7svU9O5nN9AkKaCdKkwjud3Gk05';
export const MOSAIC_E2EE_LAB_FUNCTION_ID = 'message_action';
const LAB_SOURCE_BRANCHES = new Set([
  'security/1662-e2ee-foundation-v01140-20261119',
  'chatgpt/1662-isolated-lab-bootstrap-20261120',
]);
export const MOSAIC_PRODUCTION_PROJECT_ID = '6ae9599c002ab812f9c3';
export const MOSAIC_PRODUCTION_ENDPOINT = 'https://129-221-244-67.sslip.io/v1';
export const MOSAIC_PRODUCTION_FUNCTION_ID = '6aa8057f002a4c306fdd';

export function assertPreviewBackendIsolation(env = process.env) {
  if (env.VERCEL_ENV !== 'preview') return null;
  const projectId = String(env.VITE_APPWRITE_PROJECT_ID || '').trim();
  const endpoint = String(env.VITE_APPWRITE_ENDPOINT || '').trim().replace(/\/$/, '');
  const functionId = String(env.VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID || '').trim();
  const labMarker = String(env.MOSAIC_E2EE_LAB_VERCEL_PROJECT_ID || '').trim();
  if (labMarker) {
    if (labMarker !== MOSAIC_E2EE_LAB_VERCEL_PROJECT_ID ||
        (env.VERCEL_PROJECT_ID && env.VERCEL_PROJECT_ID !== labMarker) ||
        projectId !== MOSAIC_E2EE_LAB_PROJECT_ID ||
        endpoint !== MOSAIC_SCRATCH_ENDPOINT ||
        functionId !== MOSAIC_E2EE_LAB_FUNCTION_ID ||
        !LAB_SOURCE_BRANCHES.has(String(env.VERCEL_GIT_COMMIT_REF || ''))) {
      throw new Error('Refusing Mosaic E2EE Lab Preview build: exact dedicated Vercel project marker, Scratch backend, source branch, and Function ID required.');
    }
    return { projectId, endpoint };
  }
  if (projectId !== MOSAIC_SCRATCH_PROJECT_ID ||
      endpoint !== MOSAIC_SCRATCH_ENDPOINT || !functionId) {
    throw new Error(
      'Refusing Mosaic Preview build: explicit VITE_APPWRITE_PROJECT_ID and ' +
      'VITE_APPWRITE_ENDPOINT must target the disposable scratch Appwrite ' +
      'project on Oracle, with an explicit scratch Function ID, not the production fallback. Check Preview-only Vercel env.'
    );
  }
  return { projectId, endpoint };
}

export function assertProductionBackendIsolation(env = process.env) {
  if (env.VERCEL_ENV !== 'production') return null;
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
