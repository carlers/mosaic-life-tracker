import { APP_VERSION } from './appVersion';
import { APPWRITE_BACKEND } from './appwriteBackendIdentity';
import { CORE_BACKEND } from './coreBackendConfig';

export type AppBuildChannel = 'Preview' | 'Production' | 'Local';

type EmbeddedBuildInfo = {
  commit: string | null;
  commitMessage: string | null;
  branch: string | null;
  builtAt: string | null;
  channel: AppBuildChannel;
};

export function parseEmbeddedBuildInfo(
  value: string | null | undefined
): EmbeddedBuildInfo | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as EmbeddedBuildInfo | null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** Reflects the effective browser provider/installation, not the Git branch. */
export function classifyBuildBackend(
  provider: string | undefined,
  appwrite: string,
  channel: AppBuildChannel,
  supabaseOrigin?: string,
): string {
  if (provider === 'supabase-cloud') {
    return supabaseOrigin === 'https://hcxtiifzxoaflhjgoglb.supabase.co'
      ? 'supabase/scratch' : 'supabase/unknown';
  }
  if (provider === 'appwrite-oracle') {
    return 'appwrite-oracle/' + (channel === 'Production' ? 'production' :
      channel === 'Preview' ? 'scratch' : 'unknown');
  }
  return 'appwrite-cloud/' + appwrite;
}

const embedded =
  typeof document === 'undefined'
    ? null
    : parseEmbeddedBuildInfo(
        document.querySelector<HTMLMetaElement>(
          'meta[name="mosaic-build-info"]'
        )?.content
      );
const commit = embedded?.commit || null;

export const APP_BUILD_INFO = Object.freeze({
  version: APP_VERSION,
  appwrite: APPWRITE_BACKEND,
  backend: classifyBuildBackend(
    CORE_BACKEND.driver === 'supabase' ? 'supabase-cloud' : import.meta.env.VITE_MOSAIC_BACKEND,
    APPWRITE_BACKEND, embedded?.channel || 'Local',
    CORE_BACKEND.driver === 'supabase' ? CORE_BACKEND.baseUrl : undefined,
  ),
  buildId: commit ?? 'local',
  commit,
  commitShort: commit ? commit.slice(0, 8) : null,
  commitMessage: embedded?.commitMessage || null,
  branch: embedded?.branch || null,
  builtAt: embedded?.builtAt || null,
  channel: embedded?.channel || 'Local',
});
