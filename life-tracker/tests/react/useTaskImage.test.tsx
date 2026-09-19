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
import {
  useTaskImage,
  resetTaskImageCacheForTests,
} from '../../src/hooks/useTaskImage';

const mockGetLocalImageUrl = vi.hoisted(() => vi.fn());

vi.mock('../../src/lib/storage', () => ({
  getLocalImageUrl: mockGetLocalImageUrl,
}));

const originalRevoke = globalThis.URL.revokeObjectURL;
const revokeSpy = vi.fn();

describe('useTaskImage', () => {
  beforeEach(() => {
    resetTaskImageCacheForTests();
    mockGetLocalImageUrl.mockReset();
    mockGetLocalImageUrl.mockImplementation(
      async (fileId: string) => `blob:fake-${fileId}`
    );
    revokeSpy.mockReset();
    globalThis.URL.revokeObjectURL = revokeSpy;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    if (originalRevoke) {
      globalThis.URL.revokeObjectURL = originalRevoke;
    } else {
      delete (globalThis.URL as unknown as Record<string, unknown>)
        .revokeObjectURL;
    }
  });

  it('loading: starts true, becomes false with the resolved URL', async () => {
    const { result } = renderHook(() => useTaskImage('file_loading_test'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.imageUrl).toBeNull();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.imageUrl).toBe('blob:fake-file_loading_test');
  });

  it('shared URL: two hooks with the same fileId fetch once and share the result', async () => {
    const a = renderHook(() => useTaskImage('file_shared_test'));
    const b = renderHook(() => useTaskImage('file_shared_test'));
    await waitFor(() => {
      expect(a.result.current.imageUrl).not.toBeNull();
      expect(b.result.current.imageUrl).not.toBeNull();
    });
    expect(a.result.current.imageUrl).toBe('blob:fake-file_shared_test');
    expect(b.result.current.imageUrl).toBe('blob:fake-file_shared_test');
    expect(mockGetLocalImageUrl).toHaveBeenCalledTimes(1);
    expect(mockGetLocalImageUrl).toHaveBeenCalledWith('file_shared_test');
  });

  it('deferred revoke: URL is not revoked until both instances unmount and 1.5s elapses', async () => {
    const a = renderHook(() => useTaskImage('file_revoke_test'));
    const b = renderHook(() => useTaskImage('file_revoke_test'));
    await waitFor(() => {
      expect(a.result.current.imageUrl).not.toBeNull();
      expect(b.result.current.imageUrl).not.toBeNull();
    });
    vi.useFakeTimers();
    try {
      act(() => {
        a.unmount();
      });
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(revokeSpy).not.toHaveBeenCalled();
      act(() => {
        b.unmount();
      });
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

  it('does not acquire a disabled image until it is enabled', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useTaskImage('file_gated_test', enabled),
      { initialProps: { enabled: false } }
    );
    expect(result.current).toEqual({ imageUrl: null, isLoading: false });
    expect(mockGetLocalImageUrl).not.toHaveBeenCalled();

    rerender({ enabled: true });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() =>
      expect(result.current.imageUrl).toBe('blob:fake-file_gated_test')
    );
    expect(mockGetLocalImageUrl).toHaveBeenCalledTimes(1);
  });

  it('finishes loading when image acquisition rejects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetLocalImageUrl.mockRejectedValueOnce(new Error('IndexedDB unavailable'));
    const { result } = renderHook(() => useTaskImage('file_error_test'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.imageUrl).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      '[useTaskImage] Failed to acquire image:',
      expect.any(Error)
    );
    errorSpy.mockRestore();
  });
});
