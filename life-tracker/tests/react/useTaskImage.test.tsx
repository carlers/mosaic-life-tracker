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
const mockCalendarPreview = vi.hoisted(() => vi.fn());

vi.mock('../../src/lib/storage', () => ({
  getLocalImageUrl: mockGetLocalImageUrl,
}));
vi.mock('../../src/lib/calendarPhotoPreview', () => ({
  requestCalendarPreview: mockCalendarPreview,
}));

const originalRevoke = globalThis.URL.revokeObjectURL;
const revokeSpy = vi.fn();

describe('useTaskImage', () => {
  beforeEach(() => {
    resetTaskImageCacheForTests();
    mockGetLocalImageUrl.mockReset();
    mockCalendarPreview.mockReset();
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
    expect(result.current).toMatchObject({ imageUrl: null, isLoading: false });
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
  it('repairs an already cached broken image by bypassing the local cache exactly once', async () => {
    mockGetLocalImageUrl
      .mockResolvedValueOnce('blob:damaged-cached-photo')
      .mockResolvedValueOnce('blob:recovered-photo');
    const { result } = renderHook(() => useTaskImage('file_legacy_broken'));
    await waitFor(() => expect(result.current.imageUrl).toBe('blob:damaged-cached-photo'));

    act(() => result.current.handleImageError());
    await waitFor(() => expect(result.current.imageUrl).toBe('blob:recovered-photo'));
    expect(mockGetLocalImageUrl).toHaveBeenNthCalledWith(2, 'file_legacy_broken', true);
    expect(mockGetLocalImageUrl).toHaveBeenCalledTimes(2);
  });

  it('stops automatic retries after a second decoding failure and allows manual refresh', async () => {
    mockGetLocalImageUrl
      .mockResolvedValueOnce('blob:bad-one')
      .mockResolvedValueOnce('blob:bad-two')
      .mockResolvedValueOnce('blob:working-again');
    const { result } = renderHook(() => useTaskImage('file_manual_recovery'));
    await waitFor(() => expect(result.current.imageUrl).toBe('blob:bad-one'));
    act(() => result.current.handleImageError());
    await waitFor(() => expect(result.current.imageUrl).toBe('blob:bad-two'));
    act(() => result.current.handleImageError());
    expect(result.current).toMatchObject({ imageUrl: null, isLoading: false });
    expect(mockGetLocalImageUrl).toHaveBeenCalledTimes(2);

    act(() => result.current.retryImage());
    await waitFor(() => expect(result.current.imageUrl).toBe('blob:working-again'));
    expect(mockGetLocalImageUrl).toHaveBeenNthCalledWith(3, 'file_manual_recovery', true);
  });

  it('retries a failed remote image on focus without requiring a remount', async () => {
    mockGetLocalImageUrl
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('blob:recovered-image');

    const { result } = renderHook(() => useTaskImage('file_retry_test'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.imageUrl).toBeNull();
    expect(mockGetLocalImageUrl).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() =>
      expect(result.current.imageUrl).toBe('blob:recovered-image')
    );
    expect(mockGetLocalImageUrl).toHaveBeenCalledTimes(2);
  });


  it('reuses a bounded warm Calendar preview URL across immediate month revisits', async () => {
    const calendar = document.createElement('div');
    calendar.dataset.routeSwipeHorizontalOwner = 'true';
    const target = document.createElement('div');
    calendar.append(target);
    document.body.append(calendar);
    const ref = { current: target };
    mockCalendarPreview.mockResolvedValue('blob:small-calendar');
    const first = renderHook(() => useTaskImage('photo-1', true, true, ref));
    await waitFor(() => expect(first.result.current.imageUrl).toBe('blob:small-calendar'));
    first.unmount();
    const second = renderHook(() => useTaskImage('photo-1', true, true, ref));
    expect(second.result.current.imageUrl).toBe('blob:small-calendar');
    expect(mockCalendarPreview).toHaveBeenCalledTimes(1);
    expect(mockGetLocalImageUrl).not.toHaveBeenCalled();
    second.unmount();
    calendar.remove();
  });

  it('defers completion of an already-started Calendar image until swipe release', async () => {
    const calendar = document.createElement('div');
    calendar.dataset.routeSwipeHorizontalOwner = 'true';
    calendar.dataset.calendarMediaPaused = 'true';
    const target = document.createElement('div');
    calendar.append(target);
    document.body.append(calendar);
    mockCalendarPreview.mockResolvedValue('blob:arrived-during-swipe');
    const ref = { current: target };
    const { result, unmount } = renderHook(() => useTaskImage('swiping-photo', true, true, ref));
    await waitFor(() => expect(mockCalendarPreview).toHaveBeenCalledTimes(1));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.imageUrl).toBeNull();
    expect(result.current.isLoading).toBe(true);
    act(() => {
      delete calendar.dataset.calendarMediaPaused;
      calendar.dispatchEvent(new Event('mosaic-calendar-media-resume'));
    });
    await waitFor(() => expect(result.current.imageUrl).toBe('blob:arrived-during-swipe'));
    unmount();
    calendar.remove();
  });

  it('drops an in-flight photo completion after its Calendar cell unmounts', async () => {
    const calendar = document.createElement('div');
    calendar.dataset.routeSwipeHorizontalOwner = 'true';
    const target = document.createElement('div');
    calendar.append(target);
    document.body.append(calendar);
    let finish!: (url: string) => void;
    mockCalendarPreview.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const ref = { current: target };
    const first = renderHook(() => useTaskImage('abandoned-photo', true, true, ref));
    await waitFor(() => expect(mockCalendarPreview).toHaveBeenCalledTimes(1));
    first.unmount();
    await act(async () => finish('blob:abandoned'));
    expect(revokeSpy).toHaveBeenCalledWith('blob:abandoned');
    calendar.remove();
  });

  it('does not serve a Calendar thumbnail to full-size task photo consumers', async () => {
    const calendar = document.createElement('div');
    calendar.dataset.routeSwipeHorizontalOwner = 'true';
    const target = document.createElement('div');
    calendar.append(target);
    document.body.append(calendar);
    mockCalendarPreview.mockResolvedValue('blob:thumbnail-only');
    const thumb = renderHook(() => useTaskImage('same-photo', true, true, { current: target }));
    await waitFor(() => expect(thumb.result.current.imageUrl).toBe('blob:thumbnail-only'));
    const detailed = renderHook(() => useTaskImage('same-photo'));
    await waitFor(() => expect(detailed.result.current.imageUrl).toBe('blob:fake-same-photo'));
    expect(mockGetLocalImageUrl).toHaveBeenCalledTimes(1);
    expect(mockCalendarPreview).toHaveBeenCalledTimes(1);
    thumb.unmount();
    detailed.unmount();
    calendar.remove();
  });

});
