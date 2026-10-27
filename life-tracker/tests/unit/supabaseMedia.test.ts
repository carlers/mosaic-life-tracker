import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  registerSupabaseMedia, putSupabasePhoto, fetchSupabasePhoto,
  currentSupabaseMediaOwner, supabasePhotoCacheKey,
} from '../../src/lib/supabaseMedia';

const cache = vi.hoisted(() => ({
  get: vi.fn(), put: vi.fn(), delete: vi.fn(),
}));
vi.mock('../../src/lib/imageCache', () => ({
  getCachedImage: cache.get, cacheImage: cache.put, deleteCachedImage: cache.delete,
}));

const OWNER_A = '11111111-1111-4111-8111-111111111111';
const OWNER_B = '22222222-2222-4222-8222-222222222222';
const image = () => new Blob(['private photo data'], { type: 'image/webp' });
let release: (() => void) | undefined;
let current = true;
let nativeOwner = OWNER_A;
let epoch = 1;
const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
  new Response('{}', { status: 201 }));

function register(
  legacyUserId = 'legacy_user_A',
  supabaseUserId = OWNER_A,
  getVerifiedSession: () => Promise<{ userId: string; accessToken: string; sessionEpoch: number } | null> =
    async () => ({ userId: nativeOwner, accessToken: 'signed-test-token', sessionEpoch: epoch }),
) {
  release?.();
  release = registerSupabaseMedia({
    identity: { legacyUserId, supabaseUserId },
    baseUrl: 'https://isolated.test.supabase.co',
    publishableKey: 'sb_publishable_synthetic_test_only',
    getVerifiedSession,
    isCurrent: () => current,
    fetcher: fetcher as unknown as typeof fetch,
  });
}

beforeEach(() => {
  fetcher.mockReset().mockResolvedValue(new Response('{}', { status: 201 }));
  cache.get.mockReset().mockResolvedValue(undefined);
  cache.put.mockReset().mockResolvedValue(undefined);
  cache.delete.mockReset().mockResolvedValue(undefined);
  current = true; nativeOwner = OWNER_A; epoch = 1;
});
afterEach(() => { release?.(); release = undefined; });

describe('Supabase private task and Diary photo adapter', () => {
  it('allows cached offline identity to read only its local blobs, never remote media', async () => {
    cache.get.mockResolvedValue(image());
    release=registerSupabaseMedia({identity:{legacyUserId:'legacy_user_A',supabaseUserId:OWNER_A},
      baseUrl:'https://isolated.test.supabase.co',publishableKey:'sb_publishable_synthetic_test_only',
      getVerifiedSession:async()=>null,isCurrent:()=>current,canUseRemote:()=>false,
      fetcher:fetcher as unknown as typeof fetch});
    expect(await fetchSupabasePhoto('offline')).toBeInstanceOf(Blob);
    expect(cache.get).toHaveBeenCalledWith('supabase:'+OWNER_A+':offline');
    cache.get.mockResolvedValue(undefined);
    expect(await fetchSupabasePhoto('uncached')).toBeNull();
    await expect(putSupabasePhoto(image(),'upload','legacy_user_A')).rejects.toThrow('active signed account');
    expect(fetcher).not.toHaveBeenCalled();
    current=false;
    await expect(fetchSupabasePhoto('offline')).rejects.toThrow('active signed account');
  });
  it('uses a signed owner-UUID path and immutable private WebP upload, never a public URL', async () => {
    register();
    const result = await putSupabasePhoto(image(), 'img_unique', 'legacy_user_A');
    expect(result).toEqual({ fileId: 'img_unique', uploaded: true });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe('https://isolated.test.supabase.co/storage/v1/object/mosaic-personal-photos/' + OWNER_A + '/img_unique.webp');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer signed-test-token', 'x-upsert': 'false',
      'Content-Type': 'image/webp',
    });
    expect(cache.put).toHaveBeenCalledWith('supabase:' + OWNER_A + ':img_unique', expect.any(Blob));
  });

  it('does not authorize a different legacy owner or a forged signed UUID', async () => {
    register();
    await expect(putSupabasePhoto(image(), 'img_a', 'legacy_user_B')).rejects.toThrow(/active signed account/);
    nativeOwner = OWNER_B;
    await expect(putSupabasePhoto(image(), 'img_a', 'legacy_user_A')).rejects.toThrow(/not verified/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('keeps local image caches isolated by Supabase UUID, and signs private downloads', async () => {
    register();
    fetcher.mockResolvedValue(new Response(image(), {
      status: 200, headers: { 'Content-Type': 'image/webp' },
    }));
    expect(await fetchSupabasePhoto('img_same')).toEqual(image());
    expect(String(fetcher.mock.calls[0][0])).toContain('/object/authenticated/mosaic-personal-photos/' + OWNER_A + '/');
    expect(cache.put).toHaveBeenCalledWith('supabase:' + OWNER_A + ':img_same', expect.any(Blob));
    expect(supabasePhotoCacheKey(OWNER_B, 'img_same')).not.toBe(supabasePhotoCacheKey(OWNER_A, 'img_same'));
    current = false;
    await expect(fetchSupabasePhoto('img_same')).rejects.toThrow(/active signed account/);
  });

  it('accepts only the typed missing-object envelope before restoring a new object', async () => {
    register();
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({statusCode:'404',error:'not_found'}),{status:400}))
      .mockResolvedValueOnce(new Response('{}',{status:201}));
    await expect(putSupabasePhoto(image(),'img_new','legacy_user_A',true))
      .resolves.toEqual({fileId:'img_new',uploaded:true});
    expect(fetcher.mock.calls.map(call=>call[1]?.method)).toEqual(['GET','POST']);
    fetcher.mockClear().mockResolvedValue(new Response(JSON.stringify({statusCode:'403',error:'AccessDenied'}),{status:400}));
    await expect(putSupabasePhoto(image(),'img_denied','legacy_user_A',true)).rejects.toThrow('Cannot inspect');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('preserves original photos if existing data differs instead of overwriting', async () => {
    register();
    fetcher.mockResolvedValue(new Response(new Blob(['different'], { type: 'image/webp' }), {
      status: 200, headers: { 'Content-Type': 'image/webp' },
    }));
    await expect(putSupabasePhoto(image(), 'img_repeat', 'legacy_user_A', true))
      .rejects.toThrow(/differs/);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('reuses identical photo bytes on repeat ZIP Merge and does not issue a second write', async () => {
    register();
    fetcher.mockResolvedValue(new Response(image(), {
      status: 200, headers: { 'Content-Type': 'image/webp' },
    }));
    await expect(putSupabasePhoto(image(), 'img_repeat', 'legacy_user_A', true))
      .resolves.toEqual({ fileId: 'img_repeat', uploaded: false });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('rejects an account switch during an upload without acknowledging its result', async () => {
    register();
    let finish!: (response: Response) => void;
    fetcher.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    const uploading = putSupabasePhoto(image(), 'img_race', 'legacy_user_A');
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    current = false;
    finish(new Response('{}', { status: 201 }));
    await expect(uploading).rejects.toThrow(/owner changed/);
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('rejects photos that cannot be safely stored as private WebP', async () => {
    register();
    await expect(putSupabasePhoto(new Blob(['a'], { type: 'text/plain' }), 'img_bad', 'legacy_user_A'))
      .rejects.toThrow(/WebP/);
    await expect(putSupabasePhoto(image(), 'bad/id', 'legacy_user_A'))
      .rejects.toThrow(/identifier/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not silently proceed with a revoked session', async () => {
    register('legacy_user_A', OWNER_A, async () => null);
    await expect(putSupabasePhoto(image(), 'img_new', 'legacy_user_A'))
      .rejects.toThrow(/not verified/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('never exposes an authenticated owner after media registration closes', () => {
    register();
    expect(currentSupabaseMediaOwner()).toBe('legacy_user_A');
    release?.();
    expect(currentSupabaseMediaOwner()).toBeNull();
  });
});
