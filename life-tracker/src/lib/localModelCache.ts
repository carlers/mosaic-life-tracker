/**
 * Browser-only optional ML downloads. A cache namespace belongs to one model,
 * never to the Mosaic PWA, task data, or another model.
 */
export type LocalModelKind = 'whisper' | 'intent';
export const LOCAL_MODEL_CACHE_KEYS: Record<LocalModelKind, string> = {
  whisper: 'mosaic-local-whisper-v1',
  intent: 'mosaic-local-intent-v1',
};

const LEGACY_TRANSFORMERS_CACHE = 'transformers-cache';
const WHISPER_HUB_PATH = '/onnx-community/whisper-tiny.en/resolve/';

/** Remove only model-owned CacheStorage data; never clear Mosaic offline caches. */
export async function deleteLocalModelCache(kind: LocalModelKind): Promise<boolean> {
  if (typeof caches === 'undefined') {
    throw new Error('This browser does not expose model cache management.');
  }
  const removed = await caches.delete(LOCAL_MODEL_CACHE_KEYS[kind]);
  if (kind !== 'whisper') return removed;

  // v0.52.4 used the Transformers.js shared default cache. Migrate safely by
  // removing only the exact previous Whisper model's requests from that cache.
  if (!(await caches.has(LEGACY_TRANSFORMERS_CACHE))) return removed;
  const shared = await caches.open(LEGACY_TRANSFORMERS_CACHE);
  let legacyRemoved = false;
  for (const request of await shared.keys()) {
    const url = new URL(request.url);
    if (url.hostname === 'huggingface.co' && url.pathname.includes(WHISPER_HUB_PATH)) {
      if (await shared.delete(request)) legacyRemoved = true;
    }
  }
  return removed || legacyRemoved;
}
