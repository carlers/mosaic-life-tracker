import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from './appwriteConfig';

export type AppwriteBackendIdentity =
  | 'appwrite-oracle-production'
  | 'appwrite-oracle-scratch'
  | 'appwrite-cloud-production'
  | 'appwrite-cloud-scratch'
  | 'appwrite-custom'
  | 'unknown';

export type SupabaseBackendIdentity =
  | 'supabase-production'
  | 'supabase-scratch'
  | 'supabase-custom'
  | 'unknown';

export type BackendIdentity = AppwriteBackendIdentity | SupabaseBackendIdentity;

type BackendTarget = { projectId: string; endpoint: string };

// The future Supabase adapter must supply its own independently verified targets.
export type VerifiedSupabaseTargets = {
  production?: BackendTarget;
  scratch?: BackendTarget;
};

const ORACLE_PRODUCTION: BackendTarget = {
  projectId: '6ae9599c002ab812f9c3',
  endpoint: 'https://129-221-244-67.sslip.io/v1',
};
const ORACLE_SCRATCH: BackendTarget = {
  projectId: '6ae94a2100014d01f5ed',
  endpoint: 'https://129-221-244-67.sslip.io/v1',
};
// Historical Cloud projects remain recognizable for diagnostics, not as valid
// new official Production or Preview build targets.
const CLOUD_PRODUCTION: BackendTarget = {
  projectId: '6a9703c50016b37110ff',
  endpoint: 'https://sgp.cloud.appwrite.io/v1',
};
const CLOUD_SCRATCH: BackendTarget = {
  projectId: '6a96e82d000d1310b3be',
  endpoint: 'https://fra.cloud.appwrite.io/v1',
};

function normalizeEndpoint(value: string | null | undefined): string {
  return value?.trim().replace(/\/+$/, '').toLowerCase() ?? '';
}

function matchesTarget(id: string, url: string, target: BackendTarget | undefined): boolean {
  return !!target && id === target.projectId && url === normalizeEndpoint(target.endpoint);
}

export function classifyAppwriteBackend(
  projectId: string | null | undefined,
  endpoint: string | null | undefined
): AppwriteBackendIdentity {
  const id = projectId?.trim() ?? '';
  const url = normalizeEndpoint(endpoint);
  if (!id || !url) return 'unknown';
  if (matchesTarget(id, url, ORACLE_PRODUCTION)) return 'appwrite-oracle-production';
  if (matchesTarget(id, url, ORACLE_SCRATCH)) return 'appwrite-oracle-scratch';
  if (matchesTarget(id, url, CLOUD_PRODUCTION)) return 'appwrite-cloud-production';
  if (matchesTarget(id, url, CLOUD_SCRATCH)) return 'appwrite-cloud-scratch';
  return 'appwrite-custom';
}

// Future-only: this must be called by an actual Supabase runtime with verified
// target pairs, never based on Git branch, channel, or a URL substring.
export function classifySupabaseBackend(
  projectId: string | null | undefined,
  endpoint: string | null | undefined,
  verifiedTargets: VerifiedSupabaseTargets
): SupabaseBackendIdentity {
  const id = projectId?.trim() ?? '';
  const url = normalizeEndpoint(endpoint);
  if (!id || !url) return 'unknown';
  if (matchesTarget(id, url, verifiedTargets.production)) return 'supabase-production';
  if (matchesTarget(id, url, verifiedTargets.scratch)) return 'supabase-scratch';
  return 'supabase-custom';
}

// Reflect the active browser SDK configuration, not the Git branch.
export const BACKEND_IDENTITY: BackendIdentity =
  classifyAppwriteBackend(APPWRITE_PROJECT_ID, APPWRITE_ENDPOINT);
