import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  getLocal: vi.fn(),
  getPreview: vi.fn(),
  cachePreview: vi.fn(),
  deletePreview: vi.fn(),
  pending: vi.fn(),
}));
vi.mock('../../src/lib/storage', () => ({ getLocalImageUrl: state.getLocal }));
vi.mock('../../src/lib/imageCache', () => ({
  getCachedCalendarPreview: state.getPreview,
  cacheCalendarPreview: state.cachePreview,
  deleteCachedCalendarPreview: state.deletePreview,
}));
vi.mock('../../src/lib/pendingImages', () => ({ isPendingImageId: state.pending }));

import { requestCalendarPreview } from '../../src/lib/calendarPhotoPreview';

const createURL = vi.fn(() => 'blob:small-preview');
const revokeURL = vi.fn();
const bitmapClose = vi.fn();
const makeBitmap = vi.fn(async () => ({
  width: 192, height: 128, close: bitmapClose,
}));
const convert = vi.fn(async () => new Blob(['small-preview'], { type: 'image/webp' }));
class FakeOffscreenCanvas {
  constructor(public width: number, public height: number) {}
  getContext() { return { drawImage: vi.fn() }; }
  convertToBlob() { return convert(); }
}

beforeEach(() => {
  vi.stubGlobal('createImageBitmap', makeBitmap);
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
  vi.stubGlobal('fetch', vi.fn(async () => ({
    blob: async () => new Blob(['large-original'], { type: 'image/webp' }),
  })));
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: createURL,
    revokeObjectURL: revokeURL,
  });
  for (const mock of Object.values(state)) mock.mockReset();
  createURL.mockReset().mockReturnValue('blob:small-preview');
  revokeURL.mockReset();
  bitmapClose.mockReset();
  makeBitmap.mockClear();
  convert.mockClear();
  state.pending.mockImplementation((id: string) => id.startsWith('pending_'));
  state.getPreview.mockResolvedValue(undefined);
  state.getLocal.mockResolvedValue('blob:full-original');
  state.cachePreview.mockResolvedValue(undefined);
  state.deletePreview.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('Calendar photo preview scheduling and storage', () => {
  it('uses an existing local thumbnail without downloading or decoding the original', async () => {
    const thumbnail = new Blob(['cached tiny preview']);
    state.getPreview.mockResolvedValue(thumbnail);
    const url = await requestCalendarPreview('cached-id', false, null, new AbortController().signal);
    expect(url).toBe('blob:small-preview');
    expect(createURL).toHaveBeenCalledWith(thumbnail);
    expect(state.getLocal).not.toHaveBeenCalled();
    expect(makeBitmap).not.toHaveBeenCalled();
  });

  it('creates one tiny local preview from the full image without changing the original', async () => {
    const url = await requestCalendarPreview('first-id', false, null, new AbortController().signal);
    expect(url).toBe('blob:small-preview');
    expect(state.getLocal).toHaveBeenCalledWith('first-id', false);
    expect(state.cachePreview).toHaveBeenCalledWith('first-id', expect.any(Blob));
    expect(makeBitmap).toHaveBeenCalledWith(expect.any(Blob), {
      resizeWidth: 192, resizeQuality: 'medium',
    });
    expect(bitmapClose).toHaveBeenCalledTimes(1);
    expect(revokeURL).toHaveBeenCalledWith('blob:full-original');
  });

  it('does not cache a second device-wide copy of an owner-scoped pending upload', async () => {
    await requestCalendarPreview('pending_owner-123', false, null, new AbortController().signal);
    expect(state.getPreview).not.toHaveBeenCalled();
    expect(state.cachePreview).not.toHaveBeenCalled();
    expect(state.getLocal).toHaveBeenCalled();
  });

  it('does not start new decode work while a pointer gesture is held', async () => {
    const calendar = document.createElement('div');
    calendar.dataset.routeSwipeHorizontalOwner = 'true';
    calendar.dataset.calendarMediaPaused = 'true';
    const target = document.createElement('div');
    calendar.append(target);
    document.body.append(calendar);
    const started = requestCalendarPreview('waiting', false, target, new AbortController().signal);
    await Promise.resolve();
    expect(state.getLocal).not.toHaveBeenCalled();
    delete calendar.dataset.calendarMediaPaused;
    calendar.dispatchEvent(new Event('mosaic-calendar-media-resume'));
    expect(await started).toBe('blob:small-preview');
    expect(state.getLocal).toHaveBeenCalledTimes(1);
  });

  it('pauses before decoding a photo downloaded midway through a swipe', async () => {
    let complete!: (url: string) => void;
    state.getLocal.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const calendar = document.createElement('div');
    calendar.dataset.routeSwipeHorizontalOwner = 'true';
    const target = document.createElement('div');
    calendar.append(target);
    document.body.append(calendar);
    const requested = requestCalendarPreview('mid-download', false, target, new AbortController().signal);
    await vi.waitFor(() => expect(state.getLocal).toHaveBeenCalledTimes(1));
    calendar.dataset.calendarMediaPaused = 'true';
    complete('blob:full-original');
    await Promise.resolve();
    expect(makeBitmap).not.toHaveBeenCalled();
    delete calendar.dataset.calendarMediaPaused;
    calendar.dispatchEvent(new Event('mosaic-calendar-media-resume'));
    expect(await requested).toBe('blob:small-preview');
    expect(makeBitmap).toHaveBeenCalledTimes(1);
  });

  it('does not draw or encode a bitmap that finishes decoding after a swipe begins', async () => {
    let finishDecode!: (bitmap: { width: number; height: number; close: () => void }) => void;
    makeBitmap.mockImplementationOnce(() => new Promise(resolve => { finishDecode = resolve; }));
    const calendar = document.createElement('div');
    calendar.dataset.routeSwipeHorizontalOwner = 'true';
    const target = document.createElement('div');
    calendar.append(target);
    document.body.append(calendar);
    const requested = requestCalendarPreview('decode-crossing-swipe', false, target, new AbortController().signal);
    await vi.waitFor(() => expect(makeBitmap).toHaveBeenCalledTimes(1));
    calendar.dataset.calendarMediaPaused = 'true';
    finishDecode({ width: 192, height: 128, close: bitmapClose });
    await Promise.resolve();
    expect(convert).not.toHaveBeenCalled();
    delete calendar.dataset.calendarMediaPaused;
    calendar.dispatchEvent(new Event('mosaic-calendar-media-resume'));
    expect(await requested).toBe('blob:small-preview');
    expect(convert).toHaveBeenCalledTimes(1);
  });

  it('cancels an abandoned waiting month without calling local or remote storage', async () => {
    const calendar = document.createElement('div');
    calendar.dataset.routeSwipeHorizontalOwner = 'true';
    calendar.dataset.calendarMediaPaused = 'true';
    const target = document.createElement('div');
    calendar.append(target);
    document.body.append(calendar);
    const controller = new AbortController();
    const request = requestCalendarPreview('abandoned', false, target, controller.signal);
    controller.abort();
    expect(await request).toBeNull();
    expect(state.getLocal).not.toHaveBeenCalled();
  });

  it('prioritizes the selected month over older queued photo downloads', async () => {
    const calendar = document.createElement('div');
    calendar.dataset.routeSwipeHorizontalOwner = 'true';
    calendar.dataset.calendarActiveSnap = '31';
    calendar.dataset.calendarMediaPaused = 'true';
    document.body.append(calendar);
    const previous = document.createElement('div');
    previous.dataset.calendarSlideIndex = '30';
    const current = document.createElement('div');
    current.dataset.calendarSlideIndex = '31';
    calendar.append(previous, current);
    const oldA = document.createElement('div');
    const oldB = document.createElement('div');
    const newest = document.createElement('div');
    previous.append(oldA, oldB);
    current.append(newest);
    const requests = [
      requestCalendarPreview('previous-a', false, oldA, new AbortController().signal),
      requestCalendarPreview('previous-b', false, oldB, new AbortController().signal),
      requestCalendarPreview('visible-new', false, newest, new AbortController().signal),
    ];
    delete calendar.dataset.calendarMediaPaused;
    calendar.dispatchEvent(new Event('mosaic-calendar-media-resume'));
    await vi.waitFor(() => expect(state.getLocal).toHaveBeenCalledTimes(3));
    expect(state.getLocal.mock.calls[0][0]).toBe('visible-new');
    await Promise.all(requests);
  });

  it('retains full-image fallback when offscreen canvas support is absent', async () => {
    vi.stubGlobal('OffscreenCanvas', undefined);
    const result = await requestCalendarPreview('fallback-id', false, null, new AbortController().signal);
    expect(result).toBe('blob:full-original');
    expect(state.cachePreview).not.toHaveBeenCalled();
    expect(revokeURL).not.toHaveBeenCalledWith('blob:full-original');
  });
});
