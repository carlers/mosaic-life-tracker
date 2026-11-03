import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from './appwriteConfig';

export type AppwriteBackendIdentity = 'production' | 'scratch' | 'custom' | 'unknown';

const PRODUCTION_PROJECT_ID = '6a9703c50016b37110ff';
const PRODUCTION_ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';
const SCRATCH_PROJECT_ID = '6ae94a2100014d01f5ed';
const SCRATCH_ENDPOINT = 'https://129-221-244-67.sslip.io/v1';
// Older installed Preview PWAs may still use the disposable Cloud Scratch during cutover.
const LEGACY_SCRATCH_PROJECT_ID = '6a96e82d000d1310b3be';
const LEGACY_SCRATCH_ENDPOINT = 'https://fra.cloud.appwrite.io/v1';

export function classifyAppwriteBackend(
  projectId: string | null | undefined,
  endpoint: string | null | undefined
): AppwriteBackendIdentity {
  const id = projectId?.trim();
  const url = endpoint?.trim().replace(/\/+$/, '').toLowerCase();
  if (!id || !url) return 'unknown';
  if (id === PRODUCTION_PROJECT_ID && url === PRODUCTION_ENDPOINT) return 'production';
  if ((id === SCRATCH_PROJECT_ID && url === SCRATCH_ENDPOINT) ||
      (id === LEGACY_SCRATCH_PROJECT_ID && url === LEGACY_SCRATCH_ENDPOINT)) return 'scratch';
  return 'custom';
}

// Reflects the effective browser SDK configuration, not the Git branch name.
export const APPWRITE_BACKEND = classifyAppwriteBackend(APPWRITE_PROJECT_ID, APPWRITE_ENDPOINT);
