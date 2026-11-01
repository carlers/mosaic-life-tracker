import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteLocalModelCache, LOCAL_MODEL_CACHE_KEYS } from '../../src/lib/localModelCache';

const originalCaches = globalThis.caches;
afterEach(() => { Object.defineProperty(globalThis, 'caches', { configurable: true, value: originalCaches }); });

describe('optional downloaded model deletion', () => {
  it('deletes only the designated AI model namespace, not Whisper/PWA caches', async () => {
    const del = vi.fn(async () => true);
    Object.defineProperty(globalThis, 'caches', { configurable: true, value: { delete: del } });
    expect(await deleteLocalModelCache('intent')).toBe(true);
    expect(del).toHaveBeenCalledExactlyOnceWith(LOCAL_MODEL_CACHE_KEYS.intent);
  });

  it('deletes Whisper namespace and only legacy Whisper requests', async () => {
    const keep = new Request('https://huggingface.co/other/model/resolve/main/file');
    const remove = new Request('https://huggingface.co/onnx-community/whisper-tiny.en/resolve/revision/model.onnx');
    const mimic = new Request('https://attacker.example/onnx-community/whisper-tiny.en/resolve/main/file');
    const deleteEntry = vi.fn(async () => true);
    const del = vi.fn(async () => true);
    Object.defineProperty(globalThis, 'caches', { configurable: true, value: {
      delete: del, has: async () => true,
      open: async () => ({ keys: async () => [keep, remove, mimic], delete: deleteEntry }),
    } });
    expect(await deleteLocalModelCache('whisper')).toBe(true);
    expect(del).toHaveBeenCalledExactlyOnceWith(LOCAL_MODEL_CACHE_KEYS.whisper);
    expect(deleteEntry).toHaveBeenCalledExactlyOnceWith(remove);
  });

  it('reports missing model without deleting app storage', async () => {
    const del = vi.fn(async () => false);
    Object.defineProperty(globalThis, 'caches', { configurable: true, value: {
      delete: del, has: async () => false,
    } });
    expect(await deleteLocalModelCache('whisper')).toBe(false);
    expect(del).toHaveBeenCalledTimes(1);
  });
});
