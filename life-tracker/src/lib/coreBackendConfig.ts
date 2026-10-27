export type CoreBackendConfig =
  | { driver: 'appwrite' }
  | { driver: 'supabase'; baseUrl: string; publishableKey: string };

/** This candidate may target only the disposable lab or reviewed mosaic-dev. */
export function resolveCoreBackendConfig(env: Record<string, unknown>): CoreBackendConfig {
  const selected = env.VITE_MOSAIC_BACKEND;
  if (!selected || selected === 'appwrite-cloud' || selected === 'appwrite-oracle')
    return { driver: 'appwrite' };
  if (selected !== 'supabase-cloud' ||
      !['core-only', 'core-diary', 'personal'].includes(String(env.VITE_MOSAIC_FEATURE_PROFILE)))
    throw new Error('Supabase requires an explicit core-only or core-diary backend selection');
  const url = new URL(String(env.VITE_SUPABASE_URL ?? ''));
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if ((!local && url.origin !== 'https://hcxtiifzxoaflhjgoglb.supabase.co') ||
      !['http:', 'https:'].includes(url.protocol) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/')
    throw new Error('Core candidate requires the isolated Supabase development project or loopback');
  const publishableKey = String(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '');
  if (!/^sb_publishable_\S+$/.test(publishableKey))
    throw new Error('Core candidate requires a public Supabase publishable key');
  return { driver: 'supabase', baseUrl: url.origin, publishableKey };
}

export const CORE_BACKEND = resolveCoreBackendConfig(import.meta.env);

/** Separate installations cannot share local rows or replication checkpoints. */
export function coreDatabaseName(): string {
  if (CORE_BACKEND.driver === 'appwrite') return 'life_tracker_db';
  return 'life_tracker_supabase_' + Array.from(CORE_BACKEND.baseUrl)
    .map(character => character.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}
