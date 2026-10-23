/**
 * #1027 — private, signed Supabase task/Diary media, never social or public URLs.
 * File IDs remain portable Mosaic IDs; the Storage object path uses the verified
 * Supabase Auth UUID, NOT the user-controlled/legacy RxDB owner ID.
 */
import { cacheImage, deleteCachedImage, getCachedImage } from './imageCache';
import type { CandidateIdentity } from '../../supabase-poc/candidateMapping';
import { validateCandidateIdentity } from '../../supabase-poc/candidateMapping';

export const SUPABASE_PERSONAL_PHOTOS_BUCKET = 'mosaic-personal-photos';
const FILE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
type VerifiedSession = { userId: string; accessToken: string; sessionEpoch: number };
export type SupabaseMediaBinding = {
  identity: CandidateIdentity;
  baseUrl: string;
  publishableKey: string;
  getVerifiedSession: () => Promise<VerifiedSession | null>;
  isCurrent: () => boolean;
  fetcher?: typeof fetch;
};

let binding: SupabaseMediaBinding | null = null;

export function registerSupabaseMedia(next: SupabaseMediaBinding): () => void {
  validateCandidateIdentity(next.identity);
  const url = new URL(next.baseUrl);
  if (url.username || url.password || url.search || url.hash ||
      url.pathname !== '/' || !['https:', 'http:'].includes(url.protocol) ||
      (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) ||
      !next.publishableKey.startsWith('sb_publishable_')) {
    throw new Error('Supabase photo storage requires the explicit verified backend');
  }
  binding = next;
  return () => { if (binding === next) binding = null; };
}

export function currentSupabaseMediaOwner(): string | null {
  return binding?.isCurrent() ? binding.identity.legacyUserId : null;
}

function context(expectedOwner?: string) {
  const current = binding;
  if (!current || !current.isCurrent() ||
      (expectedOwner !== undefined && expectedOwner !== current.identity.legacyUserId))
    throw new Error('Supabase photo access requires the active signed account');
  return current;
}

export function supabasePhotoCacheKey(ownerUuid: string, fileId: string): string {
  if (!FILE_ID.test(fileId)) throw new Error('Invalid photo identifier');
  return 'supabase:' + ownerUuid + ':' + fileId;
}

function objectPath(current: SupabaseMediaBinding, fileId: string) {
  if (!FILE_ID.test(fileId)) throw new Error('Invalid photo identifier');
  return current.identity.supabaseUserId + '/' + fileId + '.webp';
}

async function signedRequest(current: SupabaseMediaBinding, fileId: string, method: 'GET' | 'POST' | 'DELETE', blob?: Blob) {
  if (binding !== current || !current.isCurrent()) throw new Error('Supabase photo owner changed');
  const signed = await current.getVerifiedSession();
  if (!signed || signed.userId !== current.identity.supabaseUserId ||
      !current.isCurrent() || binding !== current)
    throw new Error('Supabase photo session was not verified');
  const path = objectPath(current, fileId).split('/').map(encodeURIComponent).join('/');
  const endpoint = method === 'GET'
    ? '/storage/v1/object/authenticated/' : '/storage/v1/object/';
  const url = new URL(endpoint + SUPABASE_PERSONAL_PHOTOS_BUCKET + '/' + path, current.baseUrl);
  const fetcher = current.fetcher ?? fetch;
  const response = await fetcher(url.toString(), {
    method,
    credentials: 'omit', cache: 'no-store', redirect: 'error',
    headers: {
      apikey: current.publishableKey,
      Authorization: 'Bearer ' + signed.accessToken,
      ...(blob ? { 'Content-Type': 'image/webp', 'x-upsert': 'false' } : {}),
    },
    ...(blob ? { body: blob } : {}),
  });
  if (binding !== current || !current.isCurrent()) throw new Error('Supabase photo owner changed');
  const after = await current.getVerifiedSession();
  if (!after || after.userId !== signed.userId ||
      after.sessionEpoch !== signed.sessionEpoch || binding !== current ||
      !current.isCurrent()) throw new Error('Supabase photo session changed');
  return response;
}

async function sameBytes(a: Blob, b: Blob) {
  if (a.size !== b.size) return false;
  const [left, right] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  const other = new Uint8Array(right);
  return new Uint8Array(left).every((v, i) => v === other[i]);
}

export async function putSupabasePhoto(blob: Blob, fileId: string, legacyOwner: string, ensureExisting = false): Promise<{ fileId: string; uploaded: boolean }> {
  const current = context(legacyOwner);
  if (!blob.size || blob.size > MAX_PHOTO_BYTES || blob.type !== 'image/webp')
    throw new Error('Supabase photos must be compressed WebP under 5 MB');
  if (ensureExisting) {
    const existing = await signedRequest(current, fileId, 'GET');
    if (existing.ok) {
      const stored = await existing.blob();
      if (binding !== current || !current.isCurrent() || !(await sameBytes(blob, stored)))
        throw new Error('Existing private photo differs from the backup');
      return { fileId, uploaded: false };
    }
    if (existing.status !== 404) throw new Error('Cannot inspect existing private photo');
  }
  const response = await signedRequest(current, fileId, 'POST', blob);
  if (!response.ok) {
    // Concurrent identical backup restores may safely converge; no upsert ever.
    if (ensureExisting && response.status === 409) {
      const check = await signedRequest(current, fileId, 'GET');
      if (check.ok && await sameBytes(blob, await check.blob()))
        return { fileId, uploaded: false };
    }
    throw new Error('Supabase private photo upload failed (' + response.status + ')');
  }
  if (binding !== current || !current.isCurrent()) throw new Error('Supabase photo owner changed');
  await cacheImage(supabasePhotoCacheKey(current.identity.supabaseUserId, fileId), blob).catch(() => {});
  return { fileId, uploaded: true };
}

export async function fetchSupabasePhoto(fileId: string, refreshFromCloud = false): Promise<Blob | null> {
  const current = context();
  const key = supabasePhotoCacheKey(current.identity.supabaseUserId, fileId);
  const cached = refreshFromCloud ? undefined : await getCachedImage(key).catch(() => undefined);
  if (binding !== current || !current.isCurrent()) return null;
  if (cached) return cached;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  const response = await signedRequest(current, fileId, 'GET');
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Private photo download denied (' + response.status + ')');
  const blob = await response.blob();
  if (!blob.size || blob.size > MAX_PHOTO_BYTES ||
      (blob.type && blob.type !== 'image/webp') ||
      binding !== current || !current.isCurrent()) throw new Error('Invalid private photo download');
  await cacheImage(key, blob).catch(() => {});
  return blob;
}

export async function deleteSupabasePhoto(fileId: string): Promise<void> {
  const current = context();
  const response = await signedRequest(current, fileId, 'DELETE');
  if (!response.ok && response.status !== 404)
    throw new Error('Private photo deletion denied (' + response.status + ')');
  await deleteCachedImage(supabasePhotoCacheKey(current.identity.supabaseUserId, fileId));
}
