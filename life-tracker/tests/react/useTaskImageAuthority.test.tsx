import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useTaskImage, resetTaskImageCacheForTests } from '../../src/hooks/useTaskImage';
import { registerSupabaseMedia } from '../../src/lib/supabaseMedia';

const getImage = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/storage', () => ({ getLocalImageUrl: getImage }));
vi.mock('../../src/lib/coreBackendConfig', () => ({ CORE_BACKEND: { driver: 'supabase' } }));
let release: (() => void) | undefined;
function register(owner = 'ownerA') {
  release?.();
  release = registerSupabaseMedia({
    identity: { legacyUserId: owner, supabaseUserId: '11111111-1111-4111-8111-111111111111' },
    baseUrl: 'https://isolated.test.supabase.co', publishableKey: 'sb_publishable_test',
    isCurrent: () => true, getVerifiedSession: async () => null,
  });
}
beforeEach(() => {
  resetTaskImageCacheForTests();
  getImage.mockReset();
  vi.stubGlobal('URL', class extends URL { static revokeObjectURL = vi.fn(); });
});
afterEach(() => { cleanup(); release?.(); release = undefined; vi.unstubAllGlobals(); });

it('retries a mounted cached-owner image when verified media registration arrives', async () => {
  register();
  getImage.mockResolvedValueOnce(null).mockResolvedValueOnce('blob:verified');
  const { result } = renderHook(() => useTaskImage('photo'));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.imageUrl).toBeNull();
  act(() => register());
  await waitFor(() => expect(result.current.imageUrl).toBe('blob:verified'));
  expect(getImage).toHaveBeenCalledTimes(2);
});

it('does not share an obsolete in-flight acquisition across media authority generations', async () => {
  register();
  let finishOld!: (value: string | null) => void;
  getImage.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockResolvedValueOnce('blob:current');
  const { result } = renderHook(() => useTaskImage('photo'));
  act(() => register());
  await waitFor(() => expect(result.current.imageUrl).toBe('blob:current'));
  await act(async () => finishOld(null));
  expect(result.current.imageUrl).toBe('blob:current');
});

it('drops an old account URL immediately when the media owner changes', async () => {
  register();
  getImage.mockResolvedValueOnce('blob:ownerA').mockImplementationOnce(() => new Promise(() => {}));
  const { result } = renderHook(() => useTaskImage('same_photo'));
  await waitFor(() => expect(result.current.imageUrl).toBe('blob:ownerA'));
  act(() => register('ownerB'));
  expect(result.current.imageUrl).toBeNull();
});
