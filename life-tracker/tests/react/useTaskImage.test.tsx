import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTaskImage } from '../../src/hooks/useTaskImage';

// ---------------------------------------------------------------------------
// Module mocks
//
// The hook imports `getLocalImageUrl` from `src/lib/storage.ts`. That module
// touches IndexedDB and Appwrite Storage; neither belongs in a hook-contract
// test. The mock is deterministic per fileId so the shared-URL assertion
// (two hook instances with the same fileId) is meaningful.
// ---------------------------------------------------------------------------

const mockGetLocalImageUrl = vi.hoisted(() => vi.fn());

vi.mock('../../src/lib/storage', () => ({
  getLocalImageUrl: mockGetLocalImageUrl,
}));

// ---------------------------------------------------------------------------
// URL.revokeObjectURL mocking
//
// happy-dom does not reliably implement `URL.revokeObjectURL`. The hook calls
// it from a deferred eviction timer, so we (a) ensure the property exists so
// the hook never throws, and (b) capture calls so we can assert on the
// deferred-revoke contract.
//
// `URL.createObjectURL` is not mocked because the hook never calls it — the
// mocked `getLocalImageUrl` returns a plain string.
//
// NOTE: The deferred-revoke test hardcodes 1500ms, mirroring `REVOKE_DELAY_MS`
// in `src/hooks/useTaskImage.ts`. If that constant changes, the test breaks
// even though behavior is preserved. The constant is module-private and not
// exported; coupling is preferable to weakening the assertion.
//
// NOTE: The hook maintains a module-level `objectUrlCache` keyed by fileId,
// with entries that survive between tests until their eviction timer fires.
// Every test uses a unique fileId so no test can observe another test's cache.
// ---------------------------------------------------------------------------

const originalRevoke = globalThis.URL.revokeObjectURL;
const revokeSpy = vi.fn();

describe('useTaskImage', () => {
  beforeEach(() => {
    mockGetLocalImageUrl.mockReset();
    mockGetLocalImageUrl.mockImplementation(
      async (fileId: string) => `blob:fake-${fileId}`
    );
    revokeSpy.mockReset();
    globalThis.URL.revokeObjectURL = revokeSpy;
  });

  afterEach(() => {
    // Any test that toggled fake timers must release them before the next
    // test runs, or subsequent `waitFor` calls will hang.
    vi.useRealTimers();
  });

  afterAll(() => {
    if (originalRevoke) {
      globalThis.URL.revokeObjectURL = originalRevoke;
    } else {
      // happy-dom did not implement it originally. Remove our stub so a
      // subsequent test file in the same worker sees an accurate shape.
      delete (globalThis.URL as unknown as Record<string, unknown>)
        .revokeObjectURL;
    }
  });

  it('loading: starts true, becomes false with the resolved URL', async () => {
    const { result } = renderHook(() => useTaskImage('file_loading_test'));

    // First render: no cache entry, so the hook is in the loading state.
    expect(result.current.isLoading).toBe(true);
    expect(result.current.imageUrl).toBeNull();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.imageUrl).toBe('blob:fake-file_loading_test');
  });

  it('shared URL: two hooks with the same fileId fetch once and share the result', async () => {
    // Regression: §16 (Calendar Rendering Pipeline — useTaskImage shares
    // object URLs across hook instances via a ref-counted module cache).
    const a = renderHook(() => useTaskImage('file_shared_test'));
    const b = renderHook(() => useTaskImage('file_shared_test'));

    await waitFor(() => {
      expect(a.result.current.imageUrl).not.toBeNull();
      expect(b.result.current.imageUrl).not.toBeNull();
    });

    expect(a.result.current.imageUrl).toBe('blob:fake-file_shared_test');
    expect(b.result.current.imageUrl).toBe('blob:fake-file_shared_test');

    // The module-level promise cache means the second instance must not
    // re-invoke the fetcher.
    expect(mockGetLocalImageUrl).toHaveBeenCalledTimes(1);
    expect(mockGetLocalImageUrl).toHaveBeenCalledWith('file_shared_test');
  });

  it('deferred revoke: URL is not revoked until both instances unmount and 1.5s elapses', async () => {
    // Regression: §16 (useTaskImage shares object URLs across hook instances).
    const a = renderHook(() => useTaskImage('file_revoke_test'));
    const b = renderHook(() => useTaskImage('file_revoke_test'));

    await waitFor(() => {
      expect(a.result.current.imageUrl).not.toBeNull();
      expect(b.result.current.imageUrl).not.toBeNull();
    });

    // Switch to fake timers only after the async URL resolution completed
    // under real timers — otherwise `waitFor` above would deadlock.
    vi.useFakeTimers();
    try {
      // First unmount: refCount 2 → 1. No eviction scheduled.
      act(() => {
        a.unmount();
      });
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(revokeSpy).not.toHaveBeenCalled();

      // Second unmount: refCount 1 → 0. Eviction timer scheduled.
      act(() => {
        b.unmount();
      });

      // Advance past REVOKE_DELAY_MS (1500ms in the hook).
      act(() => {
        vi.advanceTimersByTime(1600);
      });

      expect(revokeSpy).toHaveBeenCalledTimes(1);
      expect(revokeSpy).toHaveBeenCalledWith('blob:fake-file_revoke_test');
    } finally {
      vi.useRealTimers();
    }
  });

  it('empty fileId: returns null with isLoading false and does not fetch', async () => {
    const { result } = renderHook(() => useTaskImage(''));

    expect(result.current.imageUrl).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(mockGetLocalImageUrl).not.toHaveBeenCalled();
  });
});
